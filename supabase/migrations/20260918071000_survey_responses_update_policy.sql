-- Let a student correct an answer they already sent.
--
-- Both clients write with `upsert(..., onConflict: 'question_id,user_id')`,
-- and survey_responses has a UNIQUE (question_id, user_id). So the second
-- submit for the same question is an INSERT ... ON CONFLICT DO UPDATE, and
-- Postgres checks the UPDATE policy for that branch — of which there was
-- none. The row therefore could only ever be written once: a student who
-- fixed a typo and resubmitted got an RLS denial.
--
-- USING picks the rows they may touch, WITH CHECK stops them reassigning a
-- response to somebody else's user_id on the way out.

CREATE POLICY responses_update_own ON public.survey_responses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
