
-- Fix 3: Harden storage RLS policies — target 'authenticated' instead of 'public'

-- Drop and recreate the staff view policy with proper role scope
DROP POLICY IF EXISTS "Staff can view all student documents" ON storage.objects;
CREATE POLICY "Staff can view all student documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-documents'
  AND (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  )
);

-- Also fix staff upload/update/delete policies if they target public
DROP POLICY IF EXISTS "Staff can upload student documents" ON storage.objects;
CREATE POLICY "Staff can upload student documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-documents'
  AND (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  )
);

DROP POLICY IF EXISTS "Staff can update student documents" ON storage.objects;
CREATE POLICY "Staff can update student documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-documents'
  AND (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  )
);

DROP POLICY IF EXISTS "Staff can delete student documents" ON storage.objects;
CREATE POLICY "Staff can delete student documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-documents'
  AND (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  )
);
