-- Xom o'lchovlardan kunlik yig'indi.
--
-- Kun chegarasi Toshkent vaqti bo'yicha: sweep UTC da yoziladi, sotuvchi esa
-- kunni o'z vaqtida ko'radi va yarim tunda sakrab qolgan buyurtma xatoga
-- o'xshab ko'rinadi.

create or replace function zumsavdo.rollup_product_days(from_date date, to_date date)
returns integer
language plpgsql
security definer
set search_path = zumsavdo, public
as $$
declare
  touched integer;
begin
  with obs as (
    select o.product_id,
           (o.observed_at at time zone 'Asia/Tashkent')::date as d,
           o.observed_at,
           o.price, o.discount_percent, o.stock, o.reviews,
           o.buyers_per_week, o.sweep_id
    from zumsavdo.product_observation o
    where (o.observed_at at time zone 'Asia/Tashkent')::date
            between from_date - 1 and to_date
  ),
  closing as (
    select distinct on (product_id, d)
           product_id, d, price, discount_percent, stock, reviews, buyers_per_week
    from obs
    order by product_id, d, observed_at desc
  ),
  -- Qoldiqning ketma-ket o'lchovlar orasidagi pasayishlari.
  --
  -- Faqat pasayish yig'iladi: o'sish — tovar keltirilgani, u sotuv emas.
  -- Kun ichidagi o'lchovlar shuning uchun muhim — kunlik yagona farq
  -- oraliqdagi to'ldirishni yashirib yuboradi.
  steps as (
    select product_id,
           d,
           stock,
           lag(stock) over (partition by product_id order by observed_at) as prev_stock,
           lag(d)     over (partition by product_id order by observed_at) as prev_d
    from obs
  ),
  drops as (
    select product_id, d, sum(greatest(0, prev_stock - stock))::integer as sold
    from steps
    where prev_stock is not null and (prev_d = d or prev_d = d - 1)
    group by 1, 2
  ),
  counted as (
    select product_id, d,
           count(distinct sweep_id) as sweeps,
           max(stock)               as max_stock
    from obs group by 1, 2
  )
  insert into zumsavdo.product_day
        (product_id, date, price, discount_percent, stock, reviews,
         buyers_per_week, sold_units, out_of_stock, sweeps)
  select c.product_id,
         c.d,
         c.price, c.discount_percent, c.stock, c.reviews, c.buyers_per_week,
         dr.sold,
         coalesce(cnt.max_stock, 0) = 0,
         coalesce(cnt.sweeps, 0)
  from closing c
  left join drops   dr  on dr.product_id  = c.product_id and dr.d  = c.d
  left join counted cnt on cnt.product_id = c.product_id and cnt.d = c.d
  where c.d between from_date and to_date
  on conflict (product_id, date) do update
     set price            = excluded.price,
         discount_percent = excluded.discount_percent,
         stock            = excluded.stock,
         reviews          = excluded.reviews,
         buyers_per_week  = excluded.buyers_per_week,
         sold_units       = excluded.sold_units,
         out_of_stock     = excluded.out_of_stock,
         sweeps           = excluded.sweeps;

  get diagnostics touched = row_count;
  return touched;
end $$;


create or replace function zumsavdo.rollup_shop_days(from_date date, to_date date)
returns integer
language plpgsql
security definer
set search_path = zumsavdo, public
as $$
declare
  touched integer;
begin
  with obs as (
    select o.shop_id,
           (o.observed_at at time zone 'Asia/Tashkent')::date as d,
           o.observed_at,
           o.orders_quantity,
           o.sweep_id
    from zumsavdo.shop_observation o
    where (o.observed_at at time zone 'Asia/Tashkent')::date
            between from_date - 1 and to_date
  ),
  -- Kunning oxirgi o'lchovi: kümülativ hisoblagichning kun yakunidagi holati.
  closing as (
    select distinct on (shop_id, d) shop_id, d, orders_quantity
    from obs
    order by shop_id, d, observed_at desc
  ),
  counted as (
    select shop_id, d, count(distinct sweep_id) as sweeps
    from obs group by 1, 2
  ),
  priced as (
    select p.shop_id, pd.date as d, avg(pd.price)::bigint as avg_price
    from zumsavdo.product_day pd
    join zumsavdo.product p on p.id = pd.product_id
    where pd.date between from_date and to_date and pd.price is not null
    group by 1, 2
  ),
  computed as (
    select c.shop_id,
           c.d,
           prev.orders_quantity as prev_q,
           c.orders_quantity    as cur_q,
           cnt.sweeps,
           pr.avg_price
    from closing c
    left join closing prev on prev.shop_id = c.shop_id and prev.d = c.d - 1
    left join counted cnt  on cnt.shop_id  = c.shop_id and cnt.d  = c.d
    left join priced  pr   on pr.shop_id   = c.shop_id and pr.d   = c.d
    where c.d between from_date and to_date
  )
  insert into zumsavdo.shop_day
        (shop_id, date, orders, orders_certain, avg_price, sweeps)
  select shop_id,
         d,
         -- Oldingi kun yakuni yo'q bo'lsa farq hisoblanmaydi: nol yozish
         -- "sotuv bo'lmagan" degan yolg'on javob beradi.
         case when prev_q is null then null
              else greatest(0, (cur_q - prev_q))::integer end,
         prev_q is not null,
         avg_price,
         coalesce(sweeps, 0)
  from computed
  on conflict (shop_id, date) do update
     set orders         = excluded.orders,
         orders_certain = excluded.orders_certain,
         avg_price      = excluded.avg_price,
         sweeps         = excluded.sweeps;

  get diagnostics touched = row_count;
  return touched;
end $$;


-- Mahsulot avval yig'iladi: sotuvchining o'rtacha narxi mahsulot kunlariga
-- tayanadi.
create or replace function zumsavdo.rollup_days(from_date date, to_date date)
returns table (product_rows integer, shop_rows integer)
language plpgsql
security definer
set search_path = zumsavdo, public
as $$
begin
  product_rows := zumsavdo.rollup_product_days(from_date, to_date);
  shop_rows    := zumsavdo.rollup_shop_days(from_date, to_date);
  return next;
end $$;

grant execute on function zumsavdo.rollup_days(date, date)         to service_role;
grant execute on function zumsavdo.rollup_shop_days(date, date)    to service_role;
grant execute on function zumsavdo.rollup_product_days(date, date) to service_role;
