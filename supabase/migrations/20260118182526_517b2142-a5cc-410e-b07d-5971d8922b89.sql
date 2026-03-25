-- Add visibility control for universities on the student map
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS is_visible_on_map BOOLEAN DEFAULT true;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_universities_visible_on_map ON public.universities(is_visible_on_map);