ALTER TABLE public.search_jobs DROP CONSTRAINT search_jobs_type_check;
ALTER TABLE public.search_jobs ADD CONSTRAINT search_jobs_type_check 
  CHECK (type = ANY (ARRAY['faculty', 'university', 'faculty_comprehensive']));