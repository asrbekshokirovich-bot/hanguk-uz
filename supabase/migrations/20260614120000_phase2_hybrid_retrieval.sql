-- Hanguk AI — Phase 2: hybrid retrieval (pgvector + PGroonga, fused with RRF).
--
-- WHY ------------------------------------------------------------------------
-- Phase 1 gave the staff agent typed STRUCTURED tools (list/count/filter rows).
-- This phase adds the CONTENT side: "what did we discuss / who asked about X"
-- over chats, call summaries/transcripts and documents — answered by HYBRID
-- search (dense semantic + lexical full-text) rather than naive vector-only RAG.
--
-- DESIGN ---------------------------------------------------------------------
--   • One CONSOLIDATED store, `content_embeddings`, covering messages + calls +
--     documents (the prior `communication_embeddings` was 768-dim,
--     text-embedding-004, calls-only-in-practice, vector-only — no lexical arm).
--   • Embeddings come from **gemini-embedding-001 @ 1536 dims** (MRL-truncated,
--     L2-normalised in the edge fn). text-embedding-004 is deprecated; we
--     standardise on one model/dim/index here. (vector(1536) < 2000 ⇒ plain
--     `vector`, no halfvec needed.)
--   • BOTH arms live on the SAME table so RRF fuses by row id cleanly:
--       - dense:   HNSW (vector_cosine_ops) over `embedding`
--       - lexical: PGroonga over `content` (handles Uzbek/Russian/Korean/CJK;
--                  tsvector & pg_trgm cannot index Hangul).
--   • `hybrid_search_content(...)` = Reciprocal-Rank-Fusion (rrf_k=50, the
--     Supabase-official default), SECURITY DEFINER + `ai_is_staff(auth.uid())`
--     gate (same contract as the Phase-1 ai_* tools), per-call statement_timeout,
--     pgvector iterative-scan ON so RLS/filter post-scan doesn't starve recall.
--   • Pipeline reuses the existing `comm_processing_jobs` queue: a `content_embed`
--     job is enqueued by triggers on messages / document_extractions /
--     call_analyses, drained by `dispatch-comm-jobs` -> the new `embed-content`
--     edge function. Existing rows are back-filled (enqueued) at the end.
--
-- ⚠️ PII NOTE: gemini-embedding-001 sends `content` to Google. Use a PAID Gemini
--    / Vertex key with a DPA + ZDR + region pinning for production PII — NOT the
--    free AI Studio tier (which may train on inputs). Flagged per the research
--    plan §13.7 (privacy). Benchmark Uzbek recall on real data before trusting it.
--
-- ⚠️ The legacy `communication_embeddings` table + `match_communication_embeddings`
--    RPC + the inline call-embed in `process-call-recording` are left intact
--    (non-breaking). Once `content_embeddings` is back-filled and verified, that
--    legacy path can be removed in a follow-up (calls are embedded in both until
--    then — low volume, cheap on gemini-embedding-001).

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Consolidated content store
-- ---------------------------------------------------------------------------
create table if not exists public.content_embeddings (
  id          uuid primary key default gen_random_uuid(),
  source_type text not null,                                    -- call | message | document
  source_id   uuid not null,                                    -- stable entity id (call_id | message id | document id)
  student_id  uuid references public.profiles(user_id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  channel     text,                                             -- phone | telegram | instagram | document | …
  language    text,                                             -- best-effort content language (uz/ru/ko/en)
  chunk_index integer not null default 0,
  content     text not null,
  embedding   vector(1536),                                     -- gemini-embedding-001, L2-normalised
  model       text not null default 'gemini-embedding-001',
  metadata    jsonb,
  created_at  timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

comment on table public.content_embeddings is
  'Phase 2 hybrid-search store. One row per content chunk across calls/messages/documents. embedding = gemini-embedding-001 @1536 (L2-normalised). Populated by the embed-content edge fn via the content_embed queue job.';
comment on column public.content_embeddings.source_id is
  'Stable ENTITY id: calls.id for source_type=call, messages.id for message, documents.id for document. Delete-then-insert per (source_type, source_id) on re-embed.';

-- dense (HNSW cosine) + lexical (PGroonga) on the SAME table for clean RRF
create index if not exists idx_content_emb_vec
  on public.content_embeddings using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
create index if not exists idx_content_emb_pgroonga
  on public.content_embeddings using pgroonga (content);
create index if not exists idx_content_emb_student on public.content_embeddings(student_id);
create index if not exists idx_content_emb_lead    on public.content_embeddings(lead_id);
create index if not exists idx_content_emb_source  on public.content_embeddings(source_type, source_id);

alter table public.content_embeddings enable row level security;

-- RLS backstop (the hybrid RPC is SECURITY DEFINER + staff-gated; the worker
-- writes with the service role). Mirrors the communication_embeddings policy.
drop policy if exists "Staff can view content embeddings" on public.content_embeddings;
create policy "Staff can view content embeddings"
  on public.content_embeddings for select
  using (
    has_role(auth.uid(), 'owner'::app_role) or
    has_role(auth.uid(), 'admin'::app_role) or
    has_role(auth.uid(), 'call_operator'::app_role) or
    has_role(auth.uid(), 'document_handler'::app_role)
  );

-- ---------------------------------------------------------------------------
-- Hybrid search: PGroonga (lexical) ⊕ pgvector (dense), fused with RRF.
--   full_text_weight / semantic_weight let the caller bias either arm.
--   Returns the fused top-N with the originating entity + a relevance score.
-- ---------------------------------------------------------------------------
create or replace function public.hybrid_search_content(
  query_text         text,
  query_embedding    vector(1536),
  match_count        int default 12,
  full_text_weight   float default 1.0,
  semantic_weight    float default 1.0,
  rrf_k              int default 50,
  filter_student_id  uuid default null,
  filter_lead_id     uuid default null,
  filter_source_type text default null
)
returns table (
  id          uuid,
  source_type text,
  source_id   uuid,
  student_id  uuid,
  lead_id     uuid,
  channel     text,
  content     text,
  created_at  timestamptz,
  score       double precision
)
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout to '8s'
as $$
declare
  v_n   int := least(greatest(coalesce(match_count, 12), 1), 100);
  v_pool int := least(greatest(coalesce(match_count, 12), 1) * 3, 300);
  v_q   text := nullif(btrim(coalesce(query_text, '')), '');
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;

  -- pgvector ≥0.8: with RLS/filters the ANN scan filters POST-scan and can
  -- starve recall; iterative scan refills until match_count is satisfied.
  -- Guarded so an older pgvector (no such GUC) doesn't break the function.
  begin
    perform set_config('hnsw.iterative_scan', 'strict_order', true);
    perform set_config('hnsw.ef_search', '100', true);
  exception when undefined_object then
    null;
  end;

  return query
  with fts as (
    select c.id,
           row_number() over (order by pgroonga_score(c.tableoid, c.ctid) desc) as rank
    from public.content_embeddings c
    where v_q is not null
      and c.content &@~ v_q
      and (filter_student_id  is null or c.student_id  = filter_student_id)
      and (filter_lead_id     is null or c.lead_id     = filter_lead_id)
      and (filter_source_type is null or c.source_type = filter_source_type)
    limit v_pool
  ),
  sem as (
    select c.id,
           row_number() over (order by c.embedding <=> query_embedding) as rank
    from public.content_embeddings c
    where query_embedding is not null
      and c.embedding is not null
      and (filter_student_id  is null or c.student_id  = filter_student_id)
      and (filter_lead_id     is null or c.lead_id     = filter_lead_id)
      and (filter_source_type is null or c.source_type = filter_source_type)
    order by c.embedding <=> query_embedding
    limit v_pool
  )
  select ce.id, ce.source_type, ce.source_id, ce.student_id, ce.lead_id,
         ce.channel, ce.content, ce.created_at,
         (coalesce(1.0 / (rrf_k + fts.rank), 0.0) * full_text_weight
        + coalesce(1.0 / (rrf_k + sem.rank), 0.0) * semantic_weight)::double precision as score
  from fts
  full outer join sem on fts.id = sem.id
  join public.content_embeddings ce on ce.id = coalesce(fts.id, sem.id)
  order by score desc
  limit v_n;
end;
$$;

revoke execute on function public.hybrid_search_content(text, vector, int, float, float, int, uuid, uuid, text) from public, anon;
grant  execute on function public.hybrid_search_content(text, vector, int, float, float, int, uuid, uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pipeline: enqueue a content_embed job whenever searchable content lands or
-- changes. SECURITY DEFINER so the internal enqueue can write the job queue
-- without granting browser users INSERT on it (same pattern as
-- enqueue_document_processing). Idempotent; re-queues on content change.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_content_embed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text;
  v_changed boolean := true;
begin
  if tg_table_name = 'messages' then
    v_content := new.content;
    if tg_op = 'UPDATE' then v_changed := new.content is distinct from old.content; end if;
  elsif tg_table_name = 'document_extractions' then
    v_content := new.full_text;
    if tg_op = 'UPDATE' then v_changed := new.full_text is distinct from old.full_text; end if;
  elsif tg_table_name = 'call_analyses' then
    v_content := concat_ws(' ', new.summary_uz, new.summary_en);
    if tg_op = 'UPDATE' then
      v_changed := (new.summary_uz is distinct from old.summary_uz)
                or (new.summary_en is distinct from old.summary_en);
    end if;
  else
    return new;
  end if;

  if not v_changed then return new; end if;
  if v_content is null or length(btrim(v_content)) < 8 then return new; end if;

  insert into public.comm_processing_jobs (job_type, ref_table, ref_id, status)
  values ('content_embed', tg_table_name, new.id, 'pending')
  on conflict (job_type, ref_table, ref_id)
  do update set status = 'pending', attempts = 0, last_error = null;

  return new;
end;
$$;

revoke execute on function public.enqueue_content_embed() from public, anon;

drop trigger if exists trg_enqueue_content_embed_messages on public.messages;
create trigger trg_enqueue_content_embed_messages
  after insert or update on public.messages
  for each row execute function public.enqueue_content_embed();

drop trigger if exists trg_enqueue_content_embed_documents on public.document_extractions;
create trigger trg_enqueue_content_embed_documents
  after insert or update on public.document_extractions
  for each row execute function public.enqueue_content_embed();

drop trigger if exists trg_enqueue_content_embed_calls on public.call_analyses;
create trigger trg_enqueue_content_embed_calls
  after insert or update on public.call_analyses
  for each row execute function public.enqueue_content_embed();

-- ---------------------------------------------------------------------------
-- Backfill: enqueue everything we already have. dispatch-comm-jobs drains it.
-- ---------------------------------------------------------------------------
insert into public.comm_processing_jobs (job_type, ref_table, ref_id, status)
select 'content_embed', 'messages', id, 'pending'
from public.messages
where content is not null and length(btrim(content)) >= 8
on conflict (job_type, ref_table, ref_id) do nothing;

insert into public.comm_processing_jobs (job_type, ref_table, ref_id, status)
select 'content_embed', 'document_extractions', id, 'pending'
from public.document_extractions
where full_text is not null and length(btrim(full_text)) >= 8
on conflict (job_type, ref_table, ref_id) do nothing;

insert into public.comm_processing_jobs (job_type, ref_table, ref_id, status)
select 'content_embed', 'call_analyses', id, 'pending'
from public.call_analyses
where length(btrim(concat_ws(' ', summary_uz, summary_en))) >= 8
on conflict (job_type, ref_table, ref_id) do nothing;
