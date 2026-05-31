-- ============================================================================
--  Three nightly retention cron jobs for uni_db append-only tables.
--
--  All three run as service_role (cron picks up the postgres role and
--  the SECURITY DEFINER functions step up). They're cheap deletes —
--  no archive — because:
--    - pdf_access_log: audit trail beyond 90 days has marginal value
--    - change_event_outbox: terminal-state rows beyond 30 days are
--      historical. Pending/sending/failed rows are NEVER pruned so
--      in-flight retries survive forever.
--    - user_push_tokens: any active device re-registers on every
--      signed-in event, so 90 days of inactivity = retired device.
--
--  Schedule offsets (03:00, 03:05, 03:10 UTC) avoid lock contention.
--
--  Applied via Supabase MCP on 2026-05-10 to both projects.
-- ============================================================================

create or replace function public.fn_gc_pdf_access_log()
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_deleted int;
begin
  delete from public.pdf_access_log where granted_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke execute on function public.fn_gc_pdf_access_log() from public, anon, authenticated;
grant execute on function public.fn_gc_pdf_access_log() to service_role;

create or replace function public.fn_gc_change_event_outbox()
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_deleted int;
begin
  delete from public.change_event_outbox
   where status in ('sent', 'dead')
     and queued_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke execute on function public.fn_gc_change_event_outbox() from public, anon, authenticated;
grant execute on function public.fn_gc_change_event_outbox() to service_role;

create or replace function public.fn_gc_user_push_tokens()
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_deleted int;
begin
  delete from public.user_push_tokens where last_seen_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke execute on function public.fn_gc_user_push_tokens() from public, anon, authenticated;
grant execute on function public.fn_gc_user_push_tokens() to service_role;

select cron.schedule('uni-db-gc-pdf-access-log',     '0 3 * * *',  $job$ select public.fn_gc_pdf_access_log(); $job$);
select cron.schedule('uni-db-gc-change-event-outbox','5 3 * * *',  $job$ select public.fn_gc_change_event_outbox(); $job$);
select cron.schedule('uni-db-gc-user-push-tokens',   '10 3 * * *', $job$ select public.fn_gc_user_push_tokens(); $job$);
