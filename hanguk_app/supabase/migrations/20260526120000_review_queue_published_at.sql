-- Phase 0 (publish path). Approved review items must be normalized into the
-- public tables the app reads (requirements, tuition, scholarships,
-- university_admission_periods, documents_required). `fn_review_accept` only
-- flips status to 'approved' — nothing published. The publish worker fills the
-- gap; this column lets it run idempotently (publish each approved item once).
set local search_path = public, pg_catalog;

alter table public.review_queue
  add column if not exists published_at timestamptz;

comment on column public.review_queue.published_at is
  'When the publish worker normalized this approved item into the public tables. NULL = approved but not yet published.';
