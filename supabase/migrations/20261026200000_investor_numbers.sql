-- Investor portal numbers (audit 2026-10-26, Asrbek: "ana shularni tuzat").
--
--  1. Season revenue counts only money received INSIDE the season window
--     (intakes.starts_on .. ends_on). February–June payments that were moved
--     onto this season (free re-applications) no longer inflate it.
--     Each transfer counts on its own paid_on date when the account's
--     transfers add up to paid_amount; otherwise (legacy accounts, refunds)
--     the whole paid_amount counts on paid_at, as before.
--  2. P&L revenue lines are the tariff (Standart / Premium / No Risk ...),
--     not payment_type, which is "initial_deposit" on every row.
--  3. "Converted" = students signed this season with an active contract;
--     conversion_pct = that / leads. Only 3 leads carried status 'converted'.
--  4. v_investor_plan_revenue gains active_collected / active_students
--     (cancelled contracts excluded): "average revenue per student" is now
--     this season's money divided by the active students who paid it.
--  5. A season appears in the investor's switcher once it has started.
--
-- Expenses are untouched here: their values are a data fix, done separately.

-- 1. Revenue events, one row per money-in, inside the season window.
create or replace view public.v_investor_revenue_events as
with acct as (
  select p.id, p.intake_id, p.student_id, p.currency, p.paid_amount, p.paid_at,
         coalesce(pr.payment_plan, 'unknown') as plan,
         (select sum(t.amount) from public.payment_transactions t where t.payment_id = p.id) as tx_sum
    from public.payments p
    join public.profiles pr on pr.user_id = p.student_id
   where p.intake_id is not null
     and p.status = any (array['completed', 'partial'])
     and not pr.is_demo
), ev as (
  select a.id as payment_id, a.intake_id, a.student_id, a.currency, a.plan,
         t.paid_on as paid_on, t.amount
    from acct a
    join public.payment_transactions t on t.payment_id = a.id
   where a.tx_sum is not null and abs(a.tx_sum - coalesce(a.paid_amount, 0)) < 0.01
  union all
  select a.id, a.intake_id, a.student_id, a.currency, a.plan,
         (a.paid_at at time zone 'Asia/Tashkent')::date, a.paid_amount
    from acct a
   where a.paid_at is not null
     and (a.tx_sum is null or abs(a.tx_sum - coalesce(a.paid_amount, 0)) >= 0.01)
)
select ev.*,
       exists (select 1 from public.student_intakes si
                where si.student_id = ev.student_id and si.intake_id = ev.intake_id
                  and si.contract_cancelled_at is not null) as contract_cancelled
  from ev
  join public.intakes ik on ik.id = ev.intake_id
 where (ik.starts_on is null or ev.paid_on >= ik.starts_on)
   and (ik.ends_on is null or ev.paid_on <= ik.ends_on)
   and coalesce(ev.amount, 0) <> 0;

-- Internal building block only.
revoke all on public.v_investor_revenue_events from public, anon, authenticated;

-- Same columns as before; revenue and discounts now come from the window.
create or replace view public.v_investor_season_monthly as
 WITH months AS (
         SELECT i.id AS intake_id, i.currency, i.month,
            sum(i.revenue) AS revenue, sum(i.expenses) AS expenses, sum(i.discounts_given) AS discounts_given
           FROM ( SELECT e.intake_id AS id, e.currency,
                    (date_trunc('month', e.paid_on::timestamp))::date AS month,
                    e.amount AS revenue, 0::numeric AS expenses, 0::numeric AS discounts_given
                   FROM v_investor_revenue_events e
                UNION ALL
                 SELECT ik.id, x.currency,
                    (date_trunc('month', (x.expense_date)::timestamp with time zone))::date,
                    0::numeric, x.amount, 0::numeric
                   FROM expenses x
                     JOIN intakes ik ON ik.starts_on IS NOT NULL AND ik.ends_on IS NOT NULL
                                    AND x.expense_date >= ik.starts_on AND x.expense_date <= ik.ends_on
                UNION ALL
                 SELECT p.intake_id, p.currency,
                    (date_trunc('month', p.paid_at))::date,
                    0::numeric, 0::numeric, (p.list_amount - p.amount)
                   FROM payments p
                     JOIN intakes ik ON ik.id = p.intake_id
                  WHERE p.paid_at IS NOT NULL AND p.status = ANY (ARRAY['completed','partial'])
                    AND p.list_amount IS NOT NULL
                    AND (ik.starts_on IS NULL OR (p.paid_at AT TIME ZONE 'Asia/Tashkent')::date >= ik.starts_on)
                    AND (ik.ends_on IS NULL OR (p.paid_at AT TIME ZONE 'Asia/Tashkent')::date <= ik.ends_on)) i
          GROUP BY i.id, i.currency, i.month
        )
 SELECT intake_id, month, currency, revenue, expenses,
    (revenue - expenses) AS net,
        CASE WHEN revenue > 0 THEN round(((revenue - expenses) * 100.0) / revenue, 1) ELSE NULL::numeric END AS margin_pct,
    discounts_given
   FROM months m
  WHERE investor_can_view_intake(intake_id);

