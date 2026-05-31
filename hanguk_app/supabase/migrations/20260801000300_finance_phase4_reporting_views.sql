-- Phase 4: reporting views the admin website (and any future
-- dashboard) can read directly instead of re-implementing aggregation
-- on the frontend each time.
--
-- Already applied to the Hanguk 2026 Supabase project on 2026-05-23.

CREATE OR REPLACE VIEW public.v_finance_monthly_pnl
WITH (security_invoker = true)
AS
WITH income AS (
  SELECT date_trunc('month', paid_at)::date AS month,
         currency,
         SUM(paid_amount) AS income
    FROM public.payments
   WHERE status IN ('completed','partial')
     AND paid_at IS NOT NULL
   GROUP BY 1, 2
),
spend AS (
  SELECT date_trunc('month', expense_date)::date AS month,
         currency,
         SUM(amount) AS expenses
    FROM public.expenses
   GROUP BY 1, 2
)
SELECT COALESCE(i.month, s.month)              AS month,
       COALESCE(i.currency, s.currency)        AS currency,
       COALESCE(i.income, 0)                   AS income,
       COALESCE(s.expenses, 0)                 AS expenses,
       COALESCE(i.income, 0) - COALESCE(s.expenses, 0) AS net
  FROM income i
  FULL OUTER JOIN spend s
    ON i.month = s.month
   AND i.currency = s.currency;

CREATE OR REPLACE VIEW public.v_student_balance
WITH (security_invoker = true)
AS
SELECT student_id,
       currency,
       SUM(amount - paid_amount) AS outstanding,
       COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
       MIN(due_date) FILTER (WHERE status IN ('pending','partial','overdue')) AS next_due
  FROM public.payments
 WHERE status IN ('pending','partial','overdue')
 GROUP BY student_id, currency;

GRANT SELECT ON public.v_finance_monthly_pnl TO authenticated;
GRANT SELECT ON public.v_student_balance     TO authenticated;
