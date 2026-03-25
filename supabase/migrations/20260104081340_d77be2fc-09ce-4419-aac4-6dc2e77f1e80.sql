-- Create messages table for unified inbox
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('telegram', 'instagram', 'whatsapp', 'manual')),
  external_id TEXT,
  sender_name TEXT,
  sender_id TEXT,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'voice')),
  direction TEXT NOT NULL DEFAULT 'incoming' CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  student_id UUID,
  assigned_to UUID,
  replied_by UUID,
  replied_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create message_threads table for grouping conversations
CREATE TABLE public.message_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  sender_avatar TEXT,
  student_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source, sender_id)
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Staff can view all messages"
ON public.messages
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator') OR 
  has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can manage messages"
ON public.messages
FOR ALL
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator')
);

-- RLS Policies for message_threads
CREATE POLICY "Staff can view all threads"
ON public.message_threads
FOR SELECT
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator') OR 
  has_role(auth.uid(), 'document_handler')
);

CREATE POLICY "Staff can manage threads"
ON public.message_threads
FOR ALL
USING (
  has_role(auth.uid(), 'owner') OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'call_operator')
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;