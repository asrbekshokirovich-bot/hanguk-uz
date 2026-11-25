-- Hanguk Ish: buying puyl in the app through Google Play / App Store
-- in-app purchase (Davrbek, 2026-11-25; replaces the Telegram bot idea).
--
-- The app buys a consumable product (puyl_30 / puyl_100 / puyl_300) with
-- the store's own payment sheet (card, Google Pay, Apple Pay …). The
-- function ish-iap checks the purchase with Google / Apple and calls
-- iap_credit: one transaction, one credit (the store's id is unique here),
-- so a replayed or forged receipt gives nothing. The puyl come at once, with
-- the usual «+100 puyl» notice. The stores keep their share (15 % for small
-- developers); price_won is what the worker paid.

create table ish.store_purchases (
  id uuid primary key default gen_random_uuid(),
  store text not null check (store in ('google', 'apple')),
  -- Google: the order id (GPA.…); Apple: the original transaction id.
  transaction_id text not null check (char_length(transaction_id) between 1 and 200),
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  product_id text not null,
  pyols integer not null check (pyols > 0),
  price_won integer not null check (price_won >= 0),
  -- 'revoked': refunded by the store (the puyl are taken back if still there).
  status text not null default 'credited' check (status in ('credited', 'revoked')),
  created_at timestamptz not null default now(),
  unique (store, transaction_id)
);
create index store_purchases_worker_idx on ish.store_purchases (worker_id, created_at desc);
alter table ish.store_purchases enable row level security;
revoke all on ish.store_purchases from public, anon, authenticated;

-- The products the stores sell (their ids in Play Console / App Store Connect).
create or replace function ish.store_products()
returns jsonb
language sql
immutable
as $$
  select '[{"id": "puyl_30", "pyols": 30, "won": 3300},
           {"id": "puyl_100", "pyols": 100, "won": 9900},
           {"id": "puyl_300", "pyols": 300, "won": 24000}]'::jsonb
$$;
grant execute on function ish.store_products() to authenticated;

-- A purchase the store confirmed: the puyl, once per store transaction.
-- Only ish-iap (service role) calls it.
create or replace function ish.iap_credit(p_worker uuid, p_store text, p_transaction text, p_product text)
returns jsonb
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_product jsonb;
  v_id uuid;
  v_balance int;
begin
  select p into v_product from jsonb_array_elements(ish.store_products()) p where p ->> 'id' = p_product;
  if v_product is null or p_store not in ('google', 'apple') or coalesce(btrim(p_transaction), '') = '' then
    raise exception 'INVALID';
  end if;
  if not exists (select 1 from ish.worker_profiles where user_id = p_worker) then
    raise exception 'NOT_FOUND';
  end if;
  insert into ish.store_purchases (store, transaction_id, worker_id, product_id, pyols, price_won)
  values (p_store, btrim(p_transaction), p_worker, p_product, (v_product ->> 'pyols')::int, (v_product ->> 'won')::int)
  on conflict (store, transaction_id) do nothing
  returning id into v_id;
  if v_id is null then
    -- Already credited (a retry): nothing more. Another worker's receipt: refused.
    if exists (select 1 from ish.store_purchases where store = p_store and transaction_id = btrim(p_transaction)
               and worker_id <> p_worker) then
      raise exception 'NOT_YOURS';
    end if;
    select balance into v_balance from ish.coin_wallets where worker_id = p_worker;
    return jsonb_build_object('credited', false, 'balance', coalesce(v_balance, 0));
  end if;
  v_balance := ish.coin_move(p_worker, (v_product ->> 'pyols')::int, 'topup', null, null,
                             'store:' || p_store || ':' || p_product);
  return jsonb_build_object('credited', true, 'pyols', (v_product ->> 'pyols')::int, 'balance', v_balance);
end
$$;
revoke execute on function ish.iap_credit(uuid, text, text, text) from public, anon, authenticated;

-- The report counts store sales with the bank transfers.
create or replace function ish.staff_pyol_report(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ish
as $$
begin
  perform ish.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'day', d, 'sold', sold, 'sold_won', sold_won, 'free', free, 'gift', gift,
      'refunded', refunded, 'spent', spent) order by d desc)
    from (
      select l.d, l.sold, t.sold_won, l.free, l.gift, l.refunded, l.spent
      from (
        select (created_at at time zone 'Asia/Seoul')::date as d,
               sum(delta) filter (where reason = 'topup') as sold,
               sum(delta) filter (where reason = 'bonus') as free,
               sum(delta) filter (where reason = 'staff') as gift,
               sum(delta) filter (where reason = 'refund') as refunded,
               -sum(delta) filter (where reason = 'unlock') as spent
        from ish.coin_ledger
        where created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 366)))
        group by 1) l
      left join (
        select d, sum(won)::int as sold_won from (
          select (decided_at at time zone 'Asia/Seoul')::date as d, amount_won as won
          from ish.topup_requests where status = 'approved'
          union all
          select (created_at at time zone 'Asia/Seoul')::date, price_won
          from ish.store_purchases where status = 'credited') s
        group by 1) t on t.d = l.d) x), '[]'::jsonb);
end
$$;
