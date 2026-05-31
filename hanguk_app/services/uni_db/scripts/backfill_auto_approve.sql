-- One-off backfill: auto-approve the succeeded extractions the old human-gated
-- pipeline left unpublished, so `uni-db publish` drains them into the public
-- content tables (requirements / tuition / scholarships / documents_required /
-- admission periods). Idempotent and safe to re-run.
--
-- Context: review is now automated (see migration 20260801001000 + parse_worker).
-- This catches up the backlog that accumulated while the gate required a human:
-- the audit found ~322 newest-per-(document, field_group) extractions with no
-- terminal queue row (the orphaned auto-publish path) plus ~87 items still
-- sitting `open`.
--
-- Run order:
--   psql "$UNI_DB_SUPABASE_DB_URL" -f scripts/backfill_auto_approve.sql
--   uni-db publish --limit 2000
--
-- Confidence policy mirrors parse_worker._queue_entry_for():
--   conf >= 0.85  -> clean   (reason 'auto_approved',  needs_attention false)
--   else / null   -> flagged (reason 'low_confidence', needs_attention true)

begin;

-- 0) Retire stale open/in_review cards that are NOT the newest extraction for
--    their (document, field_group) slot, so each slot publishes exactly once.
with newest as (
  select distinct on (guideline_document_id, field_group) id
    from public.extraction_jobs
   where status = 'succeeded'
   order by guideline_document_id, field_group, ended_at desc nulls last
)
update public.review_queue rq
   set status = 'superseded', resolved_at = now()
  from public.extraction_jobs ej
 where rq.entity_id = ej.id
   and rq.entity_type = 'extraction_jobs'
   and rq.status in ('open', 'in_review')
   and ej.id not in (select id from newest);

-- 1) Approve the remaining items that were waiting for a human.
update public.review_queue rq
   set status          = 'approved',
       needs_attention  = coalesce(ej.accuracy_self_score, 0) < 0.85,
       resolved_at      = now()
  from public.extraction_jobs ej
 where rq.entity_id = ej.id
   and rq.entity_type = 'extraction_jobs'
   and rq.status in ('open', 'in_review');

-- 2) Insert approved rows for the newest succeeded extraction per
--    (document, field_group) that has no terminal queue row at all — the
--    orphaned auto-publish path that never reached the publisher.
with newest as (
  select distinct on (ej.guideline_document_id, ej.field_group)
         ej.id, ej.guideline_document_id, ej.field_group, ej.accuracy_self_score
    from public.extraction_jobs ej
   where ej.status = 'succeeded'
   order by ej.guideline_document_id, ej.field_group, ej.ended_at desc nulls last
)
insert into public.review_queue
  (entity_type, entity_id, reason, priority, reviewer_notes,
   status, needs_attention, resolved_at)
select 'extraction_jobs', n.id,
       case when coalesce(n.accuracy_self_score, 0) < 0.85
            then 'low_confidence' else 'auto_approved' end,
       5, 'backfill: auto-approved (review automated)',
       'approved',
       coalesce(n.accuracy_self_score, 0) < 0.85,
       now()
  from newest n
 where not exists (
   select 1
     from public.review_queue rq
     join public.extraction_jobs e2
       on e2.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
    where rq.status <> 'superseded'
      and e2.guideline_document_id = n.guideline_document_id
      and e2.field_group = n.field_group
 );

commit;

-- After this commit, run:  uni-db publish --limit 2000
-- The publisher is idempotent (review_queue.published_at) and applies its own
-- stale-cycle / empty-payload guards, so re-running is safe.
