-- ZumSavdo — o'lchov ombori.
--
-- Ikki qatlam ajratilgan:
--   *_observation — bitta sweepda ko'rilgan xom holat (kümülativ hisoblagichlar);
--   *_day         — kunlik yig'indi, o'lchovlardan hisoblangan.
--
-- Ajratishning sababi: buyurtma soni Uzumda kümülativ hisoblagich sifatida
-- keladi, kunlik son esa ikki o'lchov farqi. Farqning ishonchliligi kun
-- chegarasidagi o'lchov bor-yo'qligiga bog'liq, shuning uchun u alohida
-- ustunda (orders_certain) saqlanadi va hech qachon taxmin bilan to'ldirilmaydi.

create schema if not exists zumsavdo;

create table if not exists zumsavdo.category (
  id            bigint primary key,
  name          text        not null,
  parent_id     bigint      references zumsavdo.category(id),
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists zumsavdo.shop (
  id            bigint primary key,
  name          text        not null,
  category_id   bigint      references zumsavdo.category(id),
  official      boolean     not null default false,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists zumsavdo.product (
  id            bigint primary key,
  title         text        not null,
  shop_id       bigint      references zumsavdo.shop(id),
  category_id   bigint      references zumsavdo.category(id),
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists product_shop_idx     on zumsavdo.product (shop_id);
create index if not exists product_category_idx on zumsavdo.product (category_id);
create index if not exists shop_category_idx    on zumsavdo.shop (category_id);

-- Bitta yig'ish sessiyasi. Qamrov va xato soni shu yerdan o'qiladi —
-- panelning yuqorisidagi holat satri aynan shu jadvalga tayanadi.
create table if not exists zumsavdo.sweep (
  id          bigserial primary key,
  source      text        not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  targets     integer     not null default 0,
  captured    integer     not null default 0,
  errors      integer     not null default 0,
  note        text
);

create index if not exists sweep_started_idx on zumsavdo.sweep (started_at desc);

create table if not exists zumsavdo.shop_observation (
  sweep_id        bigint      not null references zumsavdo.sweep(id) on delete cascade,
  shop_id         bigint      not null references zumsavdo.shop(id),
  observed_at     timestamptz not null,
  -- Shop.ordersQuantity — kümülativ, hech qachon kamaymaydi.
  orders_quantity bigint,
  reviews         bigint,
  rating          numeric(3,2),
  primary key (sweep_id, shop_id)
);

create index if not exists shop_obs_time_idx on zumsavdo.shop_observation (shop_id, observed_at desc);

create table if not exists zumsavdo.product_observation (
  sweep_id         bigint      not null references zumsavdo.sweep(id) on delete cascade,
  product_id       bigint      not null references zumsavdo.product(id),
  observed_at      timestamptz not null,
  price            bigint,
  full_price       bigint,
  discount_percent integer,
  stock            integer,
  reviews          integer,
  rating           numeric(3,2),
  -- MotivationAction.text dan olingan odam soni — doim 7 kunlik oyna.
  buyers_per_week  integer,
  available        boolean,
  primary key (sweep_id, product_id)
);

create index if not exists product_obs_time_idx on zumsavdo.product_observation (product_id, observed_at desc);

create table if not exists zumsavdo.shop_day (
  shop_id         bigint  not null references zumsavdo.shop(id),
  date            date    not null,
  -- Ikki o'lchov farqi. orders_certain false bo'lsa, bu raqam to'liq kunni
  -- qamramaydi va interfeysda aniq deb ko'rsatilmaydi.
  orders          integer,
  orders_certain  boolean not null default false,
  avg_price       bigint,
  sweeps          integer not null default 0,
  sweeps_expected integer not null default 12,
  primary key (shop_id, date)
);

create index if not exists shop_day_date_idx on zumsavdo.shop_day (date);

create table if not exists zumsavdo.product_day (
  product_id       bigint  not null references zumsavdo.product(id),
  date             date    not null,
  price            bigint,
  discount_percent integer,
  stock            integer,
  reviews          integer,
  buyers_per_week  integer,
  -- Qoldiq kamayishidan hisoblangan — TAXMINIY. Oraliqda tovar keltirilsa,
  -- sotuvning bir qismi bu raqamga tushmaydi.
  sold_units       integer,
  out_of_stock     boolean not null default false,
  sweeps           integer not null default 0,
  primary key (product_id, date)
);

create index if not exists product_day_date_idx on zumsavdo.product_day (date);

-- Bozor ma'lumoti ochiq o'qiladi; yozish faqat service role bilan (u RLS dan
-- o'tib ketadi), shuning uchun anon uchun faqat select siyosati beriladi.
do $$
declare t text;
begin
  foreach t in array array[
    'category','shop','product','sweep',
    'shop_observation','product_observation','shop_day','product_day'
  ] loop
    execute format('alter table zumsavdo.%I enable row level security', t);
    execute format('drop policy if exists %I on zumsavdo.%I', 'read_' || t, t);
    execute format('create policy %I on zumsavdo.%I for select using (true)', 'read_' || t, t);
  end loop;
end $$;

grant usage on schema zumsavdo to anon, authenticated, service_role;
grant select on all tables in schema zumsavdo to anon, authenticated;
grant all on all tables in schema zumsavdo to service_role;
grant all on all sequences in schema zumsavdo to service_role;
alter default privileges in schema zumsavdo grant select on tables to anon, authenticated;
