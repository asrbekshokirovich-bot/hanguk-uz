-- An interview session is opened as 'active' and closed by the app when the
-- student ends it. When the app is closed mid-interview, the call never
-- connects, or the phone loses the network, nothing closes it: on 2026-11-12
-- there were 113 'active' sessions, the oldest from April. The student's
-- history lists each of them as an interview still in progress.
--
-- No interview lasts three hours (the timed ones are minutes long): a session
-- still 'active' after that was left, and is marked 'abandoned' — the status
-- the app itself writes when the student leaves — with the time of its last
-- line as its end. Hourly, from pg_cron; the first run closes the 113.

create or replace function public.interview_sessions_close_stale()
returns integer
language sql
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with closed as (
    update public.interview_sessions s
       set status = 'abandoned',
           ended_at = coalesce(
             s.ended_at,
             (select max(m.created_at) from public.interview_messages m where m.session_id = s.id),
             s.started_at,
             s.created_at)
     where s.status = 'active'
       and coalesce(s.started_at, s.created_at) < now() - interval '3 hours'
    returning 1
  )
  select count(*)::int from closed;
$$;

revoke all on function public.interview_sessions_close_stale() from public, anon, authenticated;
grant execute on function public.interview_sessions_close_stale() to service_role;

comment on function public.interview_sessions_close_stale() is
  'Marks interview sessions still active after three hours as abandoned. Hourly (pg_cron interview-sessions-close-stale).';

do $$
begin
  -- Not every database this file runs on has pg_cron (local tests do not).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'interview-sessions-close-stale',
      '37 * * * *',
      'select public.interview_sessions_close_stale()');
  end if;
end $$;

select public.interview_sessions_close_stale();
