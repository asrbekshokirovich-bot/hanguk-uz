-- ============================================================================
-- Fix: document/call uploads from the browser fail with
--   "new row violates row-level security policy for table comm_processing_jobs"
--
-- Root cause: comm_processing_jobs has RLS enabled with a SELECT-only policy
-- (no INSERT policy for staff). The enqueue_* trigger functions were created
-- as SECURITY INVOKER (the default), so when a staff user inserts a document
-- (or logs a call) from the browser, the AFTER trigger tries to INSERT into
-- comm_processing_jobs *as that user* and RLS denies it.
--
-- Every other trigger function in this schema already runs as owner (see
-- 20260611000100_security_hardening_function_grants.sql: "triggers fire as
-- owner"). These two were simply missed. Redefining them as SECURITY DEFINER
-- (with a pinned search_path) makes the internal enqueue run as the table
-- owner, which bypasses RLS — without opening up direct INSERT access to the
-- job queue from the browser. The trigger bodies are otherwise unchanged, and
-- the triggers themselves keep pointing at these functions by name.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_document_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.file_path IS NOT NULL AND NEW.file_path <> '' THEN
    INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
    VALUES ('document_extract', 'documents', NEW.id, jsonb_build_object('file_path', NEW.file_path))
    ON CONFLICT (job_type, ref_table, ref_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enqueue_call_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recording_url IS NOT NULL AND NEW.status = 'completed' THEN
    INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
    VALUES (
      'call_transcribe_analyze',
      'calls',
      NEW.id,
      jsonb_build_object('recording_url', NEW.recording_url)
    )
    ON CONFLICT (job_type, ref_table, ref_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Pure trigger functions: never called directly via the API, only fired by
-- the AFTER triggers on documents/calls. Lock down EXECUTE to match the rest
-- of the SECURITY DEFINER trigger functions in this schema.
REVOKE EXECUTE ON FUNCTION public.enqueue_document_processing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_call_processing()     FROM PUBLIC, anon, authenticated;
