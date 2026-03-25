
-- Fix: Add explicit INSERT policy for staff uploading on behalf of students
CREATE POLICY "Staff can insert documents for students"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- Fix: Add explicit UPDATE policy for staff (reviewing/approving documents)
CREATE POLICY "Staff can update documents"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- Fix: Add explicit DELETE policy for staff
CREATE POLICY "Staff can delete documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'document_handler'::app_role)
  );
