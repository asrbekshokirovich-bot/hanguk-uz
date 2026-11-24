-- Hanguk Ish: notification review (2026-11-24).
--
-- 1. Job offers sent at night lived only 30 minutes: a worker asleep at
--    23:00 (when the staff match free days) lost every offer. Now an offer
--    for a job that starts later lives longer: until 2 hours before the
--    start, at most 12 hours, at least 30 minutes. The staff may also choose
--    the minutes (p_minutes, 15 to 1 440).
-- 2. The worker was never told when puyl came in: a top-up approved, the
--    monthly free puyl, the invite reward, a gift or a refund. Now a
--    'coins_added' notice (and push). A rejected top-up sends
--    'topup_rejected'. The sign-up bonus is seen in the app at once (no
--    notice), and a refund for a cancelled job is already in its
--    «cancelled» notice (data.refunded).

alter table ish.notifications drop constraint notifications_kind_check;
alter table ish.notifications add constraint notifications_kind_check check (kind in (
  'shift_reminder', 'application_confirmed', 'application_rejected', 'new_shift_match', 'nearby_digest',
  'new_applicant', 'worker_cancelled', 'no_show', 'request_again', 'chat_message', 'payment_marked',
  'job_offer', 'shift_finished', 'coins_added', 'topup_rejected'));

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
                    'shift_finished', 'coins_added', 'topup_rejected') then 'worker'
  end
$$;

-- ---------------------------------------------------------------------
-- 1. How long an offer lives.
-- ---------------------------------------------------------------------
create or replace function ish.offer_expires_at(p_starts_at timestamptz, p_minutes integer default null)
returns timestamptz
language sql
stable
as $$
  select case
    when p_minutes is not null then now() + make_interval(mins => p_minutes)
    else greatest(now() + interval '30 minutes',
                  least(p_starts_at - interval '2 hours', now() + interval '12 hours'))
  end
$$;
revoke execute on function ish.offer_expires_at(timestamptz, integer) from public, anon, authenticated;

alter table ish.job_offers alter column expires_at set default now() + interval '30 minutes';

drop function ish.staff_send_offers(uuid, uuid[], text);
create function ish.staff_send_offers(p_shift uuid, p_workers uuid[], p_note text default '',
                                      p_minutes integer default null)
returns integer
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_staff();
  v_shift ish.shifts;
  v_live int;
  v_count int;
  v_expires timestamptz;
begin
  select * into v_shift from ish.shifts where id = p_shift for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_shift.status <> 'open' or v_shift.starts_at <= now() then
    raise exception 'SHIFT_CLOSED';
  end if;
  if not v_shift.invite_only then
    raise exception 'NOT_INVITE_ONLY';
  end if;
  if exists (select 1 from ish.businesses b
             left join ish.business_contacts c on c.business_id = b.id
             where b.id = v_shift.business_id and b.managed_by_staff
               and coalesce(btrim(c.phone), '') = '') then
    raise exception 'NO_CONTACT_PHONE';
  end if;
  if ish.confirmed_count(p_shift) >= v_shift.slots then
    raise exception 'SHIFT_FULL';
  end if;
  if char_length(coalesce(btrim(p_note), '')) > 300
     or (p_minutes is not null and p_minutes not between 15 and 1440) then
    raise exception 'INVALID';
  end if;
  -- Never past the start.
  v_expires := least(ish.offer_expires_at(v_shift.starts_at, p_minutes), v_shift.starts_at);
  select count(*) into v_live from ish.job_offers
  where shift_id = p_shift and status = 'sent' and expires_at > now();
  if v_live + coalesce(cardinality(p_workers), 0) > 4 then
    raise exception 'TOO_MANY';
  end if;
  with sent as (
    insert into ish.job_offers (shift_id, worker_id, sent_by, note, expires_at)
    select p_shift, w.user_id, v_uid, coalesce(btrim(p_note), ''), v_expires
    from ish.worker_profiles w
    where w.user_id = any (p_workers) and w.onboarded_at is not null
      and not exists (select 1 from ish.business_members m
                      where m.business_id = v_shift.business_id and m.user_id = w.user_id)
      and not exists (select 1 from ish.applications a
                      where a.shift_id = p_shift and a.worker_id = w.user_id
                        and a.status not in ('cancelled', 'rejected'))
    on conflict (shift_id, worker_id) do nothing
    returning id, worker_id
  )
  insert into ish.notifications (user_id, kind, data)
  select worker_id, 'job_offer', jsonb_strip_nulls(jsonb_build_object(
           'offer_id', id, 'shift_id', p_shift, 'business_id', v_shift.business_id,
           'expires_at', v_expires,
           'note', nullif(coalesce(btrim(p_note), ''), '')))
  from sent;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke execute on function ish.staff_send_offers(uuid, uuid[], text, integer) from public, anon;
grant execute on function ish.staff_send_offers(uuid, uuid[], text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. «Puyl came in» and «top-up not accepted».
-- ---------------------------------------------------------------------
create or replace function ish.coin_ledger_notify()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_why text;
begin
  if new.delta <= 0 then
    return null;
  end if;
  v_why := case
    when new.reason = 'topup' then 'topup'
    when new.reason = 'bonus' and new.note like 'monthly %' then 'monthly'
    when new.reason = 'bonus' and new.note in ('invited a friend', 'came with a friend''s code') then 'referral'
    when new.reason = 'staff' then 'staff'
    -- A cancelled job says so itself (data.refunded).
    when new.reason = 'refund' and new.note <> 'shift_cancelled' then 'refund'
  end;
  if v_why is not null then
    insert into ish.notifications (user_id, kind, data)
    values (new.worker_id, 'coins_added', jsonb_strip_nulls(jsonb_build_object(
      'delta', new.delta, 'balance', new.balance, 'why', v_why, 'application_id', new.application_id)));
  end if;
  return null;
end
$$;
revoke execute on function ish.coin_ledger_notify() from public, anon, authenticated;
create trigger coin_ledger_notify after insert on ish.coin_ledger
  for each row execute function ish.coin_ledger_notify();

create or replace function ish.topup_requests_notify()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into ish.notifications (user_id, kind, data)
    values (new.worker_id, 'topup_rejected', jsonb_build_object(
      'pyols', new.pyols, 'amount_won', new.amount_won, 'note', new.note));
  end if;
  return null;
end
$$;
revoke execute on function ish.topup_requests_notify() from public, anon, authenticated;
create trigger topup_requests_notify after update of status on ish.topup_requests
  for each row execute function ish.topup_requests_notify();
