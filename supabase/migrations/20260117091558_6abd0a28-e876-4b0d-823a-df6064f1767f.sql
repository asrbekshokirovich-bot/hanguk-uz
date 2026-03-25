-- Create intercom_calls table to track voice calls between staff
CREATE TABLE public.intercom_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  channel_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create staff_presence table to track online status
CREATE TABLE public.staff_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'online',
  last_seen TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intercom_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_presence ENABLE ROW LEVEL SECURITY;

-- Create indexes for quick lookup
CREATE INDEX idx_intercom_calls_callee ON public.intercom_calls(callee_id, status);
CREATE INDEX idx_intercom_calls_caller ON public.intercom_calls(caller_id, status);
CREATE INDEX idx_staff_presence_user ON public.staff_presence(user_id);

-- RLS Policies for intercom_calls
CREATE POLICY "Staff can view their calls"
  ON public.intercom_calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Staff can create calls"
  ON public.intercom_calls FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Staff can update their calls"
  ON public.intercom_calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- RLS Policies for staff_presence
CREATE POLICY "Staff can view all presence"
  ON public.staff_presence FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own presence"
  ON public.staff_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON public.staff_presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presence"
  ON public.staff_presence FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for presence updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intercom_calls;

-- Add updated_at trigger for intercom_calls
CREATE TRIGGER update_intercom_calls_updated_at
  BEFORE UPDATE ON public.intercom_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for staff_presence
CREATE TRIGGER update_staff_presence_updated_at
  BEFORE UPDATE ON public.staff_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();