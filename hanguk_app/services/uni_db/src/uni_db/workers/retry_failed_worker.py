"""Retry-failed worker — re-run FAILED extraction jobs from stored PDFs.

Roughly half of documents_required jobs (and a long tail of the other field
groups) failed on schema strictness, fenced JSON, or CLI timeouts. Those fixes
live in the extraction layer now, but the failed jobs stay failed until
something re-runs them. This worker does exactly that:

  * finds guideline documents whose LATEST job for a field group is 'failed'
    (a newer succeeded job for the same group means it already recovered);
  * re-reads the ALREADY-STORED PDF from blob storage — no re-download from
    ac.kr — and verifies its SHA-256 against guideline_documents.
    file_hash_sha256 before spending any LLM budget on a corrupt/changed blob;
  * re-extracts ONLY the failed field groups (parse_worker's `only_groups`),
    so a document that failed one group out of five is billed for one;
  * persists through the normal persist_outcome path, so review-queue dedup
    supersedes stale cards and the human-in-the-loop gate is untouched.

Heavy dependencies (storage download, PyMuPDF) are injected with lazy
defaults so the module unit-tests without them.
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

# Latest job per (document, field_group); only 'failed' ones are candidates.
# `limit` bounds the number of failed JOBS picked up this run (they are then
# grouped per document so each PDF is parsed once).
_FETCH_FAILED_SQL = """
with latest as (
  select distinct on (ej.guideline_document_id, ej.field_group)
         ej.guideline_document_id,
         ej.field_group,
         ej.status
    from public.extraction_jobs ej
   order by ej.guideline_document_id, ej.field_group,
            ej.started_at desc nulls last, ej.ended_at desc nulls last
)
select l.guideline_document_id,
       l.field_group,
       gd.storage_path,
       gd.file_hash_sha256
  from latest l
  join public.guideline_documents gd on gd.id = l.guideline_document_id
 where l.status = 'failed'
   and gd.storage_path is not null
 order by gd.fetched_at desc nulls last
 limit $1
"""


@dataclass(frozen=True, slots=True)
class RetryRun:
    jobs_seen: int        # failed jobs picked up
    documents: int        # distinct documents they belong to
    retried: int          # documents actually re-parsed
    hash_mismatch: int    # skipped — stored blob no longer matches its hash
    errors: int           # documents whose retry raised


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


async def fetch_failed_jobs(
    conn: asyncpg.Connection, *, limit: int
) -> list[asyncpg.Record]:
    return await conn.fetch(_FETCH_FAILED_SQL, limit)


async def retry_failed(
    conn: asyncpg.Connection,
    *,
    limit: int,
    fetch_blob: FetchBlob | None = None,
    run_parse_groups: RunParseGroups | None = None,
) -> RetryRun:
    """Re-run up to `limit` failed extraction jobs from stored blobs."""
    fetch_blob = fetch_blob or _default_fetch_blob
    run_parse_groups = run_parse_groups or _default_run_parse_groups

    records = await fetch_failed_jobs(conn, limit=limit)

    # Group failed jobs per document so each PDF is fetched/parsed once.
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
        "retry_failed: %d failed job(s) across %d document(s)",
        len(records), len(by_doc),
    )

    retried = hash_mismatch = errors = 0
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
                        "retry_failed: %s stored blob hash %s != recorded %s; "
                        "skipping (won't re-extract a changed/corrupt blob)",
                        str(gd_id)[:8], actual[:12], str(expected)[:12],
                    )
                    continue
            await run_parse_groups(conn, gd_id, data, groups)
        except Exception as exc:  # one bad document must not abort the batch
            errors += 1
            log.warning(
                "retry_failed: %s (%s) failed: %s: %s",
                str(gd_id)[:8], ",".join(groups),
                type(exc).__name__, str(exc)[:160],
            )
        else:
            retried += 1
            log.info(
                "retry_failed: re-extracted %s (%s)",
                str(gd_id)[:8], ",".join(groups),
            )

    return RetryRun(
        jobs_seen=len(records),
        documents=len(by_doc),
        retried=retried,
        hash_mismatch=hash_mismatch,
        errors=errors,
    )
