-- call_operator is allowed to create students (create-student edge function),
-- but was missing storage access to upload the now-mandatory contract file.
-- This blocked call_operator staff from adding students entirely.
-- Align student-documents storage RLS with the edge function's allowed roles.

DROP POLICY IF EXISTS "Staff can upload student documents" ON storage.objects;
CREATE POLICY "Staff can upload student documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'document_handler'::app_role)
      OR has_role(auth.uid(), 'call_operator'::app_role)
    )
  );

DROP POLICY IF EXISTS "Staff can view all student documents" ON storage.objects;
CREATE POLICY "Staff can view all student documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'document_handler'::app_role)
      OR has_role(auth.uid(), 'call_operator'::app_role)
    )
  );

DROP POLICY IF EXISTS "Staff can update student documents" ON storage.objects;
CREATE POLICY "Staff can update student documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'document_handler'::app_role)
      OR has_role(auth.uid(), 'call_operator'::app_role)
    )
  );
