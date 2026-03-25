
-- Fix documents.student_id FK: remove auth.users reference, point to profiles(user_id)
ALTER TABLE public.documents 
  DROP CONSTRAINT IF EXISTS documents_student_id_fkey;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_student_id_fkey 
  FOREIGN KEY (student_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;
