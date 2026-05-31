-- Phase 3: append-only audit log of every finance mutation,
-- with AFTER triggers on the 5 most important tables.
--
-- Already applied to the Hanguk 2026 Supabase project on 2026-05-23.

CREATE TABLE public.finance_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text         NOT NULL,
  row_id      uuid         NOT NULL,
  op          text         NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  changed_by  uuid,
  changed_at  timestamptz  NOT NULL DEFAULT now(),
  before      jsonb,
  after       jsonb
);

CREATE INDEX finance_audit_log_table_row_idx
  ON public.finance_audit_log (table_name, row_id, changed_at DESC);
CREATE INDEX finance_audit_log_changed_at_idx
  ON public.finance_audit_log (changed_at DESC);

ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view finance audit log"
  ON public.finance_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.finance_audit_log_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_id := (to_jsonb(OLD) ->> 'id')::uuid;
  ELSE
    v_row_id := (to_jsonb(NEW) ->> 'id')::uuid;
  END IF;

  INSERT INTO public.finance_audit_log (table_name, row_id, op, changed_by, before, after)
  VALUES (
    TG_TABLE_NAME,
    v_row_id,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finance_audit_log_fn() FROM PUBLIC;

CREATE TRIGGER finance_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_log_fn();

CREATE TRIGGER finance_audit_payment_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_log_fn();

CREATE TRIGGER finance_audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_log_fn();

CREATE TRIGGER finance_audit_income_distributions
  AFTER INSERT OR UPDATE OR DELETE ON public.income_distributions
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_log_fn();

CREATE TRIGGER finance_audit_operational_fund_allocations
  AFTER INSERT OR UPDATE OR DELETE ON public.operational_fund_allocations
  FOR EACH ROW EXECUTE FUNCTION public.finance_audit_log_fn();
