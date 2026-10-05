-- Call operators can see surveys and their results (owner, 2026-10-05).
--
-- Until now only owner, admin and document_handler could read surveys,
-- their questions and the students' answers. Call operators get read access
-- to the same rows. Creating, editing, switching on/off, deleting and
-- sending notifications stay with owner, admin and document_handler; the
-- CRM hides those buttons for a call operator.

create policy "surveys_call_operator_read"
  on public.surveys
  for select
  to authenticated
  using (has_role((select auth.uid()), 'call_operator'::app_role));

create policy "questions_call_operator_read"
  on public.survey_questions
  for select
  to authenticated
  using (has_role((select auth.uid()), 'call_operator'::app_role));

create policy "responses_call_operator_read"
  on public.survey_responses
  for select
  to authenticated
  using (has_role((select auth.uid()), 'call_operator'::app_role));
