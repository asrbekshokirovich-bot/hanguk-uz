-- ============================================================================
--  uni_db v3 — DROP legacy public.universities
--
--  Phase 3R-B per docs/runbooks/next-session-prompt.md, executed
--  2026-05-10 with Asrbek's explicit go-ahead. The legacy table held
--  697 rows, all of which are confirmed test/fake data per Asrbek
--  (counselor team will rebuild the canonical list against
--  public.institutions after this lands).
--
--  Decisions captured here:
--    - Drop legacy entirely (no `legacy_universities` rename).
--    - Treat every legacy row uniformly (no per-row guard rails for
--      the 5 ostensible "partner" rows — none of them are real
--      partners yet).
--    - Wipe the application/priority test data that points at the
--      fake universities. Preserve interview_sessions / study_plan_sessions
--      content (they have other useful columns), just NULL the
--      target_university_id refs.
--    - For the kept tables (gks_designated_universities,
--      university_programs, university_admission_periods,
--      university_documents, university_rooms): loosen NOT NULL on
--      university_id and NULL the orphan refs. Their non-FK columns
--      are preserved. A follow-up migration adds new FKs pointing at
--      public.institutions(id) once Asrbek seeds real rows there.
--    - Drop the 5 always-empty university_* tables per the audit's
--      cleanup scope.
--    - Drop the two legacy_compat helpers in public schema (they
--      reference public.universities and would break otherwise).
--
--  Single-transaction migration (Supabase wraps each migration file
--  in BEGIN/COMMIT automatically). All-or-nothing.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
-- 1. Forensic backup snapshot of legacy universities + priority/application
--    rows that are about to be wiped. Kept for one quarter, then dropped.
--
--    Names are date-stamped so re-running this migration on a different
--    project (staging vs prod) doesn't collide with a prior snapshot.
-- ----------------------------------------------------------------------------

create table if not exists public.universities_backup_20260510 as
  select * from public.universities;
comment on table public.universities_backup_20260510 is
  'Forensic snapshot of public.universities before Phase 3R-B drop on 2026-05-10. Test data only. Drop after Phase 3R-C completes.';

create table if not exists public.applications_with_uni_backup_20260510 as
  select * from public.applications where university_id is not null;
comment on table public.applications_with_uni_backup_20260510 is
  'Test applications referencing the dropped universities table. Forensic only.';

create table if not exists public.student_university_priorities_backup_20260510 as
  select * from public.student_university_priorities;
comment on table public.student_university_priorities_backup_20260510 is
  'All student_university_priorities rows (33) — confirmed test data per Asrbek 2026-05-10.';

-- Per Asrbek: gks_designated_universities (200) + university_programs (104) +
-- university_admission_periods (5) + university_documents (4) + university_rooms (9)
-- KEEP the rows but their university_id FK becomes orphaned. We snapshot
-- them too so we can audit the FK rewire later.
create table if not exists public.gks_designated_universities_backup_20260510 as
  select * from public.gks_designated_universities;
create table if not exists public.university_programs_backup_20260510 as
  select * from public.university_programs;

-- ----------------------------------------------------------------------------
-- 2. Drop foreign-key constraints from every referencing table BEFORE we
--    null/delete the column values. Otherwise a NOT NULL FK violation
--    would block the next step.
-- ----------------------------------------------------------------------------

alter table public.applications
  drop constraint if exists applications_university_id_fkey;
alter table public.application_form_cache
  drop constraint if exists application_form_cache_university_id_fkey;
alter table public.application_form_changes
  drop constraint if exists application_form_changes_university_id_fkey;
alter table public.application_form_validations
  drop constraint if exists application_form_validations_university_id_fkey;
alter table public.gks_designated_universities
  drop constraint if exists gks_designated_universities_university_id_fkey;
alter table public.interview_questions
  drop constraint if exists interview_questions_university_id_fkey;
alter table public.interview_sessions
  drop constraint if exists interview_sessions_target_university_id_fkey;
alter table public.legacy_scholarships
  drop constraint if exists scholarships_university_id_fkey;
alter table public.peer_review_queue
  drop constraint if exists peer_review_queue_university_id_fkey;
alter table public.student_suggestions
  drop constraint if exists student_suggestions_university_id_fkey;
alter table public.student_university_priorities
  drop constraint if exists student_university_priorities_university_id_fkey;
alter table public.study_plan_sessions
  drop constraint if exists study_plan_sessions_target_university_id_fkey;
alter table public.university_admission_periods
  drop constraint if exists university_admission_periods_university_id_fkey;
alter table public.university_admissions
  drop constraint if exists university_admissions_university_id_fkey;
alter table public.university_document_requirements
  drop constraint if exists university_document_requirements_university_id_fkey;
alter table public.university_documents
  drop constraint if exists university_documents_university_id_fkey;
alter table public.university_notes
  drop constraint if exists university_notes_university_id_fkey;
alter table public.university_programs
  drop constraint if exists university_programs_university_id_fkey;
alter table public.university_rooms
  drop constraint if exists university_rooms_university_id_fkey;
