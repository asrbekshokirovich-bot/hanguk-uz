-- Hanguk Ish: a worker is told when a shift is over.
--
-- When an application becomes 'completed' (the worker scanned the exit QR, the
-- upkeep job closed it, or the staff marked the attendance) the worker gets a
-- 'shift_finished' notification: A12 shows «Smena yakunlandi» with the pay, and
-- a push reaches the phone when the app is closed.

alter table ish.notifications drop constraint notifications_kind_check;
alter table ish.notifications add constraint notifications_kind_check check (kind in (
  'shift_reminder', 'application_confirmed', 'application_rejected',
  'new_shift_match', 'nearby_digest', 'new_applicant', 'worker_cancelled',
  'no_show', 'request_again', 'chat_message', 'payment_marked', 'job_offer',
  'shift_finished'
));

create function ish.notify_shift_finished()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  insert into ish.notifications (user_id, kind, data)
  values (new.worker_id, 'shift_finished',
          jsonb_build_object('application_id', new.id, 'shift_id', new.shift_id));
  return null;
end
$$;

create trigger applications_notify_finished
  after update of status on ish.applications
  for each row
  when (old.status is distinct from new.status and new.status = 'completed')
  execute function ish.notify_shift_finished();

-- The push goes to the worker app (like the other worker kinds).
create or replace function ish.push_app(p_kind text, p_data jsonb)
returns text
language sql
immutable
set search_path = ish
as $$
  select case
    when p_kind in ('new_applicant', 'worker_cancelled', 'no_show') then 'employer'
    when p_kind = 'chat_message' and coalesce(p_data, '{}'::jsonb) ? 'worker_id' then 'employer'
    when p_kind = 'payment_marked' and coalesce((p_data ->> 'paid')::boolean, false) is not true then null
    when p_kind in ('shift_reminder', 'application_confirmed', 'application_rejected', 'new_shift_match',
                    'nearby_digest', 'request_again', 'chat_message', 'payment_marked', 'job_offer',
                    'shift_finished') then 'worker'
  end
$$;
