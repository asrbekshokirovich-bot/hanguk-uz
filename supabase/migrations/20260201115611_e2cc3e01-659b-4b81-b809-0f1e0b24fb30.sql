-- Add staff visibility policies for study plan tables
CREATE POLICY "Staff can view all sessions" ON study_plan_sessions
  FOR SELECT USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view all drafts" ON study_plan_drafts
  FOR SELECT USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view all analyses" ON study_plan_analyses
  FOR SELECT USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

CREATE POLICY "Staff can view all chat history" ON study_plan_chat_history
  FOR SELECT USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_study_plan_sessions_student ON study_plan_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_drafts_session ON study_plan_drafts(session_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_analyses_session ON study_plan_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_chat_session ON study_plan_chat_history(session_id);