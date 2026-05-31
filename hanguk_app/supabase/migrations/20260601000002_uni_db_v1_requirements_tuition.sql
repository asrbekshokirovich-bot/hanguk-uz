-- ============================================================================
--  uni_db v1 — requirements, tuition
--  Plan §C.6 / §C.7
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  requirements
-- ----------------------------------------------------------------------------
create table if not exists public.requirements (
  id                       uuid primary key default gen_random_uuid(),
  cycle_id                 uuid not null references public.admission_cycles(id) on delete cascade,
  recruitment_unit_id      uuid references public.recruitment_units(id),
  applicant_category       text not null,
  topik_min_level          smallint check (topik_min_level between 1 and 6),
  topik_deferred           boolean not null default false,
  english_test             jsonb,                       -- {toefl_ibt:80, ielts:5.5, teps:297}
  gpa_floor_pct            numeric(5,2),                -- 0..100 percentile
  age_min                  smallint,
  age_max                  smallint,
  hs_grad_by               date,
  interview_required       boolean not null default false,
  practical_exam_required  boolean not null default false,
  prose_ko                 text,
  source_text_ko           text,
  extractor_confidence     numeric(3,2),
  created_at               timestamptz not null default now()
);

create index if not exists requirements_cycle_idx on public.requirements (cycle_id);
create index if not exists requirements_topik_idx on public.requirements (topik_min_level);

alter table public.requirements enable row level security;
drop policy if exists requirements_anon_read on public.requirements;
create policy requirements_anon_read on public.requirements for select using (true);

-- ----------------------------------------------------------------------------
--  tuition  (audit §4.4 — per faculty-group, year, semester)
-- ----------------------------------------------------------------------------
create table if not exists public.tuition (
  id                   uuid primary key default gen_random_uuid(),
  institution_id       uuid not null references public.institutions(id) on delete cascade,
  recruitment_unit_id  uuid references public.recruitment_units(id),
  faculty_group        text not null,
  academic_year        smallint not null,
  semester_number      smallint not null check (semester_number between 1 and 12),
  amount_krw           bigint not null check (amount_krw >= 0),
  admission_fee_krw    bigint check (admission_fee_krw >= 0),
  is_first_semester    boolean not null default false,
  source_text_ko       text,
  source_blob_hash     text,
  extractor_confidence numeric(3,2),
  created_at           timestamptz not null default now(),
  unique (institution_id, recruitment_unit_id, academic_year, semester_number, faculty_group)
);

create index if not exists tuition_institution_year_idx
  on public.tuition (institution_id, academic_year);

alter table public.tuition enable row level security;
drop policy if exists tuition_anon_read on public.tuition;
create policy tuition_anon_read on public.tuition for select using (true);
