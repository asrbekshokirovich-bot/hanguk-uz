
-- Staff and owners can read all interview sessions (for CRM visibility and health monitoring)
CREATE POLICY "Staff can view all interview sessions"
  ON public.interview_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Staff can view all interview messages (for support/review)
CREATE POLICY "Staff can view all interview messages"
  ON public.interview_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Staff can view all interview feedback
CREATE POLICY "Staff can view all interview feedback"
  ON public.interview_feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
