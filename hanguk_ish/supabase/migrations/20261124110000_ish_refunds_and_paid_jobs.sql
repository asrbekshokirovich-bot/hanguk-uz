-- Hanguk Ish: pyol refunds and the rules after a worker paid.
--
-- Refunds (all pyols back, reason 'refund' in coin_ledger, once per job):
--   * the employer cancels the job (cancel_shift), or the staff cancel a
--     job they keep (staff_cancel_shift, new);
--   * the staff find the job was worse than shown (staff_refund_unlock, new);
--   * the worker cancels 12 hours or more before the start.
-- No refund when the worker cancels later than that, or does not come.
-- The late-cancel line moves from 24 to 12 hours to match.
--
-- After a worker paid, the employer cannot lower the pay or change the
-- place or the time of the job (HAS_PAID_WORKER).
--
-- When a job fills by any path, the offers still waiting close.
-- Old offers without an end time get one (created_at + 30 minutes).

alter table ish.coin_ledger drop constraint coin_ledger_reason_check;
alter table ish.coin_ledger add constraint coin_ledger_reason_check
  check (reason in ('staff', 'unlock', 'topup', 'bonus', 'refund'));

-- Gives back what was paid for one job; false if nothing to give back.
create or replace function ish.refund_unlock(p_application uuid, p_why text)
returns boolean
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_app ish.applications;
begin
  select * into v_app from ish.applications where id = p_application for update;
  if not found or v_app.coins_paid <= 0 then
    return false;
  end if;
  if exists (select 1 from ish.coin_ledger where application_id = p_application and reason = 'refund') then
    return false;
  end if;
  perform ish.coin_move(v_app.worker_id, v_app.coins_paid, 'refund', p_application, null,
                        left(coalesce(p_why, ''), 300));
  return true;
end
$$;
revoke execute on function ish.refund_unlock(uuid, text) from public, anon, authenticated;

-- Employer cancels: everyone who paid gets the pyols back.
create or replace function ish.cancel_shift(p_shift uuid)
returns ish.shifts
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_shift ish.shifts;
  r record;
begin
  perform ish.require_uid();
  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found or not ish.is_business_member(v_shift.business_id) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.cancel_shift_now(p_shift, 'shift_cancelled');
end
$$;

-- The common part of cancelling (owner or staff).
create or replace function ish.cancel_shift_now(p_shift uuid, p_reason text)
returns ish.shifts
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_shift ish.shifts;
  r record;
begin
  select * into v_shift from ish.shifts where id = p_shift for update;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;
  update ish.shifts set status = 'cancelled' where id = p_shift returning * into v_shift;
  update ish.job_offers set status = 'closed' where shift_id = p_shift and status = 'sent';
  for r in
    update ish.applications set status = 'rejected', decided_at = now()
    where shift_id = p_shift and status in ('pending', 'confirmed')
    returning id, worker_id, coins_paid
  loop
    insert into ish.notifications (user_id, kind, data)
    values (r.worker_id, 'application_rejected',
            jsonb_build_object('application_id', r.id, 'shift_id', p_shift, 'reason', p_reason,
                               'refunded', case when r.coins_paid > 0 then r.coins_paid end));
    perform ish.refund_unlock(r.id, p_reason);
  end loop;
  return v_shift;
end
$$;
revoke execute on function ish.cancel_shift_now(uuid, text) from public, anon, authenticated;

-- The staff cancel a job they keep (the employer called it off).
create or replace function ish.staff_cancel_shift(p_shift uuid)
returns ish.shifts
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  if not exists (select 1 from ish.shifts s join ish.businesses b on b.id = s.business_id
                 where s.id = p_shift and b.managed_by_staff) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.cancel_shift_now(p_shift, 'shift_cancelled');
end
$$;
revoke execute on function ish.staff_cancel_shift(uuid) from public, anon;
grant execute on function ish.staff_cancel_shift(uuid) to authenticated;

-- The staff checked: the job was worse than shown (pay, hours, place).
create or replace function ish.staff_refund_unlock(p_application uuid, p_note text)
returns boolean
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from ish.applications where id = p_application) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.refund_unlock(p_application, 'worse than shown: ' || btrim(p_note));
end
$$;
revoke execute on function ish.staff_refund_unlock(uuid, text) from public, anon;
grant execute on function ish.staff_refund_unlock(uuid, text) to authenticated;

