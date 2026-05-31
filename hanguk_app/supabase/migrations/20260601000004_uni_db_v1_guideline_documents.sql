-- ============================================================================
--  uni_db v1 — guideline_documents (immutable raw blobs metadata)
--  Plan §C.10
-- ============================================================================

set local search_path = public, pg_catalog;

create table if not exists public.guideline_documents (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references public.institutions(id) on delete cascade,
  source_url_ko       text not null,                       -- §P-1: KO only
  storage_path        text not null,                       -- guideline-blobs/sha256/...
  file_hash_sha256    text not null,
  file_size_bytes     bigint,
  mime_type           text,
  http_etag           text,
  http_last_modified  text,
  fetched_at          timestamptz not null default now(),
  parsed_version      int not null default 0,
  parse_status        text not null default 'pending' check (parse_status in (
    'pending','running','succeeded','failed','superseded'
  )),
  archetype           text check (archetype in ('A','B','C','D','E','F','G','H')),
  language            text not null default 'ko',
  superseded_by_id    uuid references public.guideline_documents(id),
  unique (file_hash_sha256)
);

create index if not exists guideline_documents_inst_fetched_idx
  on public.guideline_documents (institution_id, fetched_at desc);
create index if not exists guideline_documents_parse_status_idx
  on public.guideline_documents (parse_status);

alter table public.guideline_documents enable row level security;
drop policy if exists guideline_documents_anon_read on public.guideline_documents;
create policy guideline_documents_anon_read on public.guideline_documents
  for select using (true);

-- Backfill the forward-declared FK on admission_cycles.guideline_document_id
-- now that the target table exists. Idempotent guard via pg_constraint lookup.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admission_cycles_guideline_document_id_fkey'
  ) then
    alter table public.admission_cycles
      add constraint admission_cycles_guideline_document_id_fkey
      foreign key (guideline_document_id)
      references public.guideline_documents(id)
      on delete set null;
  end if;
end $$;
