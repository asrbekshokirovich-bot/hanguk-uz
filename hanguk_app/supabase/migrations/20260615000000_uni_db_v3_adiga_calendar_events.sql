-- ============================================================================
--  uni_db v3 — adiga_calendar_events
--
--  Stores national admissions-calendar events scraped from KCUE/Adiga
--  (https://www.adiga.kr/, /uct/cas/scheduleAjax.do). Source of truth for
--  the unified admissions calendar covering ~330 four-year universities and
--  ~130 junior colleges (수시 / 정시 / 재외국민 / 외국인 cycles).
--
--  Why a separate table instead of writing into admission_cycles + cycle_dates:
--    1. Adiga events are *national-level* (institution_name_ko=None in 100% of
--       observed rows). admission_cycles.institution_id is NOT NULL, so the
--       fit isn't natural.
--    2. cycle_dates.event_type has a 13-value CHECK constraint with English
--       names; Adiga publishes ~30+ Korean event names that don't 1:1 map.
--    3. Preserving Adiga's authoritative Korean phrasing is valuable —
--       lossy normalization is a one-way street.
--
--  Producer: services/uni_db/src/uni_db/workers/adiga_calendar_worker.py
--  Plan: §N.1 (KCUE upstream — calendar materialized view).
-- ============================================================================

set local search_path = public, pg_catalog;

create table if not exists public.adiga_calendar_events (
  id                        uuid primary key default gen_random_uuid(),

  -- Adiga's authoritative phrasing
  subject_ko                text not null,
  track_ko                  text,
  event_name_ko             text not null,
  schedule_type             text not null check (schedule_type in ('01','02')),
  -- 01 = 수시 (early admission), 02 = 정시 (regular admission)

  begin_date                date not null,
  end_date                  date not null,
  gubun                     text,

  -- Per-school events (currently always null in aggregated view; future-proof)
  institution_id            uuid references public.institutions(id) on delete set null,
  institution_name_ko_raw   text,
  remarks_ko                text,

  -- Provenance
  source_blob_hash          text,
  fetched_at                timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Idempotency key: same subject + date span = same event
  unique (subject_ko, begin_date, end_date)
);

create index if not exists adiga_calendar_events_track_idx
  on public.adiga_calendar_events (track_ko);
create index if not exists adiga_calendar_events_begin_idx
  on public.adiga_calendar_events (begin_date);
create index if not exists adiga_calendar_events_schedule_type_idx
  on public.adiga_calendar_events (schedule_type);
create index if not exists adiga_calendar_events_institution_idx
  on public.adiga_calendar_events (institution_id)
  where institution_id is not null;

-- RLS — open read. KCUE/Adiga calendar is public government data; no auth
-- gating needed. Writes are service-role only (no insert/update/delete policy).
alter table public.adiga_calendar_events enable row level security;
drop policy if exists adiga_calendar_events_anon_read on public.adiga_calendar_events;
create policy adiga_calendar_events_anon_read on public.adiga_calendar_events
  for select using (true);

-- updated_at trigger — reuses the existing baseline function so we don't
-- proliferate near-identical trigger functions across the schema.
drop trigger if exists adiga_calendar_events_set_updated_at on public.adiga_calendar_events;
create trigger adiga_calendar_events_set_updated_at
  before update on public.adiga_calendar_events
  for each row execute function public.update_updated_at_column();

comment on table public.adiga_calendar_events is
  'KCUE/Adiga unified admissions-calendar events (scraped weekly). Idempotent on (subject_ko, begin_date, end_date).';
comment on column public.adiga_calendar_events.schedule_type is
  'KCUE schedule type code: 01=수시 (early admission), 02=정시 (regular admission)';
comment on column public.adiga_calendar_events.gubun is
  'KCUE classification token from scheduleAjax.do (e.g. FTR). Semantics TBD; preserved for forensic use.';
