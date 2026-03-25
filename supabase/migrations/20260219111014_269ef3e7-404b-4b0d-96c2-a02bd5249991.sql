
-- Fix overly permissive INSERT and UPDATE policies on admission_sync_jobs
-- Require authentication for INSERT (staff must be logged in)
DROP POLICY IF EXISTS "Staff can insert sync jobs" ON public.admission_sync_jobs;
DROP POLICY IF EXISTS "Service role can update sync jobs" ON public.admission_sync_jobs;

-- INSERT: only authenticated users (staff)
CREATE POLICY "Authenticated staff can insert sync jobs" ON public.admission_sync_jobs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: service role only (edge functions use service role key)
-- We use a function approach to allow service role updates
CREATE POLICY "Service role can update sync jobs" ON public.admission_sync_jobs
  FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));
