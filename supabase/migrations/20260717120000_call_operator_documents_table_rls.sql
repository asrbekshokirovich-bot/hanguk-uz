-- call_operator could not attach student documents at all.
--
-- 20260618110000 aligned storage.objects with the create-student edge function's
-- allowed roles so call_operator could upload the mandatory contract file, but it
-- only touched the storage bucket — the public.documents TABLE policies still
-- listed owner/admin/document_handler. So the file landed in storage and the
-- follow-up row insert was rejected with:
--   "new row violates row-level security policy for table \"documents\""
--
-- Align the table policies with the same role set. DELETE is deliberately left
-- to owner/admin/document_handler — call_operator needs to attach and see
-- documents, not remove them.

drop policy if exists "Staff can insert documents for students" on public.documents;
create policy "Staff can insert documents for students"
  on public.documents
  for insert
  to authenticated
  with check (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role) or
    has_role(auth.uid(), 'document_handler'::app_role) or
    has_role(auth.uid(), 'call_operator'::app_role)
  );

drop policy if exists "Staff can view all documents" on public.documents;
create policy "Staff can view all documents"
  on public.documents
  for select
  to authenticated
  using (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role) or
    has_role(auth.uid(), 'document_handler'::app_role) or
    has_role(auth.uid(), 'call_operator'::app_role)
  );

drop policy if exists "Staff can update documents" on public.documents;
create policy "Staff can update documents"
  on public.documents
  for update
  to authenticated
  using (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role) or
    has_role(auth.uid(), 'document_handler'::app_role) or
    has_role(auth.uid(), 'call_operator'::app_role)
  )
  with check (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role) or
    has_role(auth.uid(), 'document_handler'::app_role) or
    has_role(auth.uid(), 'call_operator'::app_role)
  );
