-- Add ON UPDATE CASCADE to documents.student_id -> profiles.user_id
ALTER TABLE public.documents 
  DROP CONSTRAINT documents_student_id_fkey;
ALTER TABLE public.documents 
  ADD CONSTRAINT documents_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES profiles(user_id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Add ON UPDATE CASCADE to applications.student_id -> profiles.user_id
ALTER TABLE public.applications 
  DROP CONSTRAINT applications_student_id_fkey;
ALTER TABLE public.applications 
  ADD CONSTRAINT applications_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES profiles(user_id) 
  ON DELETE CASCADE ON UPDATE CASCADE;