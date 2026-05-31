-- ============================================================================
--  uni_db v1 — scholarships, documents_required
--  Plan §C.8 / §C.9
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  scholarships
-- ----------------------------------------------------------------------------
create table if not exists public.scholarships (
  id                     uuid primary key default gen_random_uuid(),
  institution_id         uuid references public.institutions(id) on delete cascade,
  scope                  text not null check (scope in (
    'national','university','department','foundation','regional'
  )),
  name_ko                text not null,
  name_en                text,
  award_type             text not null check (award_type in (
    'tuition_waiver_pct','tuition_waiver_krw','stipend_monthly','airfare','other'
  )),
  award_value            numeric,
  applicant_categories   text[],
  topik_tier_table       jsonb,                  -- {3:40, 4:50, 5:70}
  eligibility_predicate  jsonb,                  -- structured rules (audit §5.3)
  prose_ko               text,
  source_text_ko         text,
  source_blob_hash       text,
  extractor_confidence   numeric(3,2),
  created_at             timestamptz not null default now()
);

create index if not exists scholarships_institution_idx on public.scholarships (institution_id);
create index if not exists scholarships_scope_idx       on public.scholarships (scope);

alter table public.scholarships enable row level security;
drop policy if exists scholarships_anon_read on public.scholarships;
create policy scholarships_anon_read on public.scholarships for select using (true);

-- ----------------------------------------------------------------------------
--  documents_required
-- ----------------------------------------------------------------------------
create table if not exists public.documents_required (
  id                       uuid primary key default gen_random_uuid(),
  cycle_id                 uuid not null references public.admission_cycles(id) on delete cascade,
  applicant_category       text not null,
  document_type            text not null,
  is_required              boolean not null default true,
  is_apostille_required    boolean not null default false,
  country_specific         jsonb,                -- {CN:{notarization:true},UZ:{consular:true}}
  notes_ko                 text,
  source_text_ko           text,
  created_at               timestamptz not null default now()
);

create index if not exists documents_required_cycle_idx
  on public.documents_required (cycle_id, applicant_category);

alter table public.documents_required enable row level security;
drop policy if exists documents_required_anon_read on public.documents_required;
create policy documents_required_anon_read on public.documents_required for select using (true);
