-- Hanguk Ish — puyl, the worker's points (2026-11-20; the «10-qadam» design).
--
-- A worker spends puyl (P) to open the phone and the exact address of a job
-- Hanguk's staff offered them; the job is then theirs (…_ish_puyl_offers.sql).
-- Puyl comes from a card payment in the app (to come), or from the staff (the
-- CRM «Coinlar»). Spent puyl does not come back. The app holds no money,
-- only this count; every move is a row of the ledger the worker sees.

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
  reason text not null check (reason in ('staff', 'unlock', 'topup', 'bonus')),
  application_id uuid references ish.applications (id) on delete set null,
  staff_id uuid references ish.profiles (id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index coin_ledger_worker_idx on ish.coin_ledger (worker_id, seq desc);

comment on table ish.coin_wallets is 'Puyl of a worker (Profil). Changed only through ish.coin_move: opening a job, top-ups, the staff.';
comment on table ish.coin_ledger is 'Every coin move, with the balance after it: what A11 «Tarix» and the CRM show.';

-- What opening the job cost (0: not opened with puyl).
alter table ish.applications
  add column coins_paid smallint not null default 0 check (coins_paid >= 0);

alter table ish.coin_wallets enable row level security;
alter table ish.coin_ledger enable row level security;
create policy coin_wallets_own on ish.coin_wallets for select to authenticated using (worker_id = auth.uid());
create policy coin_ledger_own on ish.coin_ledger for select to authenticated using (worker_id = auth.uid());
revoke all on ish.coin_wallets, ish.coin_ledger from public, anon, authenticated;
grant select on ish.coin_wallets, ish.coin_ledger to authenticated;

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

-- Profil: the balance and the last moves.
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
