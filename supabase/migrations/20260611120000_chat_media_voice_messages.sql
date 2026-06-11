-- Chat media: store & serve voice messages (and other attachments) received in
-- the unified inbox (Telegram / Instagram). The ingestion edge functions
-- (telegram-ingest, telegram-webhook) download the media bytes and upload them
-- here; the CRM frontend streams them back through short-lived signed URLs so a
-- plain <audio> tag can play them.
--
-- Private bucket — these are 1:1 conversations with students/leads. Staff read
-- access mirrors the `messages` table policy (owner/admin/call_operator/
-- document_handler). Server-side ingestion uses the service role, which bypasses
-- these policies. The bucket is source-agnostic: paths are keyed by channel
-- (e.g. `telegram/<sender>/...`, `instagram/<sender>/...`).

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Staff can read chat media (needed to mint signed URLs for the audio player).
CREATE POLICY "Staff can view chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND (
    has_role(auth.uid(), 'owner') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'call_operator') OR
    has_role(auth.uid(), 'document_handler')
  )
);

-- Staff can manage chat media (manual uploads / cleanup). Ingestion runs as the
-- service role and bypasses RLS; the full CRUD set just matches the other
-- private buckets in this project.
CREATE POLICY "Staff can upload chat media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND (
    has_role(auth.uid(), 'owner') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'call_operator')
  )
);

CREATE POLICY "Staff can update chat media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat-media' AND (
    has_role(auth.uid(), 'owner') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'call_operator')
  )
);

CREATE POLICY "Staff can delete chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND (
    has_role(auth.uid(), 'owner') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'call_operator')
  )
);
