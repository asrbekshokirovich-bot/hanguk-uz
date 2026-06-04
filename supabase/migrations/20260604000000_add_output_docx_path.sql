-- Add DOCX output path column (translation now produces Word documents instead of PDF).
ALTER TABLE public.translation_jobs
  ADD COLUMN IF NOT EXISTS output_docx_path TEXT;

COMMENT ON COLUMN public.translation_jobs.output_docx_path IS
  'Storage path (translation-documents bucket) of the generated certified-translation Word (.docx) file.';
