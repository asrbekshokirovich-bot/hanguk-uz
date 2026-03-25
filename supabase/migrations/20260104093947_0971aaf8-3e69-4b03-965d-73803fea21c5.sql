-- Add magic_code column for student login
ALTER TABLE public.profiles 
ADD COLUMN magic_code TEXT UNIQUE;

-- Create index for fast magic code lookups
CREATE INDEX idx_profiles_magic_code ON public.profiles(magic_code) WHERE magic_code IS NOT NULL;