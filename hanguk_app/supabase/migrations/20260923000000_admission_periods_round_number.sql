-- ============================================================================
--  university_admission_periods — add round_number (다차수 모집 지원)
--
--  Korean universities routinely run 2-4 separate application rounds per
--  semester (1차/2차/3차/4차 모집), each with its own deadlines. The
--  extractor already reads them all off the PDF, but this table's unique
--  key — (institution_id, semester, year, program_level, language_track) —
--  has no round in it, so publishing a second round's dates overwrote the
--  first round's row via ON CONFLICT DO UPDATE. Only the last-published
--  round ever survived.
--
--  Adds round_number (default 1, so every existing row keeps its current
--  identity unchanged) and folds it into the unique key so each round gets
--  its own row going forward.
-- ============================================================================

set local search_path = public, pg_catalog;

alter table public.university_admission_periods
  add column if not exists round_number smallint not null default 1;

comment on column public.university_admission_periods.round_number is
  'Which application round (1차/2차/3차/4차 모집) these dates belong to. Default 1 for documents where the guideline does not distinguish rounds.';

alter table public.university_admission_periods
  drop constraint if exists university_admission_periods_university_id_semester_year_pr_key;

alter table public.university_admission_periods
  add constraint university_admission_periods_institution_semester_year_pr_key
  unique (institution_id, semester, year, program_level, language_track, round_number);