-- 2. P&L: revenue lines by tariff, inside the window.
create or replace view public.v_investor_season_pnl as
 WITH rev AS (
         SELECT e.intake_id, e.currency, 'revenue'::text AS side,
            e.plan AS line_item, sum(e.amount) AS amount
           FROM v_investor_revenue_events e
          GROUP BY e.intake_id, e.currency, e.plan
        ), exp AS (
         SELECT i.id AS intake_id, e.currency, 'expense'::text AS side,
            COALESCE(NULLIF(e.category, ''), 'other') AS line_item, sum(e.amount) AS amount
           FROM expenses e
             JOIN intakes i ON i.starts_on IS NOT NULL AND i.ends_on IS NOT NULL
                           AND e.expense_date >= i.starts_on AND e.expense_date <= i.ends_on
          GROUP BY i.id, e.currency, COALESCE(NULLIF(e.category, ''), 'other')
        ), disc AS (
         SELECT p.intake_id, p.currency, 'discount'::text AS side,
            'discount_given'::text AS line_item, sum(p.list_amount - p.amount) AS amount
           FROM payments p
             JOIN intakes ik ON ik.id = p.intake_id
          WHERE p.paid_at IS NOT NULL AND p.status = ANY (ARRAY['completed','partial'])
            AND p.list_amount IS NOT NULL
            AND (ik.starts_on IS NULL OR (p.paid_at AT TIME ZONE 'Asia/Tashkent')::date >= ik.starts_on)
            AND (ik.ends_on IS NULL OR (p.paid_at AT TIME ZONE 'Asia/Tashkent')::date <= ik.ends_on)
          GROUP BY p.intake_id, p.currency
        ), lines AS (
         SELECT * FROM rev UNION ALL SELECT * FROM exp UNION ALL SELECT * FROM disc
        ), totals AS (
         SELECT intake_id, currency,
            COALESCE(sum(amount) FILTER (WHERE side = 'revenue'), 0::numeric) AS revenue_total
           FROM lines GROUP BY intake_id, currency
        )
 SELECT l.intake_id, l.currency, l.side, l.line_item, l.amount,
        CASE WHEN t.revenue_total > 0 THEN round((l.amount * 100.0) / t.revenue_total, 1) ELSE NULL::numeric END AS pct_of_revenue
   FROM lines l
     JOIN totals t ON t.intake_id = l.intake_id AND t.currency = l.currency
  WHERE investor_can_view_intake(l.intake_id);

-- 3. Conversion = active signed students / leads.
create or replace view public.v_investor_season_leads as
 SELECT ik.id AS intake_id,
    count(l.id) AS total_leads,
    count(*) FILTER (WHERE l.status = 'new') AS new_leads,
    count(*) FILTER (WHERE l.status = 'contacted') AS contacted_leads,
    count(*) FILTER (WHERE l.status = 'qualified') AS qualified_leads,
    (SELECT count(*) FROM student_intakes si JOIN profiles p ON p.user_id = si.student_id
      WHERE si.intake_id = ik.id AND NOT p.is_demo AND si.contract_cancelled_at IS NULL) AS converted_leads,
    count(*) FILTER (WHERE l.status = 'lost') AS lost_leads,
    count(*) FILTER (WHERE l.created_at >= (now() - '30 days'::interval)) AS leads_last_30_days,
        CASE WHEN count(l.id) = 0 THEN NULL::numeric
             ELSE round(((SELECT count(*) FROM student_intakes si JOIN profiles p ON p.user_id = si.student_id
                           WHERE si.intake_id = ik.id AND NOT p.is_demo AND si.contract_cancelled_at IS NULL)::numeric * 100.0)
                        / count(l.id)::numeric, 1)
        END AS conversion_pct
   FROM intakes ik
     LEFT JOIN leads l ON l.intake_id = ik.id
  WHERE investor_can_view_intake(ik.id)
  GROUP BY ik.id;

-- 4. Plan revenue from the same window, plus active-contract money.
create or replace view public.v_investor_plan_revenue as
with col as (
  select e.intake_id, e.plan, e.currency,
         count(distinct e.student_id) as students,
         sum(e.amount) as collected,
         coalesce(sum(e.amount) filter (where not e.contract_cancelled), 0) as active_collected,
         count(distinct e.student_id) filter (where not e.contract_cancelled) as active_students
    from public.v_investor_revenue_events e
   group by e.intake_id, e.plan, e.currency
), owed as (
  select p.intake_id, coalesce(pr.payment_plan, 'unknown') as plan, p.currency,
         sum(greatest(p.amount - coalesce(p.paid_amount, 0), 0)) as outstanding
    from public.payments p
    join public.profiles pr on pr.user_id = p.student_id
   where p.intake_id is not null and p.status <> 'refunded' and not pr.is_demo
   group by 1, 2, 3
)
select coalesce(c.intake_id, o.intake_id) as intake_id,
       coalesce(c.plan, o.plan) as plan,
       coalesce(c.currency, o.currency) as currency,
       coalesce(c.students, 0) as students,
       coalesce(c.collected, 0) as collected,
       coalesce(o.outstanding, 0) as outstanding,
       coalesce(c.active_collected, 0) as active_collected,
       coalesce(c.active_students, 0) as active_students
  from col c
  full join owed o on o.intake_id = c.intake_id and o.plan = c.plan and o.currency = c.currency
 where public.investor_can_view_intake(coalesce(c.intake_id, o.intake_id));

revoke all on public.v_investor_plan_revenue from public, anon;
grant select on public.v_investor_plan_revenue to authenticated;

-- 5. Only seasons that have started.
create or replace view public.v_investor_intakes as
 SELECT id AS intake_id, season, year,
    ((((year)::text || ' '::text) || initcap(season)) || ' Intake'::text) AS label,
    is_default, is_open, starts_on, ends_on,
    intake_sort_key(season, year) AS sort_key
   FROM intakes i
  WHERE investor_can_view_intake(id)
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE);
