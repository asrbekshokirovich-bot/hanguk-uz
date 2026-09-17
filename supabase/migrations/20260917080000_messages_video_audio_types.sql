-- Allow video and audio message types in the messages table.
-- The telegram webhook's describeMedia() returns "video" and "audio" for
-- video/audio attachments, but the check constraint only allowed
-- text/image/file/voice — causing 500 errors that blocked ALL incoming
-- Telegram messages since Sept 16 ~17:00 UTC.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text', 'image', 'file', 'voice', 'video', 'audio']));
