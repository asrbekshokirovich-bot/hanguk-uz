-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  created_by UUID NOT NULL,
  student_id UUID,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_comments table for collaboration
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Staff can view all tasks"
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator') OR 
  has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator') OR 
  has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can update tasks"
ON public.tasks
FOR UPDATE
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR
  assigned_to = auth.uid() OR
  created_by = auth.uid()
);

CREATE POLICY "Admins can delete tasks"
ON public.tasks
FOR DELETE
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin')
);

-- RLS Policies for task_comments
CREATE POLICY "Staff can view task comments"
ON public.task_comments
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator') OR 
  has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can create comments"
ON public.task_comments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator') OR 
  has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Users can delete their own comments"
ON public.task_comments
FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();