-- ============================================================================
--  translation_jobs — document-translation output columns
--
--  Adds the structured-translation output fields used by the translate-document
--  edge function + the CRM review UI:
--    - output_pdf_path        : path of the rendered certified-translation PDF
--    - structured_translation : the block model (title/heading/field/table/…)
--    - verified_names         : student/father/mother names confirmed from IDs
--
--  Idempotent (IF NOT EXISTS). Already present on prod; this brings staging and
--  the repo migration history into line.
-- ============================================================================

alter table public.translation_jobs
  add column if not exists output_pdf_path        text,
  add column if not exists structured_translation jsonb,
  add column if not exists verified_names         jsonb;
