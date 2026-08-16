-- Fix: call operators got "new row violates row-level security policy" when
-- using AI Translation (/crm/translation).
--
-- The "AI Tarjima" feature is shown to every staff role in the CRM sidebar
-- (visible: true, no role gate), but the RLS for translation only allowed
-- owner / admin / document_handler. A call_operator uploading the source file
-- tripped the storage.objects INSERT check ("new row violates row-level
-- security policy"), and would also have been blocked from creating the
-- translation_jobs row.
--
-- call_operator is a staff role elsewhere (e.g. it can update profiles), so add
-- it to the translation storage-bucket and translation_jobs policies.

-- translation-documents storage bucket: allow call_operator to view/upload/update/delete.
ALTER POLICY "Staff can view translation documents" ON storage.objects
  USING (bucket_id = 'translation-documents' AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role)
    OR has_role(auth.uid(), 'call_operator'::app_role)
  ));

ALTER POLICY "Staff can upload translation documents" ON storage.objects
  WITH CHECK (bucket_id = 'translation-documents' AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role)
    OR has_role(auth.uid(), 'call_operator'::app_role)
  ));

ALTER POLICY "Staff can update translation documents" ON storage.objects
  USING (bucket_id = 'translation-documents' AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role)
    OR has_role(auth.uid(), 'call_operator'::app_role)
  ));

ALTER POLICY "Staff can delete translation documents" ON storage.objects
  USING (bucket_id = 'translation-documents' AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role)
    OR has_role(auth.uid(), 'call_operator'::app_role)
  ));

-- translation_jobs table: allow call_operator to view and manage jobs.
ALTER POLICY "Staff can view all translation jobs" ON public.translation_jobs
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role)
    OR has_role(auth.uid(), 'call_operator'::app_role)
  );

ALTER POLICY "Staff can manage translation jobs" ON public.translation_jobs
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'document_handler'::app_role)
    OR has_role(auth.uid(), 'call_operator'::app_role)
  );
