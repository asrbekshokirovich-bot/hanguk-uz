-- Hanguk Ish — two holes in «a worker never holds two shifts that overlap»
-- (P30, 2026-11-12).
--
-- 1. Two requests of one worker at the same moment, for two shifts that
--    overlap: each locks only its own shift, neither sees the other's
--    application yet, and both went through. Each worker's requests now wait
--    for one another (a lock on the worker for the rest of the transaction).
--
-- 2. A shift moved to another time kept its waiting applicants: they could be
--    confirmed for a time they never asked for (and lose 20 points for not
--    coming), or for one that overlaps another shift of theirs. Moving a
--    shift now lets them go; each is told the new time and may take it again.
--    (A shift with a confirmed worker cannot move at all: shifts_guard.)

-- ---------------------------------------------------------------------------
-- 1. apply_to_shift: one worker's requests one after another
-- ---------------------------------------------------------------------------

create or replace function public.apply_to_shift(p_shift uuid)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_uid();
  v_shift public.shifts;
  v_app public.applications;
begin
  -- Until this transaction ends, the same worker's next request waits here,
  -- and then sees this one's application in the checks below.
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));

  if not exists (
    select 1 from public.worker_profiles where user_id = v_uid and onboarded_at is not null
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select * into v_shift from public.shifts where id = p_shift for update;
  if not found or v_shift.status <> 'open' or not exists (
    select 1 from public.businesses b where b.id = v_shift.business_id and b.status = 'verified'
  ) then
    raise exception 'SHIFT_CLOSED';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;
  if exists (
    select 1 from public.business_members m
    where m.business_id = v_shift.business_id and m.user_id = v_uid
  ) then
    raise exception 'OWN_SHIFT';
  end if;
  if exists (
    select 1 from public.applications
    where shift_id = p_shift and worker_id = v_uid and status not in ('cancelled', 'rejected')
  ) then
    raise exception 'ALREADY_APPLIED';
  end if;
  if exists (
    select 1
    from public.applications a
    join public.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid
      and a.status in ('pending', 'confirmed', 'checked_in')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) then
    raise exception 'TIME_CONFLICT';
  end if;
  if public.confirmed_count(p_shift) >= v_shift.slots then
    raise exception 'SHIFT_FULL';
  end if;

  insert into public.applications (shift_id, worker_id, status, decided_at)
  values (
    p_shift, v_uid,
    case when v_shift.auto_confirm then 'confirmed' else 'pending' end::public.application_status,
    case when v_shift.auto_confirm then now() end
  )
  returning * into v_app;

  perform public.notify_business(p_shift, 'new_applicant',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid,
                       'auto_confirmed', v_shift.auto_confirm));
  return v_app;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. A moved shift lets its waiting applicants go
-- ---------------------------------------------------------------------------

-- The workers read it in A12 as «the time changed» with the new day and
-- hours (application_rejected, reason time_changed); the shift stays open to
-- them in the feed. Like shifts_guard, for the apps' own requests (role
-- authenticated): the service role (an admin, the tests' time travel)
-- decides for itself.
create function public.shifts_release_on_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  with released as (
    update public.applications set status = 'rejected', decided_at = now()
    where shift_id = new.id and status = 'pending'
    returning id, worker_id
  )
  insert into public.notifications (user_id, kind, data)
  select worker_id, 'application_rejected',
         jsonb_build_object('application_id', id, 'shift_id', new.id, 'reason', 'time_changed')
  from released;
  return null;
end
$$;

revoke execute on function public.shifts_release_on_move() from public, anon, authenticated;

create trigger shifts_release_on_move after update of starts_at, ends_at on public.shifts
  for each row
  when ((new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at)
        and current_user = 'authenticated')
  execute function public.shifts_release_on_move();
