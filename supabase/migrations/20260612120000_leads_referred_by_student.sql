-- Lead referral source: which STUDENT recommended this lead.
-- This is distinct from `assigned_to` (the staff member who owns the lead).
-- Nullable — referrals are optional and may be filled later (manually or by AI).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referred_by_student_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_referred_by_student_id
  ON public.leads (referred_by_student_id);

COMMENT ON COLUMN public.leads.referred_by_student_id IS
  'The student (profiles.user_id) whose recommendation this lead came from. NULL if no referral.';
