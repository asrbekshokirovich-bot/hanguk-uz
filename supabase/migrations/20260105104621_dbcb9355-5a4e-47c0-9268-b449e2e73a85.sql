-- Drop existing delete policy and create a new one that allows staff to delete their own tasks
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;

CREATE POLICY "Staff can delete own tasks or admins delete any" 
ON public.tasks 
FOR DELETE 
USING (
  has_role(auth.uid(), 'owner'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR created_by = auth.uid()
);