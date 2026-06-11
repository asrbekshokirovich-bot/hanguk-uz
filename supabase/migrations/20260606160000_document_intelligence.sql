-- ============================================================================
-- Document Intelligence: extracted text + key fields per file, multilingual
-- search, auto-queue new uploads, backfill existing files, AI-readable.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  student_id  uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  doc_type    text,
  full_text   text,
  key_fields  jsonb,          -- [{ label, value }]
  language    text,
  model       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);
CREATE INDEX IF NOT EXISTS idx_doc_extractions_student ON public.document_extractions(student_id);
CREATE INDEX IF NOT EXISTS idx_doc_extractions_text_pgroonga ON public.document_extractions USING pgroonga (full_text);

DROP TRIGGER IF EXISTS trg_doc_extractions_updated_at ON public.document_extractions;
CREATE TRIGGER trg_doc_extractions_updated_at
  BEFORE UPDATE ON public.document_extractions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can view document extractions" ON public.document_extractions;
CREATE POLICY "Staff can view document extractions" ON public.document_extractions FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'document_handler'::app_role) OR has_role(auth.uid(), 'call_operator'::app_role));

CREATE OR REPLACE FUNCTION public.enqueue_document_processing()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.file_path IS NOT NULL AND NEW.file_path <> '' THEN
    INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
    VALUES ('document_extract', 'documents', NEW.id, jsonb_build_object('file_path', NEW.file_path))
    ON CONFLICT (job_type, ref_table, ref_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enqueue_document_processing ON public.documents;
CREATE TRIGGER trg_enqueue_document_processing
  AFTER INSERT OR UPDATE OF file_path ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_document_processing();

INSERT INTO public.comm_processing_jobs (job_type, ref_table, ref_id, payload)
SELECT 'document_extract', 'documents', id, jsonb_build_object('file_path', file_path)
FROM public.documents
WHERE file_path IS NOT NULL AND file_path <> ''
ON CONFLICT (job_type, ref_table, ref_id) DO NOTHING;

-- Search now covers documents too.
CREATE OR REPLACE FUNCTION public.search_communications_text(
  p_query text, p_limit int DEFAULT 12, p_student uuid DEFAULT NULL
)
RETURNS TABLE(kind text, student_id uuid, lead_id uuid, when_at timestamptz, snippet text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT 'message'::text, m.student_id, NULLIF(m.metadata->>'lead_id','')::uuid, m.created_at, left(m.content, 300)
   FROM public.messages m
   WHERE m.content &@~ p_query AND (p_student IS NULL OR m.student_id = p_student)
   ORDER BY m.created_at DESC LIMIT p_limit)
  UNION ALL
  (SELECT 'call'::text, a.student_id, a.lead_id, a.created_at, left(coalesce(a.summary_uz, a.summary_en, ''), 400)
   FROM public.call_analyses a
   WHERE (a.summary_uz &@~ p_query OR a.summary_en &@~ p_query) AND (p_student IS NULL OR a.student_id = p_student)
   ORDER BY a.created_at DESC LIMIT p_limit)
  UNION ALL
  (SELECT 'document'::text, e.student_id, NULL::uuid, e.created_at, left(coalesce(e.doc_type || ': ', '') || coalesce(e.full_text, ''), 400)
   FROM public.document_extractions e
   WHERE e.full_text &@~ p_query AND (p_student IS NULL OR e.student_id = p_student)
   ORDER BY e.created_at DESC LIMIT p_limit)
  LIMIT p_limit;
$$;
