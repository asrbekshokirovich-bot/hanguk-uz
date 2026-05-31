-- ============================================================================
--  uni_db v1 — institutions, recruitment_units, programs
--  Plan §C.1 / §C.2 / §C.3
--
--  Idempotent: every table uses CREATE TABLE IF NOT EXISTS; every index
--  uses IF NOT EXISTS; policies use CREATE POLICY IF NOT EXISTS (Postgres 15+).
-- ============================================================================

set local search_path = public, pg_catalog;

-- Required extensions (no-op if already enabled at the project level).
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
--  institutions  (audit §1.1, §11; replaces flat `universities` in Phase 1)
-- ----------------------------------------------------------------------------
create table if not exists public.institutions (
  id                          uuid primary key default gen_random_uuid(),
  kcue_code                   text unique,
  wikidata_id                 text,
  name_ko                     text not null,
  name_ko_short               text,
  name_en                     text,
  romanization                text,
  institution_type            text not null check (institution_type in (
    'national','public','private','national_special',
    'cyber','specialized','junior_college','education_university'
  )),
  tier                        smallint check (tier between 0 and 4),
  ieqas_status                text check (ieqas_status in ('outstanding','accredited','none')),
  region_code                 text,
  city_ko                     text,
  latitude                    numeric(9,6),
  longitude                   numeric(9,6),
  primary_domain              text not null,
  primary_admissions_url_ko   text,
  logo_url                    text,
  is_partner                  boolean not null default false,
  is_visible_on_map           boolean not null default true,
  display_names               jsonb not null default '{}'::jsonb,
  last_verified_at            timestamptz,
  source_blob_hash            text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists institutions_type_idx        on public.institutions (institution_type);
create index if not exists institutions_tier_idx        on public.institutions (tier);
create index if not exists institutions_ieqas_idx       on public.institutions (ieqas_status);
create index if not exists institutions_region_idx      on public.institutions (region_code);
create index if not exists institutions_partner_idx     on public.institutions (is_partner);
create index if not exists institutions_name_ko_trgm    on public.institutions
  using gin (to_tsvector('simple', coalesce(name_ko, '')));

alter table public.institutions enable row level security;

drop policy if exists institutions_anon_read on public.institutions;
create policy institutions_anon_read on public.institutions
  for select using (is_visible_on_map = true);

-- ----------------------------------------------------------------------------
--  recruitment_units  (audit §4.3, plan §C.2)
-- ----------------------------------------------------------------------------
create table if not exists public.recruitment_units (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references public.institutions(id) on delete cascade,
  external_code       text,
  faculty_ko          text,
  division_ko         text,
  department_ko       text,
  major_track_ko      text,
  faculty_group       text check (faculty_group in (
    'humanities','social','natural_science','engineering',
    'arts_pe','medicine','dentistry','veterinary','pharmacy',
    'theology','interdisciplinary'
  )),
  campus              text,
  is_active           boolean not null default true,
  source_text_ko      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (institution_id, external_code)
);

create index if not exists recruitment_units_institution_idx on public.recruitment_units (institution_id);
create index if not exists recruitment_units_faculty_idx     on public.recruitment_units (faculty_group);

alter table public.recruitment_units enable row level security;

drop policy if exists recruitment_units_anon_read on public.recruitment_units;
create policy recruitment_units_anon_read on public.recruitment_units
  for select using (is_active = true);

-- ----------------------------------------------------------------------------
--  programs  (audit §4.3, plan §C.3)
-- ----------------------------------------------------------------------------
create table if not exists public.programs (
  id                       uuid primary key default gen_random_uuid(),
  institution_id           uuid not null references public.institutions(id) on delete cascade,
  name_ko                  text not null,
  degree_level             text not null check (degree_level in (
    'bachelor','master','doctoral','integrated','associate','non_degree'
  )),
  duration_years           numeric(3,1),
  language_of_instruction  text[] not null default array['ko'],
  data_go_kr_dept_code     text,
  source_text_ko           text,
  created_at               timestamptz not null default now()
);

create index if not exists programs_institution_idx on public.programs (institution_id);
create index if not exists programs_degree_idx      on public.programs (degree_level);

create table if not exists public.recruitment_unit_programs (
  recruitment_unit_id uuid not null references public.recruitment_units(id) on delete cascade,
  program_id          uuid not null references public.programs(id) on delete cascade,
  primary key (recruitment_unit_id, program_id)
);

alter table public.programs enable row level security;
drop policy if exists programs_anon_read on public.programs;
create policy programs_anon_read on public.programs for select using (true);

alter table public.recruitment_unit_programs enable row level security;
drop policy if exists recruitment_unit_programs_anon_read on public.recruitment_unit_programs;
create policy recruitment_unit_programs_anon_read
  on public.recruitment_unit_programs for select using (true);
