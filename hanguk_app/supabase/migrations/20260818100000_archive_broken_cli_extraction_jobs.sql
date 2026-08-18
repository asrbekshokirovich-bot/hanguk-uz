-- Archive the 382 jobs the broken claude_cli run produced on 2026-08-18.
--
-- The first drain on the subscription backend met a `claude` CLI that exited
-- 1 on every invocation. `record_cli_exit` fired its `cli_failure_streak`
-- alert correctly, but that code was missing from the watchdog's
-- `_FATAL_CODES`, so `fatal_alert()` returned None, no worker broke, and the
-- loop kept going: 382 failed jobs in fourteen minutes, until a human
-- cancelled the workflow. The same self-feeding backlog the guard was built
-- to prevent, reproduced on the other backend.
--
-- The guard is fixed in the same change. This migration removes what it let
-- through, on the pattern established by the 2026-08 dead-key cleanup:
-- MOVED to `extraction_jobs_archive`, not deleted, because the incident is
-- the reason the guard now covers this code.
--
-- These rows carry no extracted data — 382 of 382 have zero input tokens,
-- zero output tokens and zero cost, because the CLI never ran the model. None
-- is referenced by a review card (checked: 0), so nothing is orphaned.
--
-- The predicate is bounded by the run's own window and by the error prefix,
-- so it cannot reach the 2026-08 rows already archived or any genuine failure
-- outside those fourteen minutes.

with junk as (
  delete from public.extraction_jobs ej
   where ej.status = 'failed'
     and ej.ended_at >= '2026-08-18 09:49:33+00'
     and ej.ended_at <  '2026-08-18 10:05:00+00'
     and ej.error_text like 'ClaudeCliError: claude CLI exited 1%'
     and coalesce(ej.input_tokens, 0) = 0
     and coalesce(ej.output_tokens, 0) = 0
     and coalesce(ej.cost_usd, 0) = 0
     and not exists (
       select 1
         from public.review_queue rq
        where rq.entity_type = 'extraction_jobs'
          and rq.entity_id = ej.id
     )
  returning ej.*
)
insert into public.extraction_jobs_archive
select junk.*, now(), 'broken_claude_cli_2026_08_18', false
  from junk;

analyze public.extraction_jobs;
