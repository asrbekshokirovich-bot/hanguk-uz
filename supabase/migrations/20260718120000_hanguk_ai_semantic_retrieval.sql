-- Hanguk AI — Phase 5 semantic retrieval.
--
-- The communication-intelligence pipeline already embeds every call
-- (communication_embeddings + HNSW index), but hanguk-ai-chat only ever used
-- the keyword full-text path. To let the assistant retrieve by *meaning*
-- ("who's worried about tuition?", "which student mentioned a scholarship?")
-- and still cite the exact student, the match RPC now also returns the row's
-- student_id / lead_id.
--
-- Safe to change the signature: the previous version had no runtime callers
-- (only the generated TS types + this migration referenced it), so nothing
-- depends on the old return shape.

DROP FUNCTION IF EXISTS public.match_communication_embeddings(vector, integer, uuid, uuid);

CREATE OR REPLACE FUNCTION public.match_communication_embeddings(
  query_embedding   vector(768),
  match_count       integer DEFAULT 8,
  filter_student_id uuid DEFAULT NULL,
  filter_lead_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  source_type text,
  source_id   uuid,
  student_id  uuid,
  lead_id     uuid,
  channel     text,
  content     text,
  metadata    jsonb,
  similarity  double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id,
    e.source_type,
    e.source_id,
    e.student_id,
    e.lead_id,
    e.channel,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.communication_embeddings e
  WHERE e.embedding IS NOT NULL
    AND (filter_student_id IS NULL OR e.student_id = filter_student_id)
    AND (filter_lead_id IS NULL OR e.lead_id = filter_lead_id)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Lock it down to the service role, matching the other communication RPCs
-- (hanguk-ai-chat calls it with the service-role key). Never reachable from
-- the browser (anon/authenticated) so vectors can't be probed client-side.
REVOKE EXECUTE ON FUNCTION public.match_communication_embeddings(vector, integer, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.match_communication_embeddings(vector, integer, uuid, uuid) TO service_role;
