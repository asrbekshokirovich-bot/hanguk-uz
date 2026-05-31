-- ============================================================================
--  uni_db v1 — translations, term_glossary, embedding_chunks
--  Plan §C.15 / §C.16 / §P
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  translations  (option (b) — generic table for prose; §C.15)
-- ----------------------------------------------------------------------------
create table if not exists public.translations (
  id                    uuid primary key default gen_random_uuid(),
  entity_type           text not null,
  entity_id             uuid not null,
  field_name            text not null,
  lang                  text not null,                  -- en|uz|vi|mn|ru|id|...
  text_value            text not null,
  source_lang           text not null default 'ko',
  provider              text,                           -- claude|papago|deepl|human
  confidence            numeric(3,2),
  back_trans_distance   numeric(5,2),
  reviewed_by           uuid references auth.users(id),
  reviewed_at           timestamptz,
  is_machine            boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (entity_type, entity_id, field_name, lang)
);

create index if not exists translations_lookup_idx
  on public.translations (entity_type, entity_id, field_name);

alter table public.translations enable row level security;
drop policy if exists translations_anon_read on public.translations;
create policy translations_anon_read on public.translations for select using (true);

-- ----------------------------------------------------------------------------
--  term_glossary  (§C.16 — authoritative names that bypass MT)
-- ----------------------------------------------------------------------------
create table if not exists public.term_glossary (
  id              uuid primary key default gen_random_uuid(),
  term_ko         text not null,
  term_lang       text not null,
  term_value      text not null,
  category        text check (category in (
    'institution_name','recruitment_unit_name',
    'official_term','document_type','scholarship_name'
  )),
  authoritative   boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (term_ko, term_lang, category)
);

create index if not exists term_glossary_lookup_idx
  on public.term_glossary (term_ko, term_lang);

alter table public.term_glossary enable row level security;
drop policy if exists term_glossary_anon_read on public.term_glossary;
create policy term_glossary_anon_read on public.term_glossary for select using (true);

-- ----------------------------------------------------------------------------
--  embedding_chunks (pgvector + pgroonga; audit §7.8 / plan §C.16)
--
--  pgvector and pgroonga may not be installed on the local Supabase image
--  used by `supabase start`. Both extensions are wrapped in DO-blocks so the
--  migration succeeds when only one (or neither) is available, and the
--  ivfflat / pgroonga indexes only build when the extension is present.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'vector') then
    begin
      create extension if not exists vector;
    exception when others then
      raise notice 'pgvector unavailable: %', sqlerrm;
    end;
  end if;

  if not exists (select 1 from pg_extension where extname = 'pgroonga') then
    begin
      create extension if not exists pgroonga;
    exception when others then
      raise notice 'pgroonga unavailable: %', sqlerrm;
    end;
  end if;
end $$;

create table if not exists public.embedding_chunks (
  id                       uuid primary key default gen_random_uuid(),
  guideline_document_id    uuid references public.guideline_documents(id) on delete cascade,
  institution_id           uuid references public.institutions(id) on delete cascade,
  chunk_text_ko            text not null,
  embedding                jsonb,           -- vector(1024) when pgvector available; jsonb fallback
  chunk_meta               jsonb,
  created_at               timestamptz not null default now()
);

-- If pgvector is present, swap the `embedding` column to vector(1024). The
-- ALTER is gated so re-running the migration is safe.
do $$
declare
  has_vector boolean;
  current_type text;
begin
  select exists(select 1 from pg_extension where extname = 'vector') into has_vector;
  if not has_vector then return; end if;

  select format_type(atttypid, atttypmod)
    into current_type
    from pg_attribute
    where attrelid = 'public.embedding_chunks'::regclass
      and attname  = 'embedding';

  if current_type <> 'vector(1024)' then
    alter table public.embedding_chunks
      alter column embedding type vector(1024)
      using nullif(embedding::text, '')::vector(1024);
  end if;

  if not exists (
    select 1 from pg_indexes
    where indexname = 'embedding_chunks_embedding_ivfflat'
  ) then
    execute 'create index embedding_chunks_embedding_ivfflat
             on public.embedding_chunks
             using ivfflat (embedding vector_cosine_ops) with (lists=100)';
  end if;
exception when others then
  raise notice 'embedding column upgrade skipped: %', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pgroonga')
     and not exists (
       select 1 from pg_indexes where indexname = 'embedding_chunks_text_pgroonga'
     ) then
    execute 'create index embedding_chunks_text_pgroonga
             on public.embedding_chunks
             using pgroonga (chunk_text_ko)';
  end if;
exception when others then
  raise notice 'pgroonga index skipped: %', sqlerrm;
end $$;

alter table public.embedding_chunks enable row level security;
drop policy if exists embedding_chunks_admin_only on public.embedding_chunks;
create policy embedding_chunks_admin_only on public.embedding_chunks
  for select using (false);
