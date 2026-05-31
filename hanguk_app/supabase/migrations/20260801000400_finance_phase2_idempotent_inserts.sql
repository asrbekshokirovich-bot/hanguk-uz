-- Phase 2 (server-side equivalent): make every "create" the finance
-- frontend issues idempotent. BEFORE INSERT triggers convert a
-- duplicate INSERT into an UPDATE of the existing row, so the
-- Lovable admin keeps working without code changes.
--
-- Already applied to the Hanguk 2026 Supabase project on 2026-05-23.

-- ---------------------------------------------------------------
-- payments.initial_deposit: one per (student, application)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payments_idempotent_initial_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE existing_id uuid;
BEGIN
  IF NEW.payment_type <> 'initial_deposit' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_id
    FROM public.payments
   WHERE student_id = NEW.student_id
     AND COALESCE(application_id::text,'') = COALESCE(NEW.application_id::text,'')
     AND payment_type = 'initial_deposit'
   LIMIT 1;

  IF existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.payments
     SET amount      = NEW.amount,
         currency    = NEW.currency,
         due_date    = COALESCE(NEW.due_date, due_date),
         notes       = COALESCE(NEW.notes, notes),
         updated_at  = now()
   WHERE id = existing_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER payments_idempotent_initial_deposit
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_idempotent_initial_deposit();

-- ---------------------------------------------------------------
-- expenses: one gateway-fee row per linked transaction
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expenses_idempotent_gateway_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.linked_transaction_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.expenses
     WHERE linked_transaction_id = NEW.linked_transaction_id
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER expenses_idempotent_gateway_fee
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_idempotent_gateway_fee();

-- ---------------------------------------------------------------
-- income_distribution_settings: singleton per (recipient_name, type)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.idist_settings_idempotent_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id
    FROM public.income_distribution_settings
   WHERE recipient_name = NEW.recipient_name
     AND recipient_type = NEW.recipient_type
   LIMIT 1;

  IF existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.income_distribution_settings
     SET percentage = NEW.percentage,
         is_active  = NEW.is_active,
         updated_at = now()
   WHERE id = existing_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER idist_settings_idempotent_upsert
  BEFORE INSERT ON public.income_distribution_settings
  FOR EACH ROW EXECUTE FUNCTION public.idist_settings_idempotent_upsert();

-- ---------------------------------------------------------------
-- monthly_payment_categories: singleton per (name, category_type)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mpc_idempotent_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id
    FROM public.monthly_payment_categories
   WHERE name = NEW.name
     AND category_type = NEW.category_type
   LIMIT 1;

  IF existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.monthly_payment_categories
     SET amount         = NEW.amount,
         currency       = NEW.currency,
         recipient_name = NEW.recipient_name,
         is_active      = NEW.is_active,
         notes          = COALESCE(NEW.notes, notes),
         updated_at     = now()
   WHERE id = existing_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER mpc_idempotent_upsert
  BEFORE INSERT ON public.monthly_payment_categories
  FOR EACH ROW EXECUTE FUNCTION public.mpc_idempotent_upsert();

-- ---------------------------------------------------------------
-- operational_fund_allocations: one per (student, category, month)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ofa_idempotent_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE existing_id uuid;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_id
    FROM public.operational_fund_allocations
   WHERE student_id       = NEW.student_id
     AND category_id      = NEW.category_id
     AND allocation_month = NEW.allocation_month
   LIMIT 1;

  IF existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.operational_fund_allocations
     SET allocated_amount = NEW.allocated_amount,
         payment_id       = COALESCE(NEW.payment_id, payment_id),
         status           = NEW.status
   WHERE id = existing_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER ofa_idempotent_upsert
  BEFORE INSERT ON public.operational_fund_allocations
  FOR EACH ROW EXECUTE FUNCTION public.ofa_idempotent_upsert();

-- ---------------------------------------------------------------
-- operational_fund_settings: singleton table
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.op_fund_settings_idempotent_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM public.operational_fund_settings LIMIT 1;

  IF existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.operational_fund_settings
     SET amount_per_student = NEW.amount_per_student,
         currency           = NEW.currency,
         updated_by         = NEW.updated_by,
         updated_at         = now()
   WHERE id = existing_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER op_fund_settings_idempotent_upsert
  BEFORE INSERT ON public.operational_fund_settings
  FOR EACH ROW EXECUTE FUNCTION public.op_fund_settings_idempotent_upsert();
