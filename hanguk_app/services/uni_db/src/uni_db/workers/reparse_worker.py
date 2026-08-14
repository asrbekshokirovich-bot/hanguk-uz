"""Re-parse worker — re-extract already-downloaded guideline documents.

`run-pipeline` only fetches NEW announcements. To apply extraction /
normalization fixes to documents ALREADY in the system — without re-fetching
from the source site, which may be unreachable (e.g. KAIST times out from
cloud IPs) — this re-reads each stored PDF from Supabase Storage and re-runs
the parse pipeline. persist_outcome's dedup then supersedes the old review
cards for the same (guideline_document, field_group) with the fresh ones.

Heavy steps (storage download, PyMuPDF extract + parse) are injected with
lazy-importing defaults, so the module imports and unit-tests without those
deps.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from uuid import UUID

import asyncpg

from ..watchdog import watchdog

log = logging.getLogger(__name__)

RunParse = Callable[[asyncpg.Connection, UUID, bytes], Awaitable[None]]
FetchBlob = Callable[[str], bytes]


def _default_fetch_blob(storage_path: str) -> bytes:
    from ..storage import supabase_storage
    return supabase_storage.fetch_blob(storage_path)


async def fetch_documents(
    conn: asyncpg.Connection, *, limit: int,
    institution_id: UUID | None = None, pending_only: bool = False,
) -> list[asyncpg.Record]:
    """Stored guideline documents to re-extract (least-recently-parsed first).

    pending_only=True targets only never-parsed (parse_status='pending')
    documents — i.e. freshly uploaded PDFs — so the manual-upload engine drains
    new uploads without re-extracting (and re-billing) already-parsed docs.
    """
    where = ["storage_path is not null"]
    params: list[object] = [limit]
    if pending_only:
        where.append("parse_status = 'pending'")
    if institution_id is not None:
        params.append(institution_id)
        where.append(f"institution_id = ${len(params)}")
    sql = (
        "select id, storage_path from public.guideline_documents "
        f"where {' and '.join(where)} "
        "order by parsed_version asc, fetched_at desc nulls last "
        "limit $1"
    )
    return await conn.fetch(sql, *params)


async def reparse_pending(
    conn: asyncpg.Connection,
    *,
    limit: int,
    institution_id: UUID | None = None,
    pending_only: bool = False,
    fetch_blob: FetchBlob | None = None,
    run_parse: RunParse | None = None,
) -> tuple[int, int]:
    """Re-extract up to `limit` stored documents. Returns (ok, fail).

    When pending_only is set, only never-parsed (uploaded) docs are processed and
    a document that fails is flipped to parse_status='failed', so a broken PDF is
    not re-extracted (and re-billed) on every run.
    """
    fetch_blob = fetch_blob or _default_fetch_blob
    if run_parse is None:
        from .fetch_worker import _default_run_parse
        run_parse = _default_run_parse

    docs = await fetch_documents(
        conn, limit=limit, institution_id=institution_id, pending_only=pending_only
    )
    log.info("reparse_worker: %d document(s) to re-extract%s",
             len(docs), " (pending-only)" if pending_only else "")
    ok = fail = 0
    for d in docs:
        # A rejected key or an empty balance fails every remaining document
        # identically, and under pending_only each of those failures would
        # flip a perfectly good upload to parse_status='failed' — a state
        # nothing retries. Stop at the first one; the caller reports it.
        alert = watchdog.fatal_alert()
        if alert is not None:
            log.error("reparse_worker: stopping after %d document(s) — %s: %s",
                      ok + fail, alert.code, alert.detail)
            break
        gd_id = d["id"]
        try:
            data = fetch_blob(d["storage_path"])
            await run_parse(conn, gd_id, data)
        except Exception as exc:  # one bad document must not abort the batch
            fail += 1
            log.warning("reparse_worker: %s failed: %s: %s",
                        str(gd_id)[:8], type(exc).__name__, str(exc)[:160])
            # parse_worker feeds the watchdog from inside its per-group
            # handler, but an LLM error can also escape run_parse whole (the
            # PDF-extract step, a combined-call failure). Feed it here too so
            # the guard below does not depend on where the 401 surfaced.
            watchdog.record_llm_error(str(exc))
            if pending_only and watchdog.fatal_alert() is None:
                # Don't re-bill a broken upload every run — mark it failed.
                # Never on a credential failure: the document is fine, the
                # key is not, and 'failed' is a state nothing comes back for.
                try:
                    await conn.execute(
                        "update public.guideline_documents set parse_status='failed' where id=$1",
                        gd_id,
                    )
                except Exception:  # marking failed is best-effort
                    log.warning("reparse_worker: could not mark %s failed", str(gd_id)[:8])
        else:
            ok += 1
            log.info("reparse_worker: re-extracted %s", str(gd_id)[:8])
    return ok, fail
