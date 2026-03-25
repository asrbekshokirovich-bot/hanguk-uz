ALTER TABLE search_jobs DROP CONSTRAINT search_jobs_type_check;
ALTER TABLE search_jobs ADD CONSTRAINT search_jobs_type_check 
  CHECK (type = ANY (ARRAY['faculty', 'university', 'faculty_comprehensive', 'university_import']));