-- Hanguk Ish — a full shift lets its waiting applicants go, however it filled
-- up; a worker keeps reading the shifts they applied to.
--
-- 1. When BA3 confirmed the last place, the other waiting applicants were
--    turned down («full») and told. A shift that filled up another way kept
--    them waiting until it started — and meanwhile kept them from any other
--    shift at the same time (TIME_CONFLICT) — then told them nobody answered:
--      - BA2: places lowered to those already confirmed;
--      - 자동 확정 switched on, new applicants confirmed at once.
--    release_waiting_if_full() now does it for all three.
-- 2. shifts_read promised «a worker keeps seeing shifts they applied to», but
--    inside its subquery the bare «id» was the application's own id
--    (a.shift_id = a.id, never true): once a shift was called off, its worker
--    could no longer read it.

create function ish.release_waiting_if_full(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  if ish.confirmed_count(p_shift) < (select slots from ish.shifts where id = p_shift) then
    return;
  end if;
  with closed as (
    update ish.applications set status = 'rejected', decided_at = now()
    where shift_id = p_shift and status = 'pending'
    returning id, worker_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'application_rejected',
         jsonb_build_object('application_id', id, 'shift_id', p_shift, 'reason', 'full')
  from closed;
end $$;

revoke execute on function ish.release_waiting_if_full(uuid) from public, anon, authenticated;

-- BA3: the last confirmation (as before, now through the shared function).
create or replace function ish.decide_application(p_application uuid, p_accept boolean)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_app ish.applications;
  v_shift ish.shifts;
begin
  select a.* into v_app from ish.applications a where a.id = p_application;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_shift from ish.shifts where id = v_app.shift_id for update;
  if not ish.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_app from ish.applications where id = p_application for update;
  if v_app.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;
  if v_shift.ends_at <= now() then
    raise exception 'SHIFT_ENDED';
  end if;
  if p_accept then
    if ish.confirmed_count(v_shift.id) >= v_shift.slots then
      raise exception 'SHIFT_FULL';
    end if;
    update ish.applications set status = 'confirmed', decided_at = now()
    where id = p_application returning * into v_app;
    perform ish.notify(v_app.worker_id, 'application_confirmed',
      jsonb_build_object('application_id', v_app.id, 'shift_id', v_shift.id));
    perform ish.release_waiting_if_full(v_shift.id);
  else
    update ish.applications set status = 'rejected', decided_at = now()
    where id = p_application returning * into v_app;
    perform ish.notify(v_app.worker_id, 'application_rejected',
      jsonb_build_object('application_id', v_app.id, 'shift_id', v_shift.id));
  end if;
  return v_app;
end
$$;

-- 자동 확정: an applicant confirmed at once may take the last place.
create or replace function ish.apply_to_shift(p_shift uuid)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_shift ish.shifts;
  v_app ish.applications;
begin
  -- Until this transaction ends, the same worker's next request waits here,
  -- and then sees this one's application in the checks below.
  perform pg_advisory_xact_lock(hashtextextended('ish.apply:' || v_uid::text, 0));

  if not exists (
    select 1 from ish.worker_profiles where user_id = v_uid and onboarded_at is not null
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found or v_shift.status <> 'open' or not exists (
    select 1 from ish.businesses b where b.id = v_shift.business_id and b.status = 'verified'
  ) then
    raise exception 'SHIFT_CLOSED';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;
  if exists (
    select 1 from ish.business_members m
    where m.business_id = v_shift.business_id and m.user_id = v_uid
  ) then
    raise exception 'OWN_SHIFT';
  end if;
  if exists (
    select 1 from ish.applications
    where shift_id = p_shift and worker_id = v_uid and status not in ('cancelled', 'rejected')
  ) then
    raise exception 'ALREADY_APPLIED';
  end if;
  if exists (
    select 1
    from ish.applications a
    join ish.shifts s on s.id = a.shift_id
    where a.worker_id = v_uid
      and a.status in ('pending', 'confirmed', 'checked_in')
      and tstzrange(s.starts_at, s.ends_at) && tstzrange(v_shift.starts_at, v_shift.ends_at)
  ) then
    raise exception 'TIME_CONFLICT';
  end if;
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    raise exception 'SHIFT_FULL';
  end if;

  insert into ish.applications (shift_id, worker_id, status, decided_at)
  values (
    p_shift, v_uid,
    case when v_shift.auto_confirm then 'confirmed' else 'pending' end::ish.application_status,
    case when v_shift.auto_confirm then now() end
  )
  returning * into v_app;

  perform ish.notify_business(p_shift, 'new_applicant',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid,
                       'auto_confirmed', v_shift.auto_confirm));
  if v_shift.auto_confirm then
    perform ish.release_waiting_if_full(p_shift);
  end if;
  return v_app;
end
$$;

-- BA2: fewer places.
create function ish.shifts_release_when_full()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.release_waiting_if_full(new.id);
  return null;
end $$;

revoke execute on function ish.shifts_release_when_full() from public, anon, authenticated;

create trigger shifts_release_when_full
  after update of slots on ish.shifts
  for each row when (new.slots < old.slots)
  execute function ish.shifts_release_when_full();

-- A worker reads the shifts they applied to (the shift's id, not the
-- application's).
drop policy shifts_read on ish.shifts;
create policy shifts_read on ish.shifts
  for select to authenticated using (
    (status = 'open' and exists (
      select 1 from ish.businesses b where b.id = shifts.business_id and b.status = 'verified'))
    or ish.is_business_member(business_id)
    or exists (select 1 from ish.applications a where a.shift_id = shifts.id and a.worker_id = auth.uid())
  );
