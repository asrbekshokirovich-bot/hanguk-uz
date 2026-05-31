-- ============================================================================
--  uni_db v3 — rename university_id → institution_id + add FKs to institutions
--
--  Phase 3R-B follow-up to 20260510130000_uni_db_v3_drop_legacy_universities.
--
--  After the legacy public.universities table was dropped, the surviving
--  tables still carried their old `university_id` (or `target_university_id`)
--  columns with values nulled to detach them. This migration:
--
--    1. renames every such column to `institution_id` (or
--       `target_institution_id`) so the schema reflects the new world,
--    2. adds a fresh FK to public.institutions(id) on delete set null
--       so future writes are constrained to canonical rows,
--    3. updates the one RLS policy on public.room_members that
--       referenced `ur.university_id = a.university_id`.
--
--  Idempotent via IF EXISTS / IF NOT EXISTS guards on column renames
--  and constraint creation.
--
--  CRM cutover (separate hanguk-uz patch): the React staff CRM still
--  queries `from('university_programs').select('*, university_id')`-style
--  in src/hooks/useUniversityPrograms.ts etc. Those queries will start
--  returning a missing-column error after this migration runs. The
--  companion patch (handoff/0002-hanguk-uz-rename-to-institution.patch)
--  swaps to `institution_id`.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
-- 1. Update room_members RLS policy BEFORE renaming the column it references.
--    Re-derives the join through public.applications -> public.university_rooms
--    on the new institution_id columns.
-- ----------------------------------------------------------------------------

drop policy if exists "Users can join rooms for their applications" on public.room_members;

-- ----------------------------------------------------------------------------
-- 2. Rename university_id → institution_id (or target_university_id →
--    target_institution_id) on every surviving table, guarded so re-running
--    the migration is a no-op.
-- ----------------------------------------------------------------------------

do $$
declare r record;
begin
  -- university_id columns
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name  = 'university_id'
      and table_name in (
        'applications',
        'application_form_cache',
        'application_form_changes',
        'application_form_validations',
        'gks_designated_universities',
        'interview_questions',
        'legacy_scholarships',
        'peer_review_queue',
        'student_suggestions',
        'student_university_priorities',
        'university_admission_periods',
        'university_document_requirements',
        'university_documents',
        'university_programs',
        'university_rooms'
      )
  loop
    execute format('alter table public.%I rename column %I to institution_id',
                   r.table_name, r.column_name);
  end loop;

  -- target_university_id columns
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name  = 'target_university_id'
      and table_name in ('interview_sessions','study_plan_sessions')
  loop
    execute format('alter table public.%I rename column %I to target_institution_id',
                   r.table_name, r.column_name);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Add new FKs from the renamed columns to public.institutions(id).
--    All FKs are ON DELETE SET NULL so deleting an institution doesn't
--    cascade-wipe existing application/interview/program data.
-- ----------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select c.table_name, c.column_name,
           c.table_name || '_' || c.column_name || '_fkey' as fk_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and (c.column_name = 'institution_id' or c.column_name = 'target_institution_id')
      and c.table_name in (
        'applications',
        'application_form_cache',
        'application_form_changes',
        'application_form_validations',
        'gks_designated_universities',
        'interview_questions',
        'interview_sessions',
        'legacy_scholarships',
        'peer_review_queue',
        'student_suggestions',
        'student_university_priorities',
        'study_plan_sessions',
        'university_admission_periods',
        'university_document_requirements',
        'university_documents',
        'university_programs',
        'university_rooms'
      )
      -- Only create the FK if it doesn't already exist.
      and not exists (
        select 1 from pg_constraint
        where conname = c.table_name || '_' || c.column_name || '_fkey'
      )
  loop
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.institutions(id) on delete set null',
      r.table_name, r.fk_name, r.column_name
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Recreate the room_members RLS policy against the renamed columns.
-- ----------------------------------------------------------------------------

create policy "Users can join rooms for their applications" on public.room_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.applications a
      join public.university_rooms ur on ur.institution_id = a.institution_id
      where a.student_id = auth.uid()
        and ur.id = room_members.room_id
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Add indexes on the new FK columns for the kept tables that are likely
--    to be queried by institution_id (the legacy university_id had its own
--    indexes already, captured below for parity).
-- ----------------------------------------------------------------------------

create index if not exists idx_university_programs_institution_id
  on public.university_programs (institution_id);
create index if not exists idx_university_admission_periods_institution_id
  on public.university_admission_periods (institution_id);
create index if not exists idx_university_documents_institution_id
  on public.university_documents (institution_id);
create index if not exists idx_university_rooms_institution_id
  on public.university_rooms (institution_id);
create index if not exists idx_gks_designated_universities_institution_id
  on public.gks_designated_universities (institution_id);
create index if not exists idx_applications_institution_id
  on public.applications (institution_id);
create index if not exists idx_student_university_priorities_institution_id
  on public.student_university_priorities (institution_id);
create index if not exists idx_interview_sessions_target_institution_id
  on public.interview_sessions (target_institution_id);
create index if not exists idx_study_plan_sessions_target_institution_id
  on public.study_plan_sessions (target_institution_id);