-- Worker cancels: 12 hours or more before → refund; later → late, no refund.
create or replace function ish.cancel_application(p_application uuid)
returns ish.applications
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
  v_app ish.applications;
  v_shift ish.shifts;
  v_late boolean;
begin
  select * into v_app from ish.applications
  where id = p_application and worker_id = v_uid
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_shift from ish.shifts where id = v_app.shift_id for update;
  if v_app.status not in ('pending', 'confirmed') then
    raise exception 'CANNOT_CANCEL';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'SHIFT_STARTED';
  end if;

  v_late := v_app.status = 'confirmed' and v_shift.starts_at - now() < interval '12 hours';
  update ish.applications
  set status = 'cancelled', cancelled_at = now(), late_cancel = v_late
  where id = p_application
  returning * into v_app;

  if v_late then
    update ish.worker_profiles
    set reliability = greatest(0, reliability - 5)
    where user_id = v_uid;
  else
    perform ish.refund_unlock(v_app.id, 'cancelled 12+ hours before');
  end if;
  perform ish.notify_business(v_shift.id, 'worker_cancelled',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid, 'late', v_late));
  return v_app;
end
$$;

-- "My jobs": paid jobs stay, also when cancelled (with the refund shown).
create or replace function ish.my_jobs()
returns jsonb
language sql
stable
security definer
set search_path = ish
as $$
  select coalesce(jsonb_agg(ish.my_job_card(a.id) order by a.created_at desc), '[]'::jsonb)
  from ish.applications a
  where a.worker_id = auth.uid() and a.coins_paid > 0
$$;

-- Full by any path: the waiting applicants and the open offers close.
create or replace function ish.release_waiting_if_full(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  if ish.confirmed_count(p_shift) < (select slots from ish.shifts where id = p_shift) then
    return;
  end if;
  update ish.job_offers set status = 'closed' where shift_id = p_shift and status = 'sent';
  with closed as (
    update ish.applications set status = 'rejected', decided_at = now()
    where shift_id = p_shift and status = 'pending'
    returning id, worker_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'application_rejected',
         jsonb_build_object('application_id', id, 'shift_id', p_shift, 'reason', 'full')
  from closed;
end
$$;

-- The guard on job edits: once a worker paid, the deal stays as shown.
create or replace function ish.shifts_guard()
returns trigger
language plpgsql
set search_path = ish
as $$
declare
  v_taken int;
begin
  if current_user <> 'authenticated' and current_setting('ish.staff_edit', true) is distinct from 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from ish.businesses b where b.id = new.business_id and b.status = 'verified'
    ) then
      raise exception 'BUSINESS_NOT_VERIFIED';
    end if;
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
    end if;
    if current_setting('ish.staff_edit', true) is distinct from 'on' and (
      select count(*) from ish.shifts s
      where s.business_id = new.business_id and s.created_at > now() - interval '24 hours'
    ) >= 30 then
      raise exception 'TOO_MANY_REQUESTS';
    end if;
    return new;
  end if;
  if old.status <> 'open' then
    raise exception 'SHIFT_CLOSED';
  end if;
  if old.ends_at <= now() then
    raise exception 'SHIFT_ENDED';
  end if;
  select count(*)::int into v_taken from ish.applications
  where shift_id = old.id and status in ('confirmed', 'checked_in', 'completed');
  if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) then
    if v_taken > 0 then
      raise exception 'HAS_CREW';
    end if;
    if new.starts_at <= now() then
      raise exception 'IN_THE_PAST';
    end if;
  end if;
  if new.slots < v_taken then
    raise exception 'SLOTS_BELOW_CREW';
  end if;
  if exists (select 1 from ish.applications a
             where a.shift_id = old.id and a.coins_paid > 0
               and a.status in ('confirmed', 'checked_in', 'completed'))
     and (new.hourly_wage < old.hourly_wage
          or coalesce(new.total_pay, 0) < coalesce(old.total_pay, 0)
          or new.address is distinct from old.address
          or new.lat is distinct from old.lat
          or new.lng is distinct from old.lng) then
    raise exception 'HAS_PAID_WORKER';
  end if;
  return new;
end
$$;

-- Old offers without an end time.
update ish.job_offers set expires_at = created_at + interval '30 minutes' where expires_at is null;
alter table ish.job_offers alter column expires_at set not null;
alter table ish.job_offers alter column expires_at set default now() + interval '30 minutes';
