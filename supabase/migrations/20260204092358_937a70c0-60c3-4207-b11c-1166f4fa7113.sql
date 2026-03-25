-- Create mentions table to track @mentions
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID NOT NULL,
  mentioned_by UUID NOT NULL,
  context_type TEXT NOT NULL,
  context_id UUID NOT NULL,
  content_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own mentions
CREATE POLICY "Users can view their own mentions"
ON public.mentions
FOR SELECT
USING (auth.uid() = mentioned_user_id);

-- Any authenticated user can create mentions
CREATE POLICY "Authenticated users can create mentions"
ON public.mentions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own mentions (to mark as read)
CREATE POLICY "Users can update their own mentions"
ON public.mentions
FOR UPDATE
USING (auth.uid() = mentioned_user_id);

-- Enable realtime for mentions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;

-- Create index for faster queries
CREATE INDEX idx_mentions_mentioned_user_id ON public.mentions(mentioned_user_id);
CREATE INDEX idx_mentions_context ON public.mentions(context_type, context_id);