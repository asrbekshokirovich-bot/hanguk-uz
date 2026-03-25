-- Allow all staff members to view user_roles (needed to fetch staff list)
CREATE POLICY "Staff can view all roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'call_operator'::app_role) OR 
  has_role(auth.uid(), 'document_handler'::app_role)
);

-- Allow admins to manage roles (not just owners)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
);