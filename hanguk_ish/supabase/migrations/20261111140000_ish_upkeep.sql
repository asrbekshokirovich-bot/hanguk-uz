-- Hanguk Ish — what runs on its own (P7f, 2026-11-11).
--
--   * queue_shift_reminders(): «Smena 2 soatdan keyin» (A12) for every
--     confirmed worker, once per application;
--   * pg_cron runs it and close_finished_shifts() (no-shows, expired
--     applications) every 10 minutes where pg_cron is installed (Supabase);
--     the plain-PostgreSQL tests call them directly.

create function ish.queue_shift_reminders()
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_count int;
begin
  insert into ish.notifications (user_id, kind, data)
  select a.worker_id, 'shift_reminder',
         jsonb_build_object('application_id', a.id, 'shift_id', s.id, 'minutes_before', 120)
  from ish.applications a
  join ish.shifts s on s.id = a.shift_id
  where a.status = 'confirmed' and s.status = 'open'
    and s.starts_at > now() and s.starts_at <= now() + interval '2 hours'
    and not exists (
      select 1 from ish.notifications n
      where n.user_id = a.worker_id and n.kind = 'shift_reminder'
        and n.data ->> 'application_id' = a.id::text);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function ish.queue_shift_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('ish-close-finished-shifts', '*/10 * * * *', 'select ish.close_finished_shifts()');
    perform cron.schedule('ish-shift-reminders', '*/10 * * * *', 'select ish.queue_shift_reminders()');
  end if;
end
$$;
