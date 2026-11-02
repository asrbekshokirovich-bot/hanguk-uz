-- Hanguk AI 2.0 — 1-bosqich: yo'riqnoma PDF matni (reja §5.2).
--
-- guideline-blobs'dagi PDF'lar (2026-10-29: 263 hujjat, 1,3 GB) hech qachon
-- matnga aylantirilmagan; embedding_chunks bo'sh. guideline-index edge
-- funksiyasi PDF'ni sahifa-sahifa o'qiydi, bo'laklaydi, gemini-embedding-001
-- (1024 o'lcham, jadval ustuni shunday) bilan vektorlaydi va shu yerga yozadi.
--
--   embedding_chunks.page / chunk_index   iqtibos uchun sahifa raqami
--   guideline_index_state                 har hujjat: holat, sahifa, bo'lak, xato
--   ai_guideline_index_next()             navbatdagi hujjatlar (joriy mavsum birinchi)
--   guideline_text_search()               gibrid qidiruv: PGroonga + pgvector (RRF)
--   cron guideline-index-10min            har 10 daqiqada navbatni yuradi

alter table public.embedding_chunks
  add column if not exists page integer,
  add column if not exists chunk_index integer;

-- ivfflat was built on an empty table (its lists are meaningless); HNSW needs no training.
drop index if exists public.embedding_chunks_embedding_ivfflat;
create index if not exists embedding_chunks_embedding_hnsw
  on public.embedding_chunks using hnsw (embedding vector_cosine_ops) with (m = '16', ef_construction = '64');
create unique index if not exists embedding_chunks_doc_chunk_idx
  on public.embedding_chunks (guideline_document_id, chunk_index);

create table if not exists public.guideline_index_state (
  guideline_document_id uuid primary key references public.guideline_documents(id) on delete cascade,
  file_hash text,
  status text not null check (status in ('done', 'no_text', 'failed', 'skipped')),
  pages integer,
  chunks integer,
  chars integer,
  attempts integer not null default 0,
  error text,
  indexed_at timestamptz not null default now()
);

comment on table public.guideline_index_state is
  'guideline-index progress per guideline PDF. no_text = no extractable text (scanned / image PDF).';

alter table public.guideline_index_state enable row level security;
drop policy if exists guideline_index_state_staff_read on public.guideline_index_state;
create policy guideline_index_state_staff_read on public.guideline_index_state
  for select to authenticated using (public.is_non_investor_staff());

create or replace function public.ai_guideline_index_next(p_limit integer default 3)
returns table (
  id uuid, institution_id uuid, storage_path text, mime_type text, file_hash text,
  academic_year smallint, semester text, source_url_ko text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.institution_id, d.storage_path, d.mime_type, d.file_hash_sha256,
         d.academic_year, d.semester, d.source_url_ko
    from guideline_documents d
    left join guideline_index_state s on s.guideline_document_id = d.id
   where d.superseded_by_id is null
     and d.storage_path is not null
     and (d.storage_path ilike '%.pdf'
          or d.mime_type in ('application/pdf', 'application/download', 'application/octet-stream'))
     and (s.guideline_document_id is null
          or (s.status = 'failed' and s.attempts < 3)
          or s.file_hash is distinct from d.file_hash_sha256)
   order by (d.academic_year = (select qabul_yili from ai_uni_season())) desc nulls last,
            d.academic_year desc nulls last,
            d.fetched_at desc nulls last
   limit greatest(1, least(coalesce(p_limit, 3), 20));
$$;

revoke all on function public.ai_guideline_index_next(integer) from public, anon, authenticated;
grant execute on function public.ai_guideline_index_next(integer) to service_role;

create or replace function public.guideline_text_search(
  p_query text,
  p_query_ko text default null,
  p_embedding vector(1024) default null,
  p_institution_id uuid default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
set statement_timeout = '8s'
as $$
declare
  v_n integer := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_q text := nullif(btrim(coalesce(nullif(btrim(coalesce(p_query_ko, '')), ''), p_query, '')), '');
  v jsonb;
begin
  begin
    perform set_config('hnsw.iterative_scan', 'strict_order', true);
    perform set_config('hnsw.ef_search', '100', true);
  exception when undefined_object then
    null;
  end;

  with fts as (
    select c.id, row_number() over (order by pgroonga_score(c.tableoid, c.ctid) desc) as rank
      from embedding_chunks c
     where v_q is not null
       and c.chunk_text_ko &@~ v_q
       and (p_institution_id is null or c.institution_id = p_institution_id)
     limit 60
  ),
  sem as (
    select c.id, row_number() over (order by c.embedding <=> p_embedding) as rank
      from embedding_chunks c
     where p_embedding is not null and c.embedding is not null
       and (p_institution_id is null or c.institution_id = p_institution_id)
     order by c.embedding <=> p_embedding
     limit 60
  ),
  fused as (
    select coalesce(fts.id, sem.id) as id,
           coalesce(1.0 / (50 + fts.rank), 0) + coalesce(1.0 / (50 + sem.rank), 0) as score
      from fts full outer join sem on fts.id = sem.id
     order by 2 desc
     limit v_n
  )
  select jsonb_agg(jsonb_build_object(
           'university', coalesce(i.name_en, i.name_ko),
           'institution_id', c.institution_id,
           'document_id', c.guideline_document_id,
           'academic_year', d.academic_year,
           'semester', d.semester,
           'page', c.page,
           'text', left(c.chunk_text_ko, 1400),
           'official_url', d.source_url_ko,
           'score', round(f.score::numeric, 4))
         order by f.score desc)
    into v
    from fused f
    join embedding_chunks c on c.id = f.id
    left join guideline_documents d on d.id = c.guideline_document_id
    left join institutions i on i.id = c.institution_id;

  return jsonb_build_object(
    'indexed_documents', (select count(*) from guideline_index_state where status = 'done'),
    'results', coalesce(v, '[]'::jsonb),
    'note', 'text is the guideline PDF (mostly Korean); cite the page');
end;
$$;

revoke all on function public.guideline_text_search(text, text, vector, uuid, integer) from public, anon;
grant execute on function public.guideline_text_search(text, text, vector, uuid, integer) to authenticated, service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'guideline-index-10min') then
    perform cron.unschedule('guideline-index-10min');
  end if;
end $$;

select cron.schedule(
  'guideline-index-10min',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/guideline-index',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000)
    where exists (select 1 from public.ai_guideline_index_next(1));
  $cron$
);
