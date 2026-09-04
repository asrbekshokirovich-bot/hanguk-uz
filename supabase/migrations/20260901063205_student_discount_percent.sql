-- Per-student discount (sale %) — season-scoped, mirrors is_free_reapplication
-- (see 20260803120000_free_reapplication_flag.sql for the precedent: billing
-- modifiers live on student_intakes, not profiles, so multi-season students
-- don't carry a stale discount into a season it wasn't agreed for).

ALTER TABLE public.student_intakes
  ADD COLUMN discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 100);

COMMENT ON COLUMN public.student_intakes.discount_percent IS
  'Sale/discount percentage (0-100) applied to this student''s plan price for this season. 0 = no discount.';

CREATE INDEX idx_student_intakes_discount_percent
  ON public.student_intakes (student_id, intake_id)
  WHERE discount_percent > 0;
