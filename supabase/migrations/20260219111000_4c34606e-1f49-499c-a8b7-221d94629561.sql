
-- Create admission_sync_jobs table to track full sync runs
CREATE TABLE public.admission_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  semester text NOT NULL,
  year integer NOT NULL,
  program_level text NOT NULL,
  total integer DEFAULT 0,
  processed integer DEFAULT 0,
  found integer DEFAULT 0,
  failed integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  triggered_by text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admission_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read sync jobs" ON public.admission_sync_jobs
  FOR SELECT USING (true);

CREATE POLICY "Staff can insert sync jobs" ON public.admission_sync_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update sync jobs" ON public.admission_sync_jobs
  FOR UPDATE USING (true);
