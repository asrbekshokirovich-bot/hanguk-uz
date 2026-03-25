
-- Create search_jobs table for background search processing
CREATE TABLE public.search_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('faculty', 'university')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  request JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.search_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own search jobs"
ON public.search_jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create their own search jobs"
ON public.search_jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service role can update jobs (edge functions use service role)
-- Allow anon/authenticated to read for polling
CREATE POLICY "Anyone can read search jobs by id"
ON public.search_jobs FOR SELECT
TO anon
USING (true);

-- Allow edge functions (service role) to update/insert
-- Edge functions use service role which bypasses RLS, so no explicit policy needed

-- Auto-update updated_at
CREATE TRIGGER update_search_jobs_updated_at
BEFORE UPDATE ON public.search_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast polling
CREATE INDEX idx_search_jobs_status ON public.search_jobs (id, status);

-- Clean up old jobs (older than 24 hours)
-- This can be done via a cron or manually
