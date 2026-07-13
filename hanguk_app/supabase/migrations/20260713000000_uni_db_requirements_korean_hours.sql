-- ============================================================================
--  uni_db — minimum Korean-language study hours on requirements
--
--  Some guidelines admit applicants with N hours of Korean-language study at
--  a university language institute in lieu of (or alongside) a TOPIK level.
--  The app must surface this eligibility minimum next to topik_min_level, so
--  the extraction schema gained `korean_hours_min` and the publish worker now
--  maps it here. Additive only; nothing is dropped or rewritten.
-- ============================================================================

set local search_path = public, pg_catalog;

alter table public.requirements
  add column if not exists korean_hours_min smallint
  check (korean_hours_min is null or korean_hours_min >= 0);

comment on column public.requirements.korean_hours_min is
  'Minimum Korean-language study hours (한국어 연수 시간) accepted for eligibility, when the guideline states one.';
