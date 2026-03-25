-- Allow admins and owners to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin')
);

-- Allow staff to view all profiles (needed for CRM)
CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT
USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator') OR 
    has_role(auth.uid(), 'document_handler')
);