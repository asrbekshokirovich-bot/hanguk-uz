-- S2: Add UPDATE RLS policy for search_jobs so users can cancel their own jobs
CREATE POLICY "Users can update their own search jobs"
ON public.search_jobs FOR UPDATE
USING (auth.uid() = user_id);