-- Add contract_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.contract_url IS 'URL to the uploaded contract file in storage';