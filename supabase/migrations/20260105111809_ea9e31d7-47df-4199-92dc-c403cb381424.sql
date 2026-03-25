-- Staff can only see tasks assigned to them or created by them; owners/admins see all
DROP POLICY IF EXISTS "Staff can view all tasks" ON public.tasks;

CREATE POLICY "Staff can view own or assigned tasks" 
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
);