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
  * optionally skips field groups the caller does not need (`skip_groups`).
    Every extraction is one serialized model call taking ~4 minutes, so a
    group nothing reads is hours of wall-clock spent on nothing: draining the
    backlog for the guest screens does not need `scholarships`, which no
    screen renders, and skipping it drops ~104 of ~497 jobs;
  * persists through the normal persist_outcome path, so review-queue dedup
    supersedes stale cards and the human-in-the-loop gate is untouched.

Heavy dependencies (storage download, PyMuPDF) are injected with lazy
defaults so the module unit-tests without them.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from uuid import UUID

import asyncpg

from .. import retry as retry_policy
from ..watchdog import watchdog

log = logging.getLogger(__name__)

FetchBlob = Callable[[str], bytes]
# (conn, guideline_document_id, pdf_bytes, field_groups) -> None
RunParseGroups = Callable[
    [asyncpg.Connection, UUID, bytes, tuple[str, ...]], Awaitable[None]
]

# Retryable-failure policy (network timeouts, 5xx, empty responses) lives in
# `uni_db.retry` — shared with the PDF-download path (direct_ingest_worker).
# A corrupt PDF, a schema failure, or a genuine hash mismatch is a real
# failure and must fail immediately here, never retried.


# Latest job per (document, field_group); only 'failed' ones are candidates.
# `limit` bounds the number of failed JOBS picked up this run (they are then
# grouped per document so each PDF is parsed once). `$2` is the field groups to
# skip — an empty array skips nothing, so the one statement serves both cases
# rather than branching the SQL.
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
   and not (l.field_group = any($2::text[]))
 order by gd.fetched_at desc nulls last
 limit $1
"""


class _HashMismatch(Exception):
    """Internal signal: stored blob no longer matches its recorded hash.
    Not in RETRYABLE_ERRORS — waiting out a network blip can't fix a blob
    that genuinely changed, so this must never be retried."""

    def __init__(self, actual: str, expected: str) -> None:
        super().__init__(f"{actual} != {expected}")
        self.actual = actual
        self.expected = expected


@dataclass(frozen=True, slots=True)
class RetryRun:
    jobs_seen: int        # failed jobs picked up
    documents: int        # distinct documents they belong to
    retried: int          # documents actually re-parsed
    hash_mismatch: int    # skipped — stored blob no longer matches its hash
    errors: int           # documents whose retry raised
    # Set when the run stopped early because the credential is broken (a
    # rejected key, an empty balance). Callers surface it instead of reporting
    # an ordinary short run — see `uni-db retry-failed`, which exits nonzero.
    fatal: str | None = None


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
    conn: asyncpg.Connection, *, limit: int,
    skip_groups: Sequence[str] = (),
) -> list[asyncpg.Record]:
    return await conn.fetch(_FETCH_FAILED_SQL, limit, list(skip_groups))


async def retry_failed(
    conn: asyncpg.Connection,
    *,
    limit: int,
    skip_groups: Sequence[str] = (),
    fetch_blob: FetchBlob | None = None,
    run_parse_groups: RunParseGroups | None = None,
) -> RetryRun:
    """Re-run up to `limit` failed extraction jobs from stored blobs.

    `skip_groups` drops field groups from the candidate set entirely — they are
    neither counted nor re-extracted, so a run that skips them is shorter by
    exactly their share of the backlog.
    """
    fetch_blob = fetch_blob or _default_fetch_blob
    run_parse_groups = run_parse_groups or _default_run_parse_groups

    records = await fetch_failed_jobs(conn, limit=limit, skip_groups=skip_groups)

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
        "retry_failed: %d failed job(s) across %d document(s)%s",
        len(records), len(by_doc),
        f" (skipping {','.join(skip_groups)})" if skip_groups else "",
    )

    retried = hash_mismatch = errors = 0
    fatal: str | None = None
    for gd_id, entry in by_doc.items():
        # A broken credential is not a per-document failure — it fails all of
        # them, and every failure is written back as a job the NEXT run picks
        # up. Left running, the backlog this worker exists to drain grows
        # instead: one invalid key turned ~500 failed jobs into ~75,000 in a
        # single day. Stop at the first one and let the caller report it.
        alert = watchdog.fatal_alert()
        if alert is not None:
            fatal = alert.code
            log.error(
                "retry_failed: stopping after %d of %d document(s) — %s: %s",
                retried + errors + hash_mismatch, len(by_doc),
                alert.code, alert.detail,
            )
            break

        groups: tuple[str, ...] = tuple(dict.fromkeys(entry["groups"]))
        storage_path = entry["storage_path"]
        expected = entry["file_hash_sha256"]

        async def _attempt(
            storage_path: str = storage_path,
            expected: str | None = expected,
            gd_id: UUID = gd_id,
            groups: tuple[str, ...] = groups,
        ) -> None:
            data = fetch_blob(storage_path)
            if expected:
                actual = hashlib.sha256(data).hexdigest()
                if actual != expected:
                    raise _HashMismatch(actual, expected)
            await run_parse_groups(conn, gd_id, data, groups)

        try:
            await retry_policy.with_retry(
                _attempt, label=f"{str(gd_id)[:8]} ({','.join(groups)})",
            )
        except _HashMismatch as exc:
            hash_mismatch += 1
            log.warning(
                "retry_failed: %s stored blob hash %s != recorded %s; "
                "skipping (won't re-extract a changed/corrupt blob)",
                str(gd_id)[:8], exc.actual[:12], exc.expected[:12],
            )
        except Exception as exc:  # one bad document must not abort the batch
            errors += 1
            log.warning(
                "retry_failed: %s (%s) failed: %s: %s",
                str(gd_id)[:8], ",".join(groups),
                type(exc).__name__, str(exc)[:160],
            )
            # An LLM error can escape the whole document, not just one field
            # group — feed it here too so the loop guard above sees a dead
            # credential wherever it surfaced.
            watchdog.record_llm_error(str(exc))
        else:
            retried += 1
            log.info(
                "retry_failed: re-extracted %s (%s)",
                str(gd_id)[:8], ",".join(groups),
            )

    # The break above runs before the alert can be raised by the LAST
    # document, so check once more on the way out.
    if fatal is None:
        alert = watchdog.fatal_alert()
        if alert is not None:
            fatal = alert.code

    return RetryRun(
        jobs_seen=len(records),
        documents=len(by_doc),
        retried=retried,
        hash_mismatch=hash_mismatch,
        errors=errors,
        fatal=fatal,
    )
