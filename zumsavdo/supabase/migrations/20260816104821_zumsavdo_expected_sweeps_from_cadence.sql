-- Kutilayotgan o'lchov soni qat'iy raqam emas.
--
-- Ilgari u ustun standarti (12) edi va sweep jadvali boshqacha bo'lsa panel
-- "4/12" deb yozardi — ya'ni tizim sog'lom bo'lsa ham nosoz ko'rinardi.
-- Endi u sotuvchining so'nggi kunlardagi haqiqiy ritmidan olinadi.

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
            between from_date - 8 and to_date
  ),
  closing as (
    select distinct on (shop_id, d) shop_id, d, orders_quantity
    from obs
    order by shop_id, d, observed_at desc
  ),
  counted as (
    select shop_id, d, count(distinct sweep_id)::integer as sweeps
    from obs group by 1, 2
  ),
  -- Ritm: so'nggi 7 to'liq kundagi eng ko'p o'lchov soni. Bugungi qisman kun
  -- kutilgan songa ta'sir qilmasligi kerak, shuning uchun u chiqarib tashlanadi.
  cadence as (
    select shop_id, d,
           coalesce(
             max(sweeps) over (partition by shop_id order by d
                               rows between 7 preceding and 1 preceding),
             sweeps
           ) as expected
    from counted
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
           cad.expected,
           pr.avg_price
    from closing c
    left join closing prev on prev.shop_id = c.shop_id and prev.d = c.d - 1
    left join counted cnt  on cnt.shop_id  = c.shop_id and cnt.d  = c.d
    left join cadence cad  on cad.shop_id  = c.shop_id and cad.d  = c.d
    left join priced  pr   on pr.shop_id   = c.shop_id and pr.d   = c.d
    where c.d between from_date and to_date
  )
  insert into zumsavdo.shop_day
        (shop_id, date, orders, orders_certain, avg_price, sweeps, sweeps_expected)
  select shop_id,
         d,
         -- Oldingi kun yakuni yo'q bo'lsa farq hisoblanmaydi: nol yozish
         -- "sotuv bo'lmagan" degan yolg'on javob beradi.
         case when prev_q is null then null
              else greatest(0, (cur_q - prev_q))::integer end,
         prev_q is not null,
         avg_price,
         coalesce(sweeps, 0),
         greatest(coalesce(expected, 1), coalesce(sweeps, 1))
  from computed
  on conflict (shop_id, date) do update
     set orders          = excluded.orders,
         orders_certain  = excluded.orders_certain,
         avg_price       = excluded.avg_price,
         sweeps          = excluded.sweeps,
         sweeps_expected = excluded.sweeps_expected;

  get diagnostics touched = row_count;
  return touched;
end $$;
