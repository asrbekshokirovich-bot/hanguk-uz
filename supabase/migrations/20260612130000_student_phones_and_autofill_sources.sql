-- ============================================================================
-- Student phones (multiple numbers per student) + auto-fill provenance columns
-- ----------------------------------------------------------------------------
-- The add-student dialog now:
--   * accepts MANY phone numbers per student (own, parent, …)
--   * no longer asks for region / birth date / language track — those are
--     filled automatically from the student's passport and certificates (and,
--     for the track, from chat/call conversations) once uploaded.
--
-- The *_source columns record HOW a field was populated so the async auto-fill
-- never clobbers a value a staff member set by hand:
--   manual > certificate > passport > conversation > (default)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- student_phones: one row per number. phone_norm is the canonical key (mirrors
-- normalize_phone() used everywhere else) and is globally unique so a number
-- can only belong to one student — same dedup intent as profiles.phone.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_phones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  phone       text NOT NULL,
  phone_norm  text GENERATED ALWAYS AS (public.normalize_phone(phone)) STORED,
  label       text,                                   -- own | parent | other | free text
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_phones_norm
  ON public.student_phones(phone_norm) WHERE phone_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_phones_student ON public.student_phones(student_id);

DROP TRIGGER IF EXISTS trg_student_phones_updated_at ON public.student_phones;
CREATE TRIGGER trg_student_phones_updated_at
  BEFORE UPDATE ON public.student_phones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view student phones" ON public.student_phones;
CREATE POLICY "Staff can view student phones" ON public.student_phones FOR SELECT
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role) OR has_role(auth.uid(), 'call_operator'::app_role)
  );

DROP POLICY IF EXISTS "Staff can manage student phones" ON public.student_phones;
CREATE POLICY "Staff can manage student phones" ON public.student_phones FOR ALL
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role) OR has_role(auth.uid(), 'call_operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role) OR has_role(auth.uid(), 'call_operator'::app_role)
  );

-- ----------------------------------------------------------------------------
-- Provenance for auto-filled profile fields.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date_source     text,
  ADD COLUMN IF NOT EXISTS region_source         text,
  ADD COLUMN IF NOT EXISTS language_track_source text;

-- ----------------------------------------------------------------------------
-- Backfill existing numbers into student_phones (idempotent).
-- ----------------------------------------------------------------------------
INSERT INTO public.student_phones (student_id, phone, label, is_primary)
SELECT p.user_id, p.phone, NULL, true
FROM public.profiles p
WHERE p.phone IS NOT NULL AND p.phone <> ''
  AND public.normalize_phone(p.phone) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.student_phones sp
    WHERE sp.phone_norm = public.normalize_phone(p.phone)
  );

INSERT INTO public.student_phones (student_id, phone, label, is_primary)
SELECT p.user_id, p.additional_phone, 'other', false
FROM public.profiles p
WHERE p.additional_phone IS NOT NULL AND p.additional_phone <> ''
  AND public.normalize_phone(p.additional_phone) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.student_phones sp
    WHERE sp.phone_norm = public.normalize_phone(p.additional_phone)
  );

-- ----------------------------------------------------------------------------
-- Conversation-driven language-track inference.
-- New chat messages / call analyses (re)enqueue a 'student_track_infer' job,
-- which dispatch-comm-jobs hands to the infer-student-track worker. Certificates
-- and manual edits stay authoritative — the worker skips those students.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_student_track_infer(p_student uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_student IS NULL THEN RETURN; END IF;
  -- Skip students whose track is already authoritatively set.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_student
      AND language_track_source IN ('manual', 'certificate')
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
  VALUES ('student_track_infer', 'profiles', p_student, jsonb_build_object('student_id', p_student))
  ON CONFLICT (job_type, ref_table, ref_id)
  DO UPDATE SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now()
  WHERE public.comm_processing_jobs.status <> 'processing';
END; $$;

CREATE OR REPLACE FUNCTION public.trg_track_infer_from_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.enqueue_student_track_infer(NEW.student_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enqueue_track_infer_message ON public.messages;
CREATE TRIGGER trg_enqueue_track_infer_message
  AFTER INSERT ON public.messages
  FOR EACH ROW WHEN (NEW.student_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_track_infer_from_message();

CREATE OR REPLACE FUNCTION public.trg_track_infer_from_call()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.enqueue_student_track_infer(NEW.student_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enqueue_track_infer_call ON public.call_analyses;
CREATE TRIGGER trg_enqueue_track_infer_call
  AFTER INSERT OR UPDATE ON public.call_analyses
  FOR EACH ROW WHEN (NEW.student_id IS NOT NULL)
  EXECUTE FUNCTION public.trg_track_infer_from_call();
