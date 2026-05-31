-- ============================================================================
--  uni_db v1 — admission_cycles, cycle_dates
--  Plan §C.4 / §C.5
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  admission_cycles
-- ----------------------------------------------------------------------------
create table if not exists public.admission_cycles (
  id                    uuid primary key default gen_random_uuid(),
  institution_id        uuid not null references public.institutions(id) on delete cascade,
  intake_year           smallint not null,
  intake_term           text not null check (intake_term in ('spring','fall')),
  cycle_track           text not null check (cycle_track in (
    'susi','jeongsi','foreign','overseas_korean_full',
    'overseas_korean_partial','transfer','grad_general','grad_foreign'
  )),
  round_number          smallint not null default 1,
  is_unified            boolean not null default false,
  applicant_category    text,
  guideline_document_id uuid,                       -- forward-declared FK; added below
  status                text not null default 'unverified' check (status in (
    'unverified','verified','superseded'
  )),
  superseded_by_id      uuid references public.admission_cycles(id),
  source_text_ko        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (institution_id, intake_year, intake_term, cycle_track,
          round_number, applicant_category)
);

create index if not exists admission_cycles_inst_term_idx
  on public.admission_cycles (institution_id, intake_year, intake_term);
create index if not exists admission_cycles_track_idx
  on public.admission_cycles (cycle_track);
create index if not exists admission_cycles_status_idx
  on public.admission_cycles (status);

alter table public.admission_cycles enable row level security;
drop policy if exists admission_cycles_anon_read on public.admission_cycles;
create policy admission_cycles_anon_read on public.admission_cycles
  for select using (status <> 'superseded');

-- ----------------------------------------------------------------------------
--  cycle_dates  (replaces legacy `university_events`; plan §0.4.3, §C.5)
-- ----------------------------------------------------------------------------
create table if not exists public.cycle_dates (
  id                      uuid primary key default gen_random_uuid(),
  cycle_id                uuid not null references public.admission_cycles(id) on delete cascade,
  recruitment_unit_id     uuid references public.recruitment_units(id),
  event_type              text not null check (event_type in (
    'apply_open','apply_close','document_submission_deadline',
    'first_stage_results','interview','practical_exam','final_results',
    'additional_admit','registration_open','registration_close',
    'registration_withdrawal_open','registration_withdrawal_close',
    'orientation','semester_start'
  )),
  starts_at               timestamptz not null,
  ends_at                 timestamptz,
  is_tentative            boolean not null default false,
  notes_ko                text,
  source_text_ko          text,
  source_blob_hash        text,
  extractor_confidence    numeric(3,2),
  created_at              timestamptz not null default now()
);

create index if not exists cycle_dates_cycle_event_idx
  on public.cycle_dates (cycle_id, event_type);
create index if not exists cycle_dates_starts_at_idx
  on public.cycle_dates (starts_at);

alter table public.cycle_dates enable row level security;
drop policy if exists cycle_dates_anon_read on public.cycle_dates;
create policy cycle_dates_anon_read on public.cycle_dates for select using (true);
