-- Application fee payments: per-student, per-university fee records staff log
-- when a student pays a university's application fee.
--
-- Deliberately its own table, not an extension of `applications` (that's a
-- visa-document pipeline, stage-based, one row per student+university) or of
-- `payments` (contract/tuition billing with statuses and schedules). This is
-- a flat ledger: one row per payment made — a student can pay several
-- universities, and the same university more than once.

CREATE TABLE public.application_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  intake_id uuid REFERENCES public.intakes(id),
  amount_krw numeric NOT NULL CHECK (amount_krw > 0),
  receipt_url text,
  receipt_file_name text,
  created_by uuid REFERENCES public.profiles(user_id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_fee_payments IS
  'Per-student, per-university application fee payments (amount in KRW + receipt file). Independent of the applications pipeline and the payments/contract ledger.';

CREATE INDEX application_fee_payments_student_idx ON public.application_fee_payments (student_id);
CREATE INDEX application_fee_payments_institution_idx ON public.application_fee_payments (institution_id);
CREATE INDEX application_fee_payments_intake_idx ON public.application_fee_payments (intake_id);

ALTER TABLE public.application_fee_payments ENABLE ROW LEVEL SECURITY;

-- Same "who" as the university catalog's Excel upload: owner, admin, or
-- document_handler. Centralized in one function like can_edit_university_catalog().
CREATE OR REPLACE FUNCTION public.can_edit_application_fees()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'document_handler');
$$;

REVOKE ALL ON FUNCTION public.can_edit_application_fees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_application_fees() TO authenticated;

CREATE POLICY application_fee_payments_read ON public.application_fee_payments
  FOR SELECT TO authenticated
  USING (public.can_edit_application_fees());

CREATE POLICY application_fee_payments_write ON public.application_fee_payments
  FOR ALL TO authenticated
  USING (public.can_edit_application_fees())
  WITH CHECK (public.can_edit_application_fees());

-- Stamp the default intake when the app doesn't set one, and auto-enroll the
-- student into that intake's roster — same convention `applications` /
-- `documents` / `payments` already follow (set_default_intake /
-- ensure_student_intake are generic triggers, reused as-is here).
CREATE TRIGGER trg_set_default_intake BEFORE INSERT ON public.application_fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_default_intake();

CREATE TRIGGER trg_ensure_student_intake AFTER INSERT ON public.application_fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.ensure_student_intake();

CREATE OR REPLACE FUNCTION public.touch_application_fee_payments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_touch_application_fee_payments BEFORE UPDATE ON public.application_fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_application_fee_payments_updated_at();
