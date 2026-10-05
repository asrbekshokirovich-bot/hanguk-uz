-- Call operators can put a student forward to a university (owner, 2026-10-05).
--
-- The "Oqishga topshirish" dialog on a student's card inserts a row into
-- student_suggestions and then into applications. Only owner, admin and
-- document_handler could insert applications, and only owner and admin could
-- insert suggestions, so a call operator got "new row violates row-level
-- security policy for table applications" (the suggestions insert failed
-- silently before it).
--
-- This grants INSERT only. Call operators could already read every
-- application; they still cannot change or delete one.

create policy "Call operators can create applications"
  on public.applications
  for insert
  to authenticated
  with check (has_role((select auth.uid()), 'call_operator'::app_role));

create policy "Call operators can create suggestions"
  on public.student_suggestions
  for insert
  to authenticated
  with check (has_role((select auth.uid()), 'call_operator'::app_role));
