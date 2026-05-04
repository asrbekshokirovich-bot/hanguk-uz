-- Allow students to update messages within their own sessions.
--
-- The Interview Practice feature records both the student's mic audio and
-- the AI interviewer's TTS output to Supabase Storage, then writes the
-- public URL back to `interview_messages.audio_url` so the transcript
-- review UI can replay each turn.
--
-- The original RLS for this table only granted SELECT and INSERT to the
-- session owner; without an UPDATE policy the audio_url patch is silently
-- denied and recordings never appear in the transcript review.
--
-- Scope is intentionally restricted to messages whose parent session
-- belongs to the current user, matching the pattern already used by the
-- existing SELECT/INSERT policies.

CREATE POLICY "Students can update messages in their sessions"
  ON public.interview_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions
    WHERE id = interview_messages.session_id
      AND student_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.interview_sessions
    WHERE id = interview_messages.session_id
      AND student_id = auth.uid()
  ));
