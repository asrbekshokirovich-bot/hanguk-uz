-- Archive the extraction jobs produced while the Anthropic key was dead.
--
-- Between 2026-08-10 and 2026-08-15 the drain workflow held a revoked API
-- key and kept retrying. Every attempt was rejected at the door and written
-- back as a `failed` job, which the retry worker then picked up again — a
-- loop that fed itself. It stopped when the credential guard landed
-- (`watchdog.fatal_alert()`, PR #164), but the 97,994 rows it wrote are
-- still in `extraction_jobs`.
--
-- The rows are not merely noise. `retry_failed_worker._FETCH_FAILED_SQL`
-- picks the LATEST job per (document, field_group) and re-runs it when that
-- job is `failed`. For 137 pairs the latest job is one of these rejections
-- sitting on top of a real success, so a drain run would re-extract work
-- that was already done — paying for it again, and letting review-queue
-- dedup supersede cards a human had already approved. Measured on this
-- database, archiving shrinks the retry candidates from 372 to 16.
--
-- These rows carry no extracted data. Every one of them:
--
--   error_text  AuthenticationError: Error code: 401 — 'API key is invalid.'
--   raw_output  "{}"
--   parsed      {"_extraction_failed": "<the same error>"}
--   tokens      0 in / 0 out          cost  $0.0000
--   latency     ~100 ms               (never reached the model)
--
-- so nothing is lost by moving them. They are MOVED rather than deleted
-- anyway: the incident is the reason the guard exists, and the evidence for
-- it should outlive this migration. `extraction_jobs_archive` is a plain
-- sink — no foreign key back to `guideline_documents`, so a document that
-- is later removed cannot cascade the history away.
--
-- The predicate carries six independent guards (window, error prefix, zero
-- input tokens, zero output tokens, zero cost, empty payload) plus a
-- review-queue exclusion. Each one alone selects the same 97,994 rows; they
-- are stacked so that a row which is unusual in ANY dimension stays behind
-- for a human to look at. The review-queue guard is belt-and-braces — no
-- open or closed card currently points at one of these jobs (checked: 0 of
-- 746) — but `review_queue.entity_id` is an untyped reference with no
-- foreign key, so nothing at the database level would have stopped this
-- from orphaning a card.
--
-- Deliberately NOT touched:
--   * 208 timeout failures, 84 other, 30 credit-balance — real failures on
--     real documents that still need re-running;
--   * the 44 documents whose only history was these rejections. They lose
--     their job rows and fall out of `retry-failed`. That is correct: the
--     work never happened, and a document with no attempt belongs to
--     `reparse`, which selects from `guideline_documents`, not from jobs.

create table if not exists public.extraction_jobs_archive (
  like public.extraction_jobs including defaults,
  archived_at timestamptz not null default now(),
  archive_reason text not null
);

comment on table public.extraction_jobs_archive is
  'Extraction jobs removed from the live table. Written by migrations, never '
  'by the workers. Holds the 2026-08 dead-key incident; see archive_reason.';

alter table public.extraction_jobs_archive enable row level security;

-- Mirrors `extraction_jobs`: reviewers may read, nobody else, and no role
-- writes through PostgREST. A weaker policy here would make the archive a
-- side door to rows the live table hides.
drop policy if exists extraction_jobs_archive_reviewer_read on public.extraction_jobs_archive;
create policy extraction_jobs_archive_reviewer_read
  on public.extraction_jobs_archive
  for select
  using (fn_can_review_uni_db());

create index if not exists extraction_jobs_archive_document_idx
  on public.extraction_jobs_archive (guideline_document_id, field_group);

with junk as (
  delete from public.extraction_jobs ej
   where ej.status = 'failed'
     and ej.ended_at >= '2026-08-10'
     and ej.ended_at <  '2026-08-16'
     and ej.error_text like 'AuthenticationError: Error code: 401%'
     and coalesce(ej.input_tokens, 0) = 0
     and coalesce(ej.output_tokens, 0) = 0
     and coalesce(ej.cost_usd, 0) = 0
     and ej.raw_output = '"{}"'::jsonb
     -- Strip the one key the failure stub carries; anything left means the
     -- row held real extracted output and must not be archived.
     and ej.parsed_output - '_extraction_failed' = '{}'::jsonb
     and not exists (
       select 1
         from public.review_queue rq
        where rq.entity_type = 'extraction_jobs'
          and rq.entity_id = ej.id
     )
  returning ej.*
)
insert into public.extraction_jobs_archive
select junk.*, now(), 'dead_anthropic_key_2026_08_10_to_15'
  from junk;

analyze public.extraction_jobs;
