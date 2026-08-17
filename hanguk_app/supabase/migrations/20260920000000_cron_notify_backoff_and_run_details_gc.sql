-- ============================================================================
--  Stop the per-minute notify cron from starving the database
--
--  Root cause of the 2026-08-14 App Review rejection (guideline 2.1(a)).
--  See hanguk_app/store/APP_REVIEW_2026-08-14.md §1 for the full trace.
--
--  `uni-db-notify-tracked-changes` runs `* * * * *` — 1 440 times a day. On
--  this instance that is more than pg_cron can reliably launch:
--
--    shared_buffers        224 MB      (Nano compute)
--    max_worker_processes  6           <- pg_cron, pg_net, parallel workers
--    max_connections       60          all compete for these six slots
--    statement_timeout     120 s
--
--  When a worker slot is not free, pg_cron records `job startup timeout` and
--  the run keeps occupying the scheduler while the next minute's run is
--  already due. On 2026-08-12..15 that produced 122 / 561 / 266 / 454 failed
--  runs per day, with single attempts hanging 10–564 s. Every other backend
--  starved behind them: `BEGIN` and `SET client_encoding` — microsecond
--  statements — hit the 120 s statement timeout, PostgREST could not answer,
--  and Cloudflare served 522 to the app. App Review signed in at 19:47 UTC on
--  2026-08-14, inside that window, and got an error instead of a session.
--
--  What the job actually achieves today, measured before this change:
--
--    net._http_response      every reply is {"ok":true,"skipped":"push_disabled"}
--    change_event_outbox     299 rows, oldest 2026-05-23, ALL `pending`,
--                            0 with sent_at, 0 attempts, 0 errors
--
--  So the consumer has never claimed a single row in three months: push is
--  off, the function returns immediately, and the schedule has been paying
--  worker-slot rent for nothing. Volume does not justify the minute either —
--  11 events were queued in the last 24 hours.
--
--  This migration does two things. Neither is the whole answer: the instance
--  is small for what runs on it, and moving off Nano is the structural fix.
--  These are what can be done without changing the bill.
--
--  1. Back the schedule off to every five minutes. Reduces pg_cron's demand
--     for worker slots 5×. Safe at any plausible event rate, and safe while
--     push stays disabled — if push ships and five minutes proves too slow,
--     raise it deliberately rather than leaving it at the minute by default.
--
--  2. Prune cron.job_run_details. Nothing has ever cleaned it: 116 906 rows /
--     21 MB, growing 1 440 rows a day from this job alone. pg_cron writes to
--     it on every run, so the bloat feeds back into the latency it records.
--     The existing fn_gc_* jobs (03:00/03:05/03:10) established the pattern;
--     this joins them at 03:15.
--
--  NOT done here, on purpose:
--    - `vacuum (full) net._http_response` — 41 MB for 361 live rows, badly
--      bloated, but VACUUM FULL takes an ACCESS EXCLUSIVE lock and does not
--      belong in a migration. Runbook step.
--    - Unscheduling the job outright. It is dead weight while push is off,
--      but it is the delivery path for a feature that is meant to ship, and
--      a disabled job is easy to forget. Five minutes keeps it warm.
-- ============================================================================

-- 1. ── Back off the notify schedule ────────────────────────────────────────
-- cron.schedule upserts by jobname, so this rewrites job 1 in place and keeps
-- its id and history.
select cron.schedule(
  'uni-db-notify-tracked-changes',
  '*/5 * * * *',
  $job$ select public.fn_invoke_notify_tracked_changes(); $job$
);

-- 2. ── Prune cron.job_run_details ──────────────────────────────────────────
-- Seven days is enough to diagnose an incident like 2026-08-14 — the failed
-- runs that explained it were three days old when they were read — and short
-- enough that the table stays small at any schedule.
create or replace function public.fn_gc_cron_job_run_details()
returns int
language plpgsql
security definer
set search_path = cron, public, pg_catalog
as $$
declare v_deleted int;
begin
  delete from cron.job_run_details
   where end_time < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.fn_gc_cron_job_run_details() from public, anon, authenticated;
grant  execute on function public.fn_gc_cron_job_run_details() to service_role;

-- 03:15 UTC — after the three existing retention jobs (03:00 / 03:05 / 03:10),
-- so they are not competing for worker slots with each other.
select cron.schedule(
  'uni-db-gc-cron-job-run-details',
  '15 3 * * *',
  $job$ select public.fn_gc_cron_job_run_details(); $job$
);
