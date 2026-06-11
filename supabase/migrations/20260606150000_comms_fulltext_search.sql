-- Multilingual full-text search across communications (PGroonga handles Uzbek,
-- Russian, Korean). Powers Hanguk AI cross-student questions like
-- "who asked about scholarships this week".
CREATE INDEX IF NOT EXISTS idx_messages_content_pgroonga      ON public.messages         USING pgroonga (content);
CREATE INDEX IF NOT EXISTS idx_call_analyses_uz_pgroonga      ON public.call_analyses    USING pgroonga (summary_uz);
CREATE INDEX IF NOT EXISTS idx_call_analyses_en_pgroonga      ON public.call_analyses    USING pgroonga (summary_en);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_text_pgroonga ON public.call_transcripts USING pgroonga (full_text);

CREATE OR REPLACE FUNCTION public.search_communications_text(
  p_query text,
  p_limit int DEFAULT 12,
  p_student uuid DEFAULT NULL
)
RETURNS TABLE(kind text, student_id uuid, lead_id uuid, when_at timestamptz, snippet text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT 'message'::text AS kind, m.student_id, NULLIF(m.metadata->>'lead_id','')::uuid AS lead_id,
          m.created_at AS when_at, left(m.content, 300) AS snippet
   FROM public.messages m
   WHERE m.content &@~ p_query AND (p_student IS NULL OR m.student_id = p_student)
   ORDER BY m.created_at DESC
   LIMIT p_limit)
  UNION ALL
  (SELECT 'call'::text AS kind, a.student_id, a.lead_id, a.created_at AS when_at,
          left(coalesce(a.summary_uz, a.summary_en, ''), 400) AS snippet
   FROM public.call_analyses a
   WHERE (a.summary_uz &@~ p_query OR a.summary_en &@~ p_query)
     AND (p_student IS NULL OR a.student_id = p_student)
   ORDER BY a.created_at DESC
   LIMIT p_limit)
  LIMIT p_limit;
$$;
