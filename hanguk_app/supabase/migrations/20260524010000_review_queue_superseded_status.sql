-- Allow a 'superseded' status on review_queue so a re-extraction can retire
-- the previous open review item for the same (guideline document, field group)
-- instead of leaving a duplicate card next to the fresh one (Phase 1 dedup).
-- The dashboard view filters status='open', so superseded items drop out of
-- the queue automatically.
set local search_path = public, pg_catalog;

alter table public.review_queue
  drop constraint if exists review_queue_status_check;

alter table public.review_queue
  add constraint review_queue_status_check
  check (status in ('open', 'in_review', 'approved', 'rejected', 'escalated', 'superseded'));
