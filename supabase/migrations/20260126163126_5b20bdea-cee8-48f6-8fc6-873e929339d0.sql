-- Add city/region field to profiles for student location tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;

-- Add index for regional analytics queries
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city);