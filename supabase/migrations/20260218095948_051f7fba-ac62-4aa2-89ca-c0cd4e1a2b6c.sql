
-- Add INSERT policy for staff uploading student documents to storage
CREATE POLICY "Staff can upload student documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (
      has_role(auth.uid(), 'owner'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'document_handler'::app_role)
    )
  );

-- Add UPDATE policy for staff managing student documents in storage
CREATE POLICY "Staff can update student documents in storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (
      has_role(auth.uid(), 'owner'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'document_handler'::app_role)
    )
  );

-- Add DELETE policy for staff managing student documents in storage
CREATE POLICY "Staff can delete student documents in storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (
      has_role(auth.uid(), 'owner'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'document_handler'::app_role)
    )
  );
