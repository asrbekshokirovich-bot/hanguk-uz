-- Translation section rebuild: store the generated certified-translation PDF,
-- the structured translation model (so it can be re-rendered without re-calling
-- the AI), and the staff-verified names used in the document.

ALTER TABLE public.translation_jobs
  ADD COLUMN IF NOT EXISTS output_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS structured_translation JSONB,
  ADD COLUMN IF NOT EXISTS verified_names JSONB;

COMMENT ON COLUMN public.translation_jobs.output_pdf_path IS
  'Storage path (translation-documents bucket) of the generated certified-translation PDF.';
COMMENT ON COLUMN public.translation_jobs.structured_translation IS
  'Structured block model returned by the AI: { blocks[], unclearItems[], detectedSupportingDocs[] }. Used to re-render the PDF after staff edits.';
COMMENT ON COLUMN public.translation_jobs.verified_names IS
  'Staff-verified names extracted from passports/IDs: { student, father, mother }.';
