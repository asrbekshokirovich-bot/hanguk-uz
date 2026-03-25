-- 1. Add message-level scoring to feedback
ALTER TABLE interview_feedback
ADD COLUMN IF NOT EXISTS message_scores JSONB DEFAULT '[]';

-- 2. Add focus topic to sessions
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS focus_topic TEXT DEFAULT NULL;

-- 3. Add timed mode columns
ALTER TABLE interview_sessions
ADD COLUMN IF NOT EXISTS timed_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER DEFAULT NULL;

-- 4. Create storage bucket for interview recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-recordings', 'interview-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS policy for interview recordings - students can only access their own recordings
CREATE POLICY "Students can upload their own interview recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'interview-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own interview recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'interview-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can delete their own interview recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'interview-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);