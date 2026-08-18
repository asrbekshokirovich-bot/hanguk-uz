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
    open_cards_only: bool = False, failed_only: bool = False,
) -> list[asyncpg.Record]:
    """Stored guideline documents to re-extract (least-recently-parsed first).

    pending_only=True targets only never-parsed (parse_status='pending')
    documents — i.e. freshly uploaded PDFs — so the manual-upload engine drains
    new uploads without re-extracting (and re-billing) already-parsed docs.

    failed_only=True targets documents whose parse_status is 'failed'. These do
    NOT come back on their own: `retry-failed` works from extraction jobs, and
    the 2026-08 dead-key rows that marked many of them failed have since been
    archived, so those documents now have no job rows to be found through. The
    default backlog order is also wrong for them — it sorts by parsed_version
    ascending, and a document that failed after many attempts sorts last.
    Ordering is flipped to most-attempted-first here for the same reason
    `open_cards_only` flips it: the caller asked for a specific set, not for
    the backlog.

    open_cards_only=True targets the documents a reviewer is actually looking
    at: those behind a row still sitting in the review queue. The default
    order — least-parsed first — is the right one for draining a backlog and
    the wrong one for "re-do what is on screen", because a document whose card
    is open may well have been parsed several times already and sorts last.
    Re-extraction supersedes the open card through the normal persist path, so
    this replaces what the reviewer sees rather than stacking beside it.
    """
    where = ["storage_path is not null"]
    params: list[object] = [limit]
    if pending_only:
        where.append("parse_status = 'pending'")
    if open_cards_only:
        # Both card shapes: a field-group card points at an extraction job,
        # a document-level flag points at the document itself. Missing either
        # would silently leave part of the queue un-refreshed.
        where.append(
            "(id in (select ej.guideline_document_id from public.review_queue rq "
            "          join public.extraction_jobs ej on ej.id = rq.entity_id "
            "         where rq.status = 'open' and rq.entity_type = 'extraction_jobs') "
            " or id in (select rq.entity_id from public.review_queue rq "
            "            where rq.status = 'open' "
            "              and rq.entity_type = 'guideline_documents'))"
        )
    if failed_only:
        where.append("parse_status = 'failed'")
        # Skip documents a newer version has already replaced. Nothing else in
        # the pipeline reads `superseded_by_id` — grep the service and this is
        # the only reference — so a superseded document re-extracts exactly
        # like a current one and its cards arrive in the review queue looking
        # current. Of the 41 failed documents, 8 are superseded: a fifth of
        # the run spent producing review work about guidelines that have
        # already been withdrawn.
        #
        # Scoped to this selector on purpose. Whether the backlog and
        # open-cards paths should skip superseded documents too is a real
        # question, but changing what they select is not something to slip in
        # under a flag that was added for a different reason.
        where.append("superseded_by_id is null")
    if institution_id is not None:
        params.append(institution_id)
        where.append(f"institution_id = ${len(params)}")
    order = (
        "parsed_version desc, fetched_at desc nulls last"
        if failed_only
        else "parsed_version asc, fetched_at desc nulls last"
    )
    sql = (
        "select id, storage_path from public.guideline_documents "
        f"where {' and '.join(where)} "
        f"order by {order} "
        "limit $1"
    )
    return await conn.fetch(sql, *params)


async def reparse_pending(
    conn: asyncpg.Connection,
    *,
    limit: int,
    institution_id: UUID | None = None,
    pending_only: bool = False,
    open_cards_only: bool = False,
    failed_only: bool = False,
    fetch_blob: FetchBlob | None = None,
    run_parse: RunParse | None = None,
) -> tuple[int, int]:
    """Re-extract up to `limit` stored documents. Returns (ok, fail).

    When pending_only is set, only never-parsed (uploaded) docs are processed and
    a document that fails is flipped to parse_status='failed', so a broken PDF is
    not re-extracted (and re-billed) on every run.

    failed_only selects the documents already sitting at parse_status='failed'.
    It does not flip status on failure the way pending_only does: they are
    already marked failed, and re-marking a document that has just failed again
    for a NEW reason would overwrite nothing useful while hiding that the run
    happened at all.
    """
    fetch_blob = fetch_blob or _default_fetch_blob
    if run_parse is None:
        from .fetch_worker import _default_run_parse
        run_parse = _default_run_parse

    docs = await fetch_documents(
        conn, limit=limit, institution_id=institution_id,
        pending_only=pending_only, open_cards_only=open_cards_only,
        failed_only=failed_only,
    )
    selector = (
        " (pending-only)" if pending_only
        else " (open-cards)" if open_cards_only
        else " (failed-docs)" if failed_only
        else ""
    )
    log.info("reparse_worker: %d document(s) to re-extract%s", len(docs), selector)
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
