-- Let document_handler run surveys too.
--
-- The CRM menu entry alone would not be enough: every write path and the
-- results view are gated by RLS on owner/admin, so a document_handler would
-- open the section and find a page that cannot create, delete, or show a
-- single answer. All three policies move together.

DROP POLICY surveys_staff_all ON public.surveys;
CREATE POLICY surveys_staff_all ON public.surveys
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'document_handler')
  ));

DROP POLICY questions_staff_all ON public.survey_questions;
CREATE POLICY questions_staff_all ON public.survey_questions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'document_handler')
  ));

DROP POLICY responses_staff_read ON public.survey_responses;
CREATE POLICY responses_staff_read ON public.survey_responses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'document_handler')
  ));