alter table public.university_staff_assignments
  drop constraint if exists university_staff_assignments_university_id_fkey;

-- ----------------------------------------------------------------------------
-- 3. Loosen NOT NULL on the FK columns of tables we're keeping. This lets
--    us null the orphan refs without losing the row.
--
--    Tables we keep (per next-session-prompt §Cleanup):
--      gks_designated_universities, university_programs,
--      university_admission_periods, university_documents, university_rooms.
--    Plus the form-cache trio (currently 0 rows, but may grow), and the
--    "to be dropped" tables get loosened too just so we can null them
--    before drop (or skip if dropping the whole table).
-- ----------------------------------------------------------------------------

alter table public.application_form_cache
  alter column university_id drop not null;
alter table public.application_form_changes
  alter column university_id drop not null;
alter table public.application_form_validations
  alter column university_id drop not null;
alter table public.gks_designated_universities
  alter column university_id drop not null;
alter table public.university_admission_periods
  alter column university_id drop not null;
alter table public.university_documents
  alter column university_id drop not null;
alter table public.university_programs
  alter column university_id drop not null;
alter table public.university_rooms
  alter column university_id drop not null;

-- student_suggestions has NOT NULL university_id and 0 rows; we'll drop
-- the column constraint just for forward compatibility (so future writes
-- can omit the legacy ref).
alter table public.student_suggestions
  alter column university_id drop not null;

-- ----------------------------------------------------------------------------
-- 4. Delete or NULL the orphan FK refs.
--
--    DELETE rows where the entire row is test data tied to a fake uni:
--      - applications (7 rows, all reference fake unis per Asrbek)
--    NULL rows where the row has independent value, just the FK to a
--    fake uni is orphan:
--      - interview_sessions (155 rows — preserve session history)
--      - study_plan_sessions (23 rows — preserve session history)
--      - interview_questions (19 rows — preserve question content)
--      - student_university_priorities (33 rows — backed up; nullify
--        rather than delete so user can see what was there)
--      - gks_designated_universities (200 rows — preserve gks list)
--      - university_programs (104 rows)
--      - university_admission_periods (5 rows)
--      - university_documents (4 rows)
--      - university_rooms (9 rows — staff chat rooms; preserve)
-- ----------------------------------------------------------------------------

delete from public.applications;  -- 7 rows, all test data per Asrbek

update public.student_university_priorities set university_id = null;
update public.interview_sessions             set target_university_id = null;
update public.interview_questions            set university_id = null;
update public.university_programs            set university_id = null;
update public.university_admission_periods   set university_id = null;
update public.university_documents           set university_id = null;
update public.university_rooms               set university_id = null;
update public.gks_designated_universities    set university_id = null;
update public.study_plan_sessions            set target_university_id = null;

-- 0-row tables: no-op updates kept for explicitness / parity
update public.application_form_cache         set university_id = null;
update public.application_form_changes       set university_id = null;
update public.application_form_validations   set university_id = null;
update public.university_document_requirements set university_id = null;
update public.peer_review_queue              set university_id = null;
update public.legacy_scholarships            set university_id = null;
update public.student_suggestions            set university_id = null;

-- ----------------------------------------------------------------------------
-- 5. Drop the legacy_compat functions (they reference public.universities).
-- ----------------------------------------------------------------------------

drop function if exists public.fn_copy_legacy_universities_to_institutions();
drop function if exists public.fn_legacy_universities_present();

-- ----------------------------------------------------------------------------
-- 6. Drop public.universities (CASCADE wipes the auto-generated
--    update_universities_updated_at trigger and any remaining indexes).
-- ----------------------------------------------------------------------------

drop table if exists public.universities cascade;

-- ----------------------------------------------------------------------------
-- 7. Drop the 5 never-populated university_* tables per audit cleanup scope.
-- ----------------------------------------------------------------------------

drop table if exists public.university_admissions          cascade;
drop table if exists public.university_announcements       cascade;
drop table if exists public.university_events              cascade;
drop table if exists public.university_notes               cascade;
drop table if exists public.university_staff_assignments   cascade;

-- ----------------------------------------------------------------------------
--  Notes for the follow-up migration:
--
--  - The remaining tables (gks_designated_universities, university_programs,
--    university_admission_periods, university_documents, university_rooms,
--    interview_sessions, study_plan_sessions, etc) still have a `university_id`
--    or `target_university_id` column shape, but no FK constraint. The
--    follow-up migration `20260510130100_uni_db_v3_add_institution_fks.sql`
--    adds a NEW FK from those columns to public.institutions(id) on delete
--    set null, so future rows reference the canonical institutions list.
--  - The React CRM in hanguk-uz still calls supabase.from('universities').*
--    in src/hooks/useUniversities.ts and the 4 university components. Those
--    queries will start returning errors against a non-existent table after
--    this migration applies. The companion CRM patch (Phase 3R-B step 5)
--    swaps useUniversities for a new useInstitutions hook before the merge
--    to the hanguk-uz main branch.
-- ----------------------------------------------------------------------------
