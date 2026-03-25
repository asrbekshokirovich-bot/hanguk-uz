-- Allow staff to insert student profiles
CREATE POLICY "Staff can insert student profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'call_operator'::app_role) OR 
  has_role(auth.uid(), 'document_handler'::app_role)
);

-- Allow staff to update all profiles (for editing student info)
CREATE POLICY "Staff can update all profiles"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'call_operator'::app_role) OR 
  has_role(auth.uid(), 'document_handler'::app_role)
);