-- Allow staff to delete their own tasks, assigned tasks, OR command-center synced tasks
DROP POLICY IF EXISTS "Staff can delete own or assigned tasks" ON public.tasks;

CREATE POLICY "Staff can delete own assigned or synced tasks" 
ON public.tasks
FOR DELETE
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR source = 'command-center'
);