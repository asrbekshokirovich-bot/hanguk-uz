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

This worker finds succeeded extraction_jobs that never reached review and
inserts a review_queue row (`status='open'`, so a human confirms before it
publishes rather than silently backdating months-old data straight into the
app). Idempotent — a job is excluded once its row exists, so re-running only
picks up newly-orphaned jobs (belt and suspenders in case the dead branch
above is ever reachable again).

It queues at most one row per (guideline document, field group): the
pipeline produces many jobs per section, and queueing each orphan gave the
reviewer the same section two and three times over. See `_FETCH_SQL`. The
`trg_supersede_stale_review_rows` trigger (migration 20260919000000) is the
backstop for every other insert path.

DB-only — no LLM, no HTTP; the extraction already succeeded.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import asyncpg

log = logging.getLogger(__name__)

# One row per SECTION, not per job.
#
# The original query asked "does this job have a review row?"
# (`rq.entity_id = ej.id`). The pipeline creates many jobs for the same
# (guideline document, field group) — up to 41 for a single pairing — so every
# orphaned job looked like fresh work and got its own card. That is how the
# reviewer ended up with the same section queued two and three times within
# minutes on 2026-08-06.
#
# Two guards now:
#   * `not exists` over the whole section, so a section that already has a live
#     card is skipped entirely rather than queued again;
#   * `distinct on (document, field_group)` keeping the newest job, so a
#     section with a dozen orphans contributes one row, not a dozen.
#
# Jobs with no document or field group cannot be grouped into a section and
# keep the old per-job behaviour — there is nothing to collide with.
_FETCH_SQL = """
select distinct on (ej.guideline_document_id, ej.field_group)
       ej.id as extraction_job_id, ej.field_group
  from public.extraction_jobs ej
 where ej.status = 'succeeded'
   and not exists (
     select 1
       from public.review_queue rq
      where rq.entity_type = 'extraction_jobs'
        and rq.entity_id = ej.id
   )
   and not exists (
     select 1
       from public.review_queue rq
       join public.extraction_jobs sib on sib.id = rq.entity_id
      where rq.entity_type = 'extraction_jobs'
        and rq.status in ('open', 'in_review')
        and sib.guideline_document_id is not distinct from ej.guideline_document_id
        and sib.field_group is not distinct from ej.field_group
   )
 order by ej.guideline_document_id, ej.field_group, ej.ended_at desc nulls last
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
