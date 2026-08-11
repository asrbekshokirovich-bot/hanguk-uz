"""Requeue worker — send rejected sections back through review.

A reviewer rejecting one section of a 모집요강 used to end that section: the
card flipped to 'rejected' and nothing ever re-ran, while the finder's
content-hash guard kept the identical PDF from ever being ingested again. The
section just disappeared from the university's data.

This worker closes the extraction lane of that gap. For every rejection whose
reason says *the model misread a perfectly good PDF* — hallucinated_field,
ocr_garbled, wrong_archetype, other — it:

  * reads the ALREADY-STORED blob (no re-download from ac.kr) and verifies its
    SHA-256 against guideline_documents before spending LLM budget on a
    corrupt or swapped blob;
  * re-extracts ONLY the rejected field group (parse_worker's `only_groups`),
    so a document with one bad section out of five is billed for one;
  * persists through the normal persist_outcome path, which files a fresh
    review card — the human gate is untouched, the reviewer simply gets
    another look at a new extraction.

The other lane (wrong_year, source_404) is handled in SQL: `fn_review_reject`
flips the document to parse_status='failed', releasing the hash guard so the
next crawl re-fetches the URL. Re-reading the same bytes could not have fixed
either of those.

`MAX_REJECTS` bounds the loop. A section the model keeps getting wrong would
otherwise cycle reject → re-extract → reject forever, spending real money each
turn; past the cap the pair is left alone for a human to deal with.

Heavy dependencies (storage download, PyMuPDF) are injected with lazy defaults
so the module unit-tests without them.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import UUID

import asyncpg

log = logging.getLogger(__name__)

FetchBlob = Callable[[str], bytes]
# (conn, guideline_document_id, pdf_bytes, field_groups) -> None
RunParseGroups = Callable[
    [asyncpg.Connection, UUID, bytes, tuple[str, ...]], Awaitable[None]
]

# Reasons the requeue lane can actually fix — mirrors
# public.fn_reject_reason_lane(). Keep the two in step.
EXTRACTION_LANE_REASONS = frozenset(
    {"hallucinated_field", "ocr_garbled", "wrong_archetype", "other"}
)
SOURCE_LANE_REASONS = frozenset({"wrong_year", "source_404"})

# How many times one (document, field_group) may be rejected before this
# worker stops re-extracting it. 2 = the original rejection plus one retry.
MAX_REJECTS = 2

# The view already filters to the extraction lane, to rejections nothing newer
# has superseded, and to documents with a usable blob.
_FETCH_SQL = """
select queue_id,
       guideline_document_id,
       field_group,
       reason,
       storage_path,
       file_hash_sha256,
       reject_count
  from public.v_rejected_awaiting_requeue
 where reject_count <= $2
 order by resolved_at desc nulls last
 limit $1
"""


@dataclass(frozen=True, slots=True)
class RequeueRun:
    cards_seen: int       # rejected cards picked up
    documents: int        # distinct documents they belong to
    requeued: int         # documents actually re-extracted
    hash_mismatch: int    # skipped — stored blob no longer matches its hash
    errors: int           # documents whose re-extraction raised


def _default_fetch_blob(storage_path: str) -> bytes:
    from ..storage import supabase_storage
    return supabase_storage.fetch_blob(storage_path)


async def _default_run_parse_groups(
    conn: asyncpg.Connection, gd_id: UUID, data: bytes, groups: tuple[str, ...]
) -> None:
    """Extract text → re-parse only `groups` → persist jobs/review entries."""
    from ..parse.extract_orchestrator import extract as extract_pdf
    from .parse_worker import parse_one_document, persist_outcome

    extracted, decision = extract_pdf(data)
    log.info("   pdf: %d pages, tier=%s", extracted.page_count, decision.tier)
    if not extracted.text.strip():
        raise ValueError("no text extracted from stored PDF")
    lines = extracted.text.split("\n")
    head = "\n".join(lines[: min(len(lines), 600)])
    outcome = parse_one_document(
        guideline_document_id=gd_id,
        pdf_text_first_pages=head,
        pdf_text_full=extracted.text,
        only_groups=groups,
    )
    await persist_outcome(conn, outcome)


async def fetch_rejected_cards(
    conn: asyncpg.Connection, *, limit: int, max_rejects: int = MAX_REJECTS
) -> list[asyncpg.Record]:
    return await conn.fetch(_FETCH_SQL, limit, max_rejects)


async def requeue_rejected(
    conn: asyncpg.Connection,
    *,
    limit: int,
    max_rejects: int = MAX_REJECTS,
    fetch_blob: FetchBlob | None = None,
    run_parse_groups: RunParseGroups | None = None,
) -> RequeueRun:
    """Re-extract up to `limit` rejected sections from stored blobs."""
    fetch_blob = fetch_blob or _default_fetch_blob
    run_parse_groups = run_parse_groups or _default_run_parse_groups

    records = await fetch_rejected_cards(conn, limit=limit, max_rejects=max_rejects)

    # Group rejected cards per document so each PDF is fetched/parsed once.
    by_doc: dict[UUID, dict] = {}
    for r in records:
        entry = by_doc.setdefault(
            r["guideline_document_id"],
            {
                "storage_path": r["storage_path"],
                "file_hash_sha256": r["file_hash_sha256"],
                "groups": [],
            },
        )
        entry["groups"].append(r["field_group"])

    log.info(
        "requeue_rejected: %d rejected card(s) across %d document(s)",
        len(records), len(by_doc),
    )

    requeued = hash_mismatch = errors = 0
    for gd_id, entry in by_doc.items():
        groups: tuple[str, ...] = tuple(dict.fromkeys(entry["groups"]))
        try:
            data = fetch_blob(entry["storage_path"])
            expected = entry["file_hash_sha256"]
            if expected:
                actual = hashlib.sha256(data).hexdigest()
                if actual != expected:
                    hash_mismatch += 1
                    log.warning(
                        "requeue_rejected: %s stored blob hash %s != recorded %s; "
                        "skipping (won't re-extract a changed/corrupt blob)",
                        str(gd_id)[:8], actual[:12], str(expected)[:12],
                    )
                    continue
            await run_parse_groups(conn, gd_id, data, groups)
        except Exception as exc:  # one bad document must not abort the batch
            errors += 1
            log.warning(
                "requeue_rejected: %s (%s) failed: %s: %s",
                str(gd_id)[:8], ",".join(groups),
                type(exc).__name__, str(exc)[:160],
            )
        else:
            requeued += 1
            log.info(
                "requeue_rejected: re-extracted %s (%s) — back in the review queue",
                str(gd_id)[:8], ",".join(groups),
            )

    return RequeueRun(
        cards_seen=len(records),
        documents=len(by_doc),
        requeued=requeued,
        hash_mismatch=hash_mismatch,
        errors=errors,
    )
