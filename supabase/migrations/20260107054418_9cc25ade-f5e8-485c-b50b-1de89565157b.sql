-- Create table for active call sessions and signaling
CREATE TABLE public.call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing',
  call_type TEXT NOT NULL DEFAULT 'audio',
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for WebRTC signaling messages
CREATE TABLE public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  signal_type TEXT NOT NULL,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_sessions (staff can see their own calls)
CREATE POLICY "Staff can view their call sessions"
ON public.call_sessions FOR SELECT
USING (
  auth.uid() = caller_id OR auth.uid() = callee_id
);

CREATE POLICY "Staff can create call sessions"
ON public.call_sessions FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update call sessions"
ON public.call_sessions FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Participants can delete call sessions"
ON public.call_sessions FOR DELETE
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- RLS policies for call_signals
CREATE POLICY "Participants can view signals"
ON public.call_signals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.call_sessions 
    WHERE id = session_id 
    AND (caller_id = auth.uid() OR callee_id = auth.uid())
  )
);

CREATE POLICY "Participants can create signals"
ON public.call_signals FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.call_sessions 
    WHERE id = session_id 
    AND (caller_id = auth.uid() OR callee_id = auth.uid())
  )
);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Trigger for updated_at
CREATE TRIGGER update_call_sessions_updated_at
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();