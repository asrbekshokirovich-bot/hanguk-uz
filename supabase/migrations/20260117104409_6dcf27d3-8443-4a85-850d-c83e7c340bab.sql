-- Add language_track column to profiles table
-- Options: 'english', 'korean', 'both'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language_track TEXT DEFAULT 'korean' 
CHECK (language_track IN ('english', 'korean', 'both'));