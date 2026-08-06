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

import asyncio
import hashlib
import logging
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import UUID

import asyncpg
import httpx

log = logging.getLogger(__name__)

FetchBlob = Callable[[str], bytes]
# (conn, guideline_document_id, pdf_bytes, field_groups) -> None
RunParseGroups = Callable[
    [asyncpg.Connection, UUID, bytes, tuple[str, ...]], Awaitable[None]
]

# --- Transient-failure retry policy --------------------------------------
#
# A stored-blob download (Supabase Storage) or the db-exec HTTP round trip
# can hit a transient network hiccup — a read timeout, a dropped connection,
# a 5xx from an overloaded endpoint. Those are worth a few retries within
# THIS run. Everything else (a corrupt PDF, a schema failure, a genuine hash
# mismatch) is a real failure and must fail immediately, not retry.
#
# Retries are capped and jittered-backoff so a flaky/rate-limiting host
# doesn't get hammered into tighter bot-protection or an IP block. Once the
# schedule below is exhausted the job is left 'failed' for the *next*
# scheduled run to pick up, rather than retried forever in this one.
RETRYABLE_ERRORS: tuple[type[BaseException], ...] = (
    TimeoutError,
    ConnectionError,
    httpx.TimeoutException,
    httpx.TransportError,
)
RETRYABLE_STATUS_CODES = frozenset({408, 429, 500, 502, 503, 504})

# (min, max) jittered sleep window before each retry attempt, in order.
_RETRY_BACKOFF_WINDOWS_SEC: tuple[tuple[float, float], ...] = (
    (5.0, 10.0),
    (20.0, 30.0),
    (60.0, 60.0),
)
_MAX_RETRY_ATTEMPTS = len(_RETRY_BACKOFF_WINDOWS_SEC)


def _status_code_of(exc: BaseException) -> int | None:
    """Extract an HTTP status code from either an httpx.HTTPStatusError or a
    storage3.exceptions.StorageApiError (which carries `.status` instead of
    a `.response`)."""
    response = getattr(exc, "response", None)
    status = response.status_code if response is not None else getattr(exc, "status", None)
    try:
        return int(status) if status is not None else None
    except (TypeError, ValueError):
        return None


def _retry_after_sec(exc: BaseException) -> float | None:
    """A server-supplied Retry-After (seconds), when present — takes
    priority over the fixed backoff schedule."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    value = headers.get("retry-after") if headers else None
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, RETRYABLE_ERRORS):
        return True
    return _status_code_of(exc) in RETRYABLE_STATUS_CODES


async def _with_retry(attempt: Callable[[], Awaitable[None]], *, label: str) -> None:
    """Run `attempt()`, retrying transient network/5xx failures with a
    capped, jittered backoff (honoring Retry-After when the error carries
    one). Non-retryable errors, and retryable ones that exhaust the
    schedule, propagate on their final try."""
    for retry_num in range(_MAX_RETRY_ATTEMPTS + 1):
        try:
            await attempt()
            return
        except Exception as exc:
            if not _is_retryable(exc) or retry_num >= _MAX_RETRY_ATTEMPTS:
                raise
            wait = _retry_after_sec(exc)
            if wait is None:
                low, high = _RETRY_BACKOFF_WINDOWS_SEC[retry_num]
                wait = random.uniform(low, high)
            log.warning(
                "retry_failed: %s transient %s — retry %d/%d in %.0fs",
                label, type(exc).__name__, retry_num + 1, _MAX_RETRY_ATTEMPTS, wait,
            )
            await asyncio.sleep(wait)


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
            await _with_retry(
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
