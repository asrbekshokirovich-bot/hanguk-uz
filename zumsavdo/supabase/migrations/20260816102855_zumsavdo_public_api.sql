-- ZumSavdo ning tashqi yuzasi.
--
-- Ma'lumot `zumsavdo` sxemasida turadi, chunki bu bazada boshqa loyihaning
-- jadvallari ham bor va ular aralashib ketmasligi kerak. PostgREST esa faqat
-- `public` ni ko'radi, shuning uchun o'qish ko'rinishlar orqali, yozish esa
-- bitta funksiya orqali ochiladi.

create or replace view public.zs_category as
  select id, name, parent_id from zumsavdo.category;

create or replace view public.zs_shop as
  select id, name, category_id, official from zumsavdo.shop;

create or replace view public.zs_product as
  select id, title, shop_id, category_id from zumsavdo.product;

create or replace view public.zs_sweep as
  select id, source, started_at, finished_at, targets, captured, errors, note
  from zumsavdo.sweep;

create or replace view public.zs_shop_day as
  select shop_id, date, orders, orders_certain, avg_price, sweeps, sweeps_expected
  from zumsavdo.shop_day;

create or replace view public.zs_product_day as
  select product_id, date, price, discount_percent, stock, reviews,
         buyers_per_week, sold_units, out_of_stock, sweeps
  from zumsavdo.product_day;

grant select on public.zs_category, public.zs_shop, public.zs_product,
                public.zs_sweep, public.zs_shop_day, public.zs_product_day
  to anon, authenticated;

create or replace function public.zs_open_sweep(p_source text, p_note text default null)
returns bigint
language sql
security definer
set search_path = zumsavdo, public
as $$
  insert into zumsavdo.sweep (source, note) values (p_source, p_note) returning id;
$$;

create or replace function public.zs_close_sweep(
  p_sweep_id bigint,
  p_targets integer,
  p_captured integer,
  p_errors integer,
  p_note text default null
) returns void
language sql
security definer
set search_path = zumsavdo, public
as $$
  update zumsavdo.sweep
     set finished_at = now(),
         targets = p_targets,
         captured = p_captured,
         errors = p_errors,
         note = coalesce(p_note, note)
   where id = p_sweep_id;
$$;

-- Bitta partiyani yozadi: lug'atlar avval (o'lchovlar ularga bog'langan),
-- keyin xom o'lchovlar. Takroriy chaqiruv xavfsiz — kalit (sweep_id, obyekt).
create or replace function public.zs_ingest_batch(p_sweep_id bigint, p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = zumsavdo, public
as $$
declare
  written integer := 0;
  n integer;
begin
  insert into zumsavdo.category (id, name, parent_id, updated_at)
  select x.id, x.name, x."parentId", now()
  from jsonb_to_recordset(coalesce(p_payload->'categories', '[]'::jsonb))
       as x(id bigint, name text, "parentId" bigint)
  on conflict (id) do update
     set name = excluded.name,
         parent_id = coalesce(excluded.parent_id, zumsavdo.category.parent_id),
         updated_at = now();

  insert into zumsavdo.shop (id, name, category_id, official, updated_at)
  select x.id, x.name, x."categoryId", coalesce(x.official, false), now()
  from jsonb_to_recordset(coalesce(p_payload->'shops', '[]'::jsonb))
       as x(id bigint, name text, "categoryId" bigint, official boolean)
  on conflict (id) do update
     set name = excluded.name,
         category_id = coalesce(excluded.category_id, zumsavdo.shop.category_id),
         official = excluded.official,
         updated_at = now();

  insert into zumsavdo.product (id, title, shop_id, category_id, updated_at)
  select x.id, x.title, x."shopId", x."categoryId", now()
  from jsonb_to_recordset(coalesce(p_payload->'products', '[]'::jsonb))
       as x(id bigint, title text, "shopId" bigint, "categoryId" bigint)
  on conflict (id) do update
     set title = excluded.title,
         shop_id = coalesce(excluded.shop_id, zumsavdo.product.shop_id),
         category_id = coalesce(excluded.category_id, zumsavdo.product.category_id),
         updated_at = now();

  insert into zumsavdo.shop_observation
        (sweep_id, shop_id, observed_at, orders_quantity, reviews, rating)
  select p_sweep_id, x."shopId", x."observedAt", x."ordersQuantity", x.reviews, x.rating
  from jsonb_to_recordset(coalesce(p_payload->'shopObservations', '[]'::jsonb))
       as x("shopId" bigint, "observedAt" timestamptz, "ordersQuantity" bigint,
            reviews bigint, rating numeric)
  on conflict (sweep_id, shop_id) do update
     set observed_at = excluded.observed_at,
         orders_quantity = excluded.orders_quantity,
         reviews = excluded.reviews,
         rating = excluded.rating;
  get diagnostics n = row_count;
  written := written + n;

  insert into zumsavdo.product_observation
        (sweep_id, product_id, observed_at, price, full_price, discount_percent,
         stock, reviews, rating, buyers_per_week, available)
  select p_sweep_id, x."productId", x."observedAt", x.price, x."fullPrice",
         x."discountPercent", x.stock, x.reviews, x.rating, x."buyersPerWeek",
         x.available
  from jsonb_to_recordset(coalesce(p_payload->'productObservations', '[]'::jsonb))
       as x("productId" bigint, "observedAt" timestamptz, price bigint,
            "fullPrice" bigint, "discountPercent" integer, stock integer,
            reviews integer, rating numeric, "buyersPerWeek" integer,
            available boolean)
  on conflict (sweep_id, product_id) do update
     set observed_at = excluded.observed_at,
         price = excluded.price,
         full_price = excluded.full_price,
         discount_percent = excluded.discount_percent,
         stock = excluded.stock,
         reviews = excluded.reviews,
         rating = excluded.rating,
         buyers_per_week = excluded.buyers_per_week,
         available = excluded.available;
  get diagnostics n = row_count;
  written := written + n;

  return written;
end $$;

create or replace function public.zs_rollup_days(from_date date, to_date date)
returns table (product_rows integer, shop_rows integer)
language sql
security definer
set search_path = zumsavdo, public
as $$
  select * from zumsavdo.rollup_days(from_date, to_date);
$$;

-- Yozish faqat service role uchun; anon bu funksiyalarni chaqira olmaydi.
revoke all on function public.zs_open_sweep(text, text)                       from public, anon, authenticated;
revoke all on function public.zs_close_sweep(bigint, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.zs_ingest_batch(bigint, jsonb)                  from public, anon, authenticated;
revoke all on function public.zs_rollup_days(date, date)                      from public, anon, authenticated;

grant execute on function public.zs_open_sweep(text, text)                       to service_role;
grant execute on function public.zs_close_sweep(bigint, integer, integer, integer, text) to service_role;
grant execute on function public.zs_ingest_batch(bigint, jsonb)                  to service_role;
grant execute on function public.zs_rollup_days(date, date)                      to service_role;
