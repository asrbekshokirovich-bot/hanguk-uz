-- Investor revenue = the semester's money, whenever it was paid.
--
-- Asrbek (2026-10-27): "mavsum daromadi" means the semester (intake), not a
-- date window. 20261026200000 limited revenue to intakes.starts_on..ends_on;
-- this removes that limit (variant A): every completed/partial payment on the
-- intake counts, including free re-applicants' money moved onto it.
-- Each transfer still counts on its own paid_on date (for the monthly chart),
-- legacy accounts on paid_at. Expenses stay inside the season's dates.

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
 where coalesce(ev.amount, 0) <> 0;

revoke all on public.v_investor_revenue_events from public, anon, authenticated;

-- Discounts follow the semester as well (expenses stay date-bound).
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
                  WHERE p.paid_at IS NOT NULL AND p.status = ANY (ARRAY['completed','partial'])
                    AND p.intake_id IS NOT NULL AND p.list_amount IS NOT NULL) i
          GROUP BY i.id, i.currency, i.month
        )
 SELECT intake_id, month, currency, revenue, expenses,
    (revenue - expenses) AS net,
        CASE WHEN revenue > 0 THEN round(((revenue - expenses) * 100.0) / revenue, 1) ELSE NULL::numeric END AS margin_pct,
    discounts_given
   FROM months m
  WHERE investor_can_view_intake(intake_id);

-- P&L: revenue lines by tariff; discounts for the whole semester too.
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
          WHERE p.paid_at IS NOT NULL AND p.status = ANY (ARRAY['completed','partial'])
            AND p.intake_id IS NOT NULL AND p.list_amount IS NOT NULL
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

