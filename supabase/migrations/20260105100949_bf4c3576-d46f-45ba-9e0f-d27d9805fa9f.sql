-- Allow importing tasks from Command Center by storing an external identifier
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS external_task_id text;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'crm';

-- Ensure we can map inbound updates/deletes reliably
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_external_task_id
ON public.tasks (external_task_id)
WHERE external_task_id IS NOT NULL;

-- Auto-fill external_task_id for locally created tasks so inbound updates can match
CREATE OR REPLACE FUNCTION public.set_task_external_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.external_task_id IS NULL THEN
    NEW.external_task_id := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_task_external_id ON public.tasks;
CREATE TRIGGER set_task_external_id
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_external_id();
