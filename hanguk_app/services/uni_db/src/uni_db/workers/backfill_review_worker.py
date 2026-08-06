"""Backfill worker — recover succeeded extractions that never reached review.

`_queue_entry_for` (parse_worker.py) has a "legacy human-gated" branch that
returns `None` — no review_queue row at all — for a high-confidence
extraction when both `UNI_DB_REQUIRE_APPROVAL` and `UNI_DB_AUTO_PUBLISH` are
false. `require_approval` defaults to true today, so that branch is dead in
current config, but 184 extraction_jobs (32% of all succeeded jobs, as of
2026-08) were created back when it wasn't — real, already-paid-for LLM
extractions sitting with `status='succeeded'` and no way to ever be approved
or published, because `publish_worker` only reads rows that came through
`review_queue`.

This worker finds every succeeded extraction_job with no matching
review_queue row and inserts one (`status='open'`, so a human confirms
before it publishes rather than silently backdating months-old data straight
into the app). Idempotent — the same NOT EXISTS check excludes a job once
its row exists, so re-running only picks up newly-orphaned jobs (belt and
suspenders in case the dead branch above is ever reachable again).

DB-only — no LLM, no HTTP; the extraction already succeeded.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import asyncpg

log = logging.getLogger(__name__)

_FETCH_SQL = """
select ej.id as extraction_job_id, ej.field_group
  from public.extraction_jobs ej
  left join public.review_queue rq
    on rq.entity_id = ej.id and rq.entity_type = 'extraction_jobs'
 where ej.status = 'succeeded'
   and rq.id is null
 order by ej.ended_at asc nulls last
 limit $1
"""

_INSERT_SQL = """
insert into public.review_queue (
  entity_type, entity_id, reason, priority, reviewer_notes, status, needs_attention
) values (
  'extraction_jobs', $1, 'auto_approved', 3,
  'Backfilled: this extraction succeeded but no review_queue row was ever '
  'created (pre-require_approval historical gap) — queued open for a human '
  'to confirm before it publishes.',
  'open', false
)
"""


@dataclass(frozen=True, slots=True)
class BackfillRun:
    found: int      # orphaned succeeded jobs seen this run
    inserted: int   # review_queue rows created


async def backfill_missing_review(conn: asyncpg.Connection, *, limit: int = 500) -> BackfillRun:
    rows = await conn.fetch(_FETCH_SQL, limit)
    inserted = 0
    for row in rows:
        await conn.execute(_INSERT_SQL, row["extraction_job_id"])
        inserted += 1
    if rows:
        log.info("backfill_review: found=%d inserted=%d", len(rows), inserted)
    return BackfillRun(found=len(rows), inserted=inserted)
