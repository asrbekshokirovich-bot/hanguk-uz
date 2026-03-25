-- Drop existing RLS policies on student_budgets
DROP POLICY IF EXISTS "Staff can view all student budgets" ON public.student_budgets;
DROP POLICY IF EXISTS "Staff can insert student budgets" ON public.student_budgets;
DROP POLICY IF EXISTS "Staff can update student budgets" ON public.student_budgets;
DROP POLICY IF EXISTS "Staff can delete student budgets" ON public.student_budgets;

-- Create new RLS policies - Owner only access
CREATE POLICY "Owners can view all student budgets"
ON public.student_budgets
FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert student budgets"
ON public.student_budgets
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update student budgets"
ON public.student_budgets
FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete student budgets"
ON public.student_budgets
FOR DELETE
USING (public.has_role(auth.uid(), 'owner'));

-- Also restrict payments table to owners only
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can update payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can create payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can update own payments" ON public.payments;

CREATE POLICY "Owners can view all payments"
ON public.payments
FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert payments"
ON public.payments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update payments"
ON public.payments
FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete payments"
ON public.payments
FOR DELETE
USING (public.has_role(auth.uid(), 'owner'));

-- Restrict payment_transactions to owners only
DROP POLICY IF EXISTS "Staff can view payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can insert payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can view all payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can create payment transactions" ON public.payment_transactions;

CREATE POLICY "Owners can view all payment transactions"
ON public.payment_transactions
FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert payment transactions"
ON public.payment_transactions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update payment transactions"
ON public.payment_transactions
FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete payment transactions"
ON public.payment_transactions
FOR DELETE
USING (public.has_role(auth.uid(), 'owner'));

-- Restrict scheduled_payments to owners only
DROP POLICY IF EXISTS "Staff can view scheduled payments" ON public.scheduled_payments;
DROP POLICY IF EXISTS "Staff can insert scheduled payments" ON public.scheduled_payments;
DROP POLICY IF EXISTS "Staff can update scheduled payments" ON public.scheduled_payments;
DROP POLICY IF EXISTS "Staff can view all scheduled payments" ON public.scheduled_payments;
DROP POLICY IF EXISTS "Staff can create scheduled payments" ON public.scheduled_payments;

CREATE POLICY "Owners can view all scheduled payments"
ON public.scheduled_payments
FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert scheduled payments"
ON public.scheduled_payments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update scheduled payments"
ON public.scheduled_payments
FOR UPDATE
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete scheduled payments"
ON public.scheduled_payments
FOR DELETE
USING (public.has_role(auth.uid(), 'owner'));