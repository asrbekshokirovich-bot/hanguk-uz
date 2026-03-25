-- Create AI conversations table for storing chat history
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'staff')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_created_at ON public.ai_conversations(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view their own AI conversations"
ON public.ai_conversations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert their own AI conversations"
ON public.ai_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create AI context cache table for performance
CREATE TABLE public.ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('student', 'staff')),
  context_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_context_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own cache
CREATE POLICY "Users can view their own context cache"
ON public.ai_context_cache
FOR SELECT
USING (auth.uid() = user_id);

-- Users can manage their own cache
CREATE POLICY "Users can manage their own context cache"
ON public.ai_context_cache
FOR ALL
USING (auth.uid() = user_id);

-- Staff can insert conversation records via edge function (service role)
CREATE POLICY "Service role can manage AI conversations"
ON public.ai_conversations
FOR ALL
USING (true)
WITH CHECK (true);

-- Staff can manage context cache via edge function (service role)  
CREATE POLICY "Service role can manage context cache"
ON public.ai_context_cache
FOR ALL
USING (true)
WITH CHECK (true);