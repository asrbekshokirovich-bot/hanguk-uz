-- Prevent deletion of Command Center synced tasks from hanguk.uz
DROP POLICY IF EXISTS "Staff can delete own assigned or synced tasks" ON public.tasks;

CREATE POLICY "Staff can delete own or assigned tasks except synced" 
ON public.tasks
FOR DELETE
USING (
  source != 'command-center'
  AND (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);