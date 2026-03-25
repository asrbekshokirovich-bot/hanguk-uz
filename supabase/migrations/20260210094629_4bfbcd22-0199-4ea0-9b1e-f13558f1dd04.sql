
-- Add lead_id column to calls table
ALTER TABLE public.calls ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- Enable realtime for calls table
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
