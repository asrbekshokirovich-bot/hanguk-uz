-- Create lead_notes table
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Staff can view all lead notes
CREATE POLICY "Staff can view lead notes" ON public.lead_notes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'call_operator'::app_role, 'document_handler'::app_role]))
  );

-- Staff can create lead notes
CREATE POLICY "Staff can create lead notes" ON public.lead_notes
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY (ARRAY['owner'::app_role, 'admin'::app_role, 'call_operator'::app_role]))
  );

-- Users can update their own notes
CREATE POLICY "Users can update own lead notes" ON public.lead_notes
  FOR UPDATE USING (created_by = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own lead notes" ON public.lead_notes
  FOR DELETE USING (created_by = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_lead_notes_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();