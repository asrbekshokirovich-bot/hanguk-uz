-- Add academic scores to profiles table for better university matching
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS topik_level integer,
ADD COLUMN IF NOT EXISTS ielts_score numeric(2,1),
ADD COLUMN IF NOT EXISTS korean_region_preference text,
ADD COLUMN IF NOT EXISTS study_work_priority text;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.topik_level IS 'TOPIK Korean language proficiency level (1-6)';
COMMENT ON COLUMN public.profiles.ielts_score IS 'IELTS English proficiency score (0.0-9.0)';
COMMENT ON COLUMN public.profiles.korean_region_preference IS 'Preferred region in South Korea if any';
COMMENT ON COLUMN public.profiles.study_work_priority IS 'Primary goal: study or work';