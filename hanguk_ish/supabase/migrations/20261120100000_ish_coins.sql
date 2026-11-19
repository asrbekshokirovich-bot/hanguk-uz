-- Hanguk Ish — coins for applying (2026-11-20).
--
-- A worker pays coins to apply for a shift (the price is ish.coin_settings,
-- 1 coin to start). Only Hanguk's staff add coins (the CRM: the worker pays
-- Hanguk outside the app) — the app holds no money, only this count.
--
-- Fair to the worker, as workers in Korea would expect:
--   · a job Hanguk's staff offered them is free;
--   · the coin comes back when the business turns the application down, when
--     the shift is cancelled or the application runs out (all: rejected);
--   · when the worker cancels, it comes back while the application still
--     waits, or more than 24 hours before the start; a late cancel of a
--     confirmed place keeps it (as the −5 reliability does), a no-show too.
-- Every move is a row of the ledger the worker sees in A11 (and the staff).

create table ish.coin_settings (
  id boolean primary key default true check (id),
  apply_cost int not null default 1 check (apply_cost between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into ish.coin_settings default values;

create table ish.coin_wallets (
  worker_id uuid primary key references ish.profiles (id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table ish.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  -- The order of the moves (several can share a moment: one transaction).
  seq bigint generated always as identity,
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  delta int not null check (delta <> 0),
  -- The balance after this move.
  balance int not null check (balance >= 0),
  reason text not null check (reason in ('staff', 'apply', 'refund')),
  application_id uuid references ish.applications (id) on delete set null,
  staff_id uuid references ish.profiles (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index coin_ledger_worker_idx on ish.coin_ledger (worker_id, seq desc);

comment on table ish.coin_wallets is 'Coins of a worker (A11). Changed only through ish.coin_move: applying, refunds, the staff.';
comment on table ish.coin_ledger is 'Every coin move, with the balance after it: what A11 «Tarix» and the CRM show.';

-- What the application cost (0: free or before coins); a refund sets it to 0.
alter table ish.applications
  add column coins_paid smallint not null default 0 check (coins_paid >= 0);

alter table ish.coin_settings enable row level security;
alter table ish.coin_wallets enable row level security;
alter table ish.coin_ledger enable row level security;
create policy coin_settings_read on ish.coin_settings for select to authenticated using (true);
create policy coin_wallets_own on ish.coin_wallets for select to authenticated using (worker_id = auth.uid());
create policy coin_ledger_own on ish.coin_ledger for select to authenticated using (worker_id = auth.uid());
revoke all on ish.coin_settings, ish.coin_wallets, ish.coin_ledger from public, anon, authenticated;
grant select on ish.coin_settings, ish.coin_wallets, ish.coin_ledger to authenticated;

-- The one way coins move: the wallet and its ledger row together. A move
-- that would go below zero: NO_COINS.
create function ish.coin_move(
  p_worker uuid, p_delta int, p_reason text, p_application uuid, p_staff uuid, p_note text)
returns int
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_balance int;
begin
  insert into ish.coin_wallets (worker_id) values (p_worker) on conflict do nothing;
  update ish.coin_wallets set balance = balance + p_delta, updated_at = now()
  where worker_id = p_worker and balance + p_delta >= 0
  returning balance into v_balance;
  if v_balance is null then
    raise exception 'NO_COINS';
  end if;
  insert into ish.coin_ledger (worker_id, delta, balance, reason, application_id, staff_id, note)
  values (p_worker, p_delta, v_balance, p_reason, p_application, p_staff, coalesce(p_note, ''));
  return v_balance;
end
$$;
revoke execute on function ish.coin_move(uuid, int, text, uuid, uuid, text) from public, anon, authenticated;

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
  v_cost int;
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
  ) or (v_shift.invite_only and not exists (
    select 1 from ish.job_offers o where o.shift_id = p_shift and o.worker_id = v_uid
  )) then
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

  -- Coins (2026-11-20): an application costs the set price; a job Hanguk's
  -- staff offered this worker is free. Too few coins: NO_COINS, nothing done.
  select coalesce(max(apply_cost), 0) into v_cost from ish.coin_settings;
  if exists (select 1 from ish.job_offers o where o.shift_id = p_shift and o.worker_id = v_uid) then
    v_cost := 0;
  end if;

  insert into ish.applications (shift_id, worker_id, status, decided_at, coins_paid)
  values (
    p_shift, v_uid,
    case when v_shift.auto_confirm then 'confirmed' else 'pending' end::ish.application_status,
    case when v_shift.auto_confirm then now() end,
    v_cost
  )
  returning * into v_app;
  if v_cost > 0 then
    perform ish.coin_move(v_uid, -v_cost, 'apply', v_app.id, null, '');
  end if;

  update ish.job_offers set status = 'applied', responded_at = now()
  where shift_id = p_shift and worker_id = v_uid;

  perform ish.notify_business(p_shift, 'new_applicant',
    jsonb_build_object('application_id', v_app.id, 'worker_id', v_uid,
                       'auto_confirmed', v_shift.auto_confirm));
  if v_shift.auto_confirm then
    perform ish.release_waiting_if_full(p_shift);
  end if;
  return v_app;
end
$$;

-- The coin comes back (see the top of this file).
create function ish.applications_coin_refund()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if new.status = 'rejected'
     or (new.status = 'cancelled'
         and (old.status = 'pending'
              or (select s.starts_at from ish.shifts s where s.id = new.shift_id) > now() + interval '24 hours')) then
    perform ish.coin_move(new.worker_id, old.coins_paid, 'refund', new.id, null, '');
    new.coins_paid := 0;
  end if;
  return new;
end
$$;
revoke execute on function ish.applications_coin_refund() from public, anon, authenticated;

create trigger applications_coin_refund before update of status on ish.applications
  for each row when (old.status is distinct from new.status and old.coins_paid > 0)
  execute function ish.applications_coin_refund();

-- A11: the balance, the price of an application and the last moves.
create function ish.my_coins(p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_uid uuid := ish.require_uid();
begin
  return jsonb_build_object(
    'balance', coalesce((select balance from ish.coin_wallets where worker_id = v_uid), 0),
    'cost', coalesce((select apply_cost from ish.coin_settings), 0),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'delta', l.delta, 'balance', l.balance, 'reason', l.reason, 'note', l.note,
               'created_at', l.created_at, 'shift_title', s.title)
             order by l.seq desc)
      from (
        select * from ish.coin_ledger where worker_id = v_uid
        order by seq desc
        limit greatest(1, least(coalesce(p_limit, 30), 100))
      ) l
      left join ish.applications a on a.id = l.application_id
      left join ish.shifts s on s.id = a.shift_id
    ), '[]'::jsonb));
end
$$;
revoke execute on function ish.my_coins(int) from public, anon;
grant execute on function ish.my_coins(int) to authenticated;

-- CRM «Coinlar»: workers by name or phone (all, newest first, when empty),
-- each with the balance and the last moves.
create function ish.staff_coin_workers(p_query text default '', p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id, 'first_name', w.first_name, 'last_name', w.last_name, 'phone', w.phone,
             'balance', w.balance,
             'history', coalesce((
               select jsonb_agg(jsonb_build_object('delta', l.delta, 'balance', l.balance, 'reason', l.reason,
                                                   'note', l.note, 'created_at', l.created_at)
                                order by l.seq desc)
               from (select * from ish.coin_ledger where worker_id = w.id
                     order by seq desc limit 5) l), '[]'::jsonb))
           order by w.created_at desc, w.id)
    from (
      select p.id, p.first_name, p.last_name, p.phone, p.created_at,
             coalesce(cw.balance, 0) as balance
      from ish.profiles p
      join ish.worker_profiles wp on wp.user_id = p.id
      left join ish.coin_wallets cw on cw.worker_id = p.id
      where v_q = ''
         or lower(p.first_name || ' ' || p.last_name) like '%' || v_q || '%'
         or (v_digits <> '' and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits || '%')
      order by p.created_at desc, p.id
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) w
  ), '[]'::jsonb);
end
$$;
revoke execute on function ish.staff_coin_workers(text, int) from public, anon;
grant execute on function ish.staff_coin_workers(text, int) to authenticated;

-- CRM: the staff add (or take back) coins; the new balance. NO_COINS when it
-- would go below zero, NOT_FOUND for someone who is not a worker.
create function ish.staff_add_coins(p_worker uuid, p_delta int, p_note text default '')
returns int
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  if p_delta is null or p_delta = 0 or p_delta not between -1000 and 1000
     or char_length(coalesce(p_note, '')) > 300 then
    raise exception 'INVALID';
  end if;
  if not exists (select 1 from ish.worker_profiles where user_id = p_worker) then
    raise exception 'NOT_FOUND';
  end if;
  return ish.coin_move(p_worker, p_delta, 'staff', null, auth.uid(), btrim(coalesce(p_note, '')));
end
$$;
revoke execute on function ish.staff_add_coins(uuid, int, text) from public, anon;
grant execute on function ish.staff_add_coins(uuid, int, text) to authenticated;
