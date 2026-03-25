
-- Fix 1: Change applications.student_id FK from auth.users to profiles(user_id)
ALTER TABLE public.applications 
  DROP CONSTRAINT IF EXISTS applications_student_id_fkey;

ALTER TABLE public.applications 
  ADD CONSTRAINT applications_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Fix 3: Enable map visibility for all universities with GPS coordinates
UPDATE public.universities 
SET is_visible_on_map = true 
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND is_visible_on_map = false;
