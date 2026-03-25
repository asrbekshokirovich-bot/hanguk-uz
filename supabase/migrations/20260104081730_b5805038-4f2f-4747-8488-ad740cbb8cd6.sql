-- Create calls table for VoIP/phone tracking
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES auth.users(id),
  staff_id UUID REFERENCES auth.users(id),
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  status TEXT NOT NULL DEFAULT 'completed',
  duration INTEGER DEFAULT 0,
  recording_url TEXT,
  notes TEXT,
  external_call_id TEXT,
  voip_provider TEXT DEFAULT 'manual',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Staff can view all calls
CREATE POLICY "Staff can view all calls"
  ON public.calls
  FOR SELECT
  USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator') OR
    has_role(auth.uid(), 'document_handler')
  );

-- Call operators and admins can manage calls
CREATE POLICY "Staff can manage calls"
  ON public.calls
  FOR ALL
  USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'call_operator')
  );

-- Add updated_at trigger
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_calls_student_id ON public.calls(student_id);
CREATE INDEX idx_calls_staff_id ON public.calls(staff_id);
CREATE INDEX idx_calls_started_at ON public.calls(started_at DESC);