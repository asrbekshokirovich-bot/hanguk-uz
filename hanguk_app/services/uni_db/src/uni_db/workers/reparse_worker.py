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

log = logging.getLogger(__name__)

RunParse = Callable[[asyncpg.Connection, UUID, bytes], Awaitable[None]]
FetchBlob = Callable[[str], bytes]


def _default_fetch_blob(storage_path: str) -> bytes:
    from ..storage import supabase_storage
    return supabase_storage.fetch_blob(storage_path)


async def fetch_documents(
    conn: asyncpg.Connection,
    *,
    limit: int,
    institution_id: UUID | None = None,
    pending_only: bool = False,
) -> list[asyncpg.Record]:
    """Stored guideline documents to re-extract (least-recently-parsed first).

    `pending_only` restricts to documents never successfully parsed
    (`parse_status='pending'`) — i.e. orphaned when the inline fetch+parse threw
    after the row was inserted. The scheduled sync uses this to drain the orphan
    backlog cheaply, without re-billing already-parsed documents.
    """
    clauses = ["storage_path is not null"]
    params: list[object] = [limit]
    if pending_only:
        clauses.append("parse_status = 'pending'")
    if institution_id is not None:
        params.append(institution_id)
        clauses.append(f"institution_id = ${len(params)}")
    return await conn.fetch(
        f"""
        select id, storage_path from public.guideline_documents
         where {" and ".join(clauses)}
         order by parsed_version asc, fetched_at desc nulls last
         limit $1
        """,
        *params,
    )


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

    With `pending_only`, only documents never successfully parsed are picked,
    and one that fails again is marked `parse_status='failed'` so a permanently
    broken PDF is not re-billed on every scheduled run. A manual `reparse`
    (without `pending_only`) can still retry it after a fix — it stays
    `parsed_version=0`, so it sorts first.
    """
    fetch_blob = fetch_blob or _default_fetch_blob
    if run_parse is None:
        from .fetch_worker import _default_run_parse
        run_parse = _default_run_parse

    docs = await fetch_documents(
        conn, limit=limit, institution_id=institution_id, pending_only=pending_only
    )
    log.info("reparse_worker: %d document(s) to re-extract", len(docs))
    ok = fail = 0
    for d in docs:
        gd_id = d["id"]
        try:
            data = fetch_blob(d["storage_path"])
            await run_parse(conn, gd_id, data)
        except Exception as exc:  # one bad document must not abort the batch
            fail += 1
            log.warning("reparse_worker: %s failed: %s: %s",
                        str(gd_id)[:8], type(exc).__name__, str(exc)[:160])
            if pending_only:
                # Stop the scheduled drain from retrying a broken doc forever
                # (and re-billing it). Mark it failed; it stays parsed_version=0
                # so a manual full reparse can still pick it up after a fix.
                try:
                    await conn.execute(
                        "update public.guideline_documents set parse_status='failed' "
                        "where id=$1 and parse_status='pending'",
                        gd_id,
                    )
                except Exception:
                    log.warning("reparse_worker: could not mark %s failed",
                                str(gd_id)[:8])
        else:
            ok += 1
            log.info("reparse_worker: re-extracted %s", str(gd_id)[:8])
    return ok, fail
