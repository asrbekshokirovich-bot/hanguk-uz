-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Owners can insert bonuses" ON public.staff_bonuses;

-- Create new policy allowing all staff roles to insert bonuses
CREATE POLICY "Staff can insert bonuses" 
  ON public.staff_bonuses 
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'call_operator'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- Also update SELECT policy to allow all staff to view bonuses (they need to see what they create)
DROP POLICY IF EXISTS "Owners can view all bonuses" ON public.staff_bonuses;

CREATE POLICY "Staff can view all bonuses" 
  ON public.staff_bonuses 
  FOR SELECT 
  TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'call_operator'::app_role) OR 
    has_role(auth.uid(), 'document_handler'::app_role)
  );