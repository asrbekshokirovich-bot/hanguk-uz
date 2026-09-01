-- Investor P&L "discounts given" line (informational only).
--
-- payments.amount is already stored net of any per-student discount (see
-- 20260901063205_student_discount_percent.sql), so v_investor_season_pnl's
-- revenue (SUM(paid_amount)) is already the discounted figure — correct, but
-- it gives investors no way to see that a discount was applied at all.
--
-- Rather than re-deriving list prices in SQL from the frontend's PAYMENT_PLANS
-- constants (a third copy of the price table the plan explicitly warned
-- against), the client snapshots the undiscounted list price directly on the
-- payment row at write time, using the exact same helper that computed the
-- discounted `amount`. NULL means no discount was applied (amount == list).
ALTER TABLE public.payments
  ADD COLUMN list_amount NUMERIC(10,2);

COMMENT ON COLUMN public.payments.list_amount IS
  'Undiscounted plan price for this installment, set only when a discount was applied at write time (amount = discounted, list_amount = undiscounted). NULL means no discount was applied.';

-- v_investor_season_pnl: add a 'discount' side alongside the existing
-- 'revenue'/'expense' sides. It is a NEW set of rows (UNION branch), not a
-- change to existing columns, and revenue_total (the pct_of_revenue
-- denominator) is still computed only from side='revenue' rows — so this is
-- purely additive and does not change any existing revenue/expense/pct figure.
CREATE OR REPLACE VIEW public.v_investor_season_pnl AS
WITH rev AS (
  SELECT p.intake_id,
     p.currency,
     'revenue'::text AS side,
     COALESCE(NULLIF(p.payment_type, ''::text), 'other'::text) AS line_item,
     sum(p.paid_amount) AS amount
   FROM payments p
  WHERE p.paid_at IS NOT NULL AND (p.status = ANY (ARRAY['completed'::text, 'partial'::text])) AND p.intake_id IS NOT NULL
  GROUP BY p.intake_id, p.currency, 'revenue'::text, (COALESCE(NULLIF(p.payment_type, ''::text), 'other'::text))
), exp AS (
  SELECT i.id AS intake_id,
     e.currency,
     'expense'::text AS side,
     COALESCE(NULLIF(e.category, ''::text), 'other'::text) AS line_item,
     sum(e.amount) AS amount
   FROM expenses e
     JOIN intakes i ON i.starts_on IS NOT NULL AND i.ends_on IS NOT NULL AND e.expense_date >= i.starts_on AND e.expense_date <= i.ends_on
  GROUP BY i.id, e.currency, 'expense'::text, (COALESCE(NULLIF(e.category, ''::text), 'other'::text))
), disc AS (
  SELECT p.intake_id,
     p.currency,
     'discount'::text AS side,
     'discount_given'::text AS line_item,
     sum(p.list_amount - p.amount) AS amount
   FROM payments p
  WHERE p.paid_at IS NOT NULL AND (p.status = ANY (ARRAY['completed'::text, 'partial'::text])) AND p.intake_id IS NOT NULL AND p.list_amount IS NOT NULL
  GROUP BY p.intake_id, p.currency
), lines AS (
  SELECT rev.intake_id, rev.currency, rev.side, rev.line_item, rev.amount FROM rev
  UNION ALL
  SELECT exp.intake_id, exp.currency, exp.side, exp.line_item, exp.amount FROM exp
  UNION ALL
  SELECT disc.intake_id, disc.currency, disc.side, disc.line_item, disc.amount FROM disc
), totals AS (
  SELECT lines.intake_id,
     lines.currency,
     COALESCE(sum(lines.amount) FILTER (WHERE lines.side = 'revenue'::text), 0::numeric) AS revenue_total
   FROM lines
  GROUP BY lines.intake_id, lines.currency
)
SELECT l.intake_id,
    l.currency,
    l.side,
    l.line_item,
    l.amount,
        CASE
            WHEN t.revenue_total > 0::numeric THEN round(l.amount * 100.0 / t.revenue_total, 1)
            ELSE NULL::numeric
        END AS pct_of_revenue
   FROM lines l
     JOIN totals t ON t.intake_id = l.intake_id AND t.currency = l.currency
  WHERE investor_can_view_intake(l.intake_id);

-- v_investor_season_monthly: append discounts_given at the END of the column
-- list (CREATE OR REPLACE VIEW requires existing columns to keep their name,
-- order and type — only new trailing columns are allowed). revenue/expenses/
-- net/margin_pct are untouched.
CREATE OR REPLACE VIEW public.v_investor_season_monthly AS
WITH months AS (
  SELECT i.id AS intake_id,
     i.currency,
     i.month,
     sum(i.revenue) AS revenue,
     sum(i.expenses) AS expenses,
     sum(i.discounts_given) AS discounts_given
   FROM ( SELECT ik.id,
            p.currency,
            date_trunc('month'::text, p.paid_at)::date AS month,
            p.paid_amount AS revenue,
            0::numeric AS expenses,
            0::numeric AS discounts_given
           FROM payments p
             JOIN intakes ik ON ik.id = p.intake_id
          WHERE p.paid_at IS NOT NULL AND (p.status = ANY (ARRAY['completed'::text, 'partial'::text]))
        UNION ALL
         SELECT ik.id,
            e.currency,
            date_trunc('month'::text, e.expense_date::timestamp with time zone)::date AS month,
            0::numeric AS revenue,
            e.amount,
            0::numeric AS discounts_given
           FROM expenses e
             JOIN intakes ik ON ik.starts_on IS NOT NULL AND ik.ends_on IS NOT NULL AND e.expense_date >= ik.starts_on AND e.expense_date <= ik.ends_on
        UNION ALL
         SELECT p.intake_id AS id,
            p.currency,
            date_trunc('month'::text, p.paid_at)::date AS month,
            0::numeric AS revenue,
            0::numeric AS expenses,
            (p.list_amount - p.amount) AS discounts_given
           FROM payments p
          WHERE p.paid_at IS NOT NULL AND (p.status = ANY (ARRAY['completed'::text, 'partial'::text])) AND p.intake_id IS NOT NULL AND p.list_amount IS NOT NULL) i
  GROUP BY i.id, i.currency, i.month
)
SELECT intake_id,
    month,
    currency,
    revenue,
    expenses,
    revenue - expenses AS net,
        CASE
            WHEN revenue > 0::numeric THEN round((revenue - expenses) * 100.0 / revenue, 1)
            ELSE NULL::numeric
        END AS margin_pct,
    discounts_given
   FROM months m
  WHERE investor_can_view_intake(intake_id);

-- v_investor_position: append season_discounts_given at the END of the
-- column list, after profit_share. profit_share is still
-- season_net_profit * equity_percent / 100 — unaffected.
CREATE OR REPLACE VIEW public.v_investor_position AS
SELECT inv.id AS investor_id,
    inv.full_name,
    inv.equity_percent,
    inv.invested_amount_usd,
    inv.invested_at,
    m.intake_id,
    m.currency,
    sum(m.revenue) AS season_revenue,
    sum(m.expenses) AS season_expenses,
    sum(m.net) AS season_net_profit,
    round(sum(m.net) * inv.equity_percent / 100.0, 2) AS profit_share,
    sum(m.discounts_given) AS season_discounts_given
   FROM investors inv
     JOIN v_investor_season_monthly m ON true
  WHERE inv.is_active AND (inv.user_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role))
  GROUP BY inv.id, inv.full_name, inv.equity_percent, inv.invested_amount_usd, inv.invested_at, m.intake_id, m.currency;
