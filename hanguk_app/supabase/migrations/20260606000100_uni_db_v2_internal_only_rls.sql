-- ============================================================================
--  uni_db v2 — internal-only RLS tightening (ADR-007)
--
--  Phase 0/1 left the recruitment-data tables (`institutions`,
--  `recruitment_units`, `programs`, `cycle_dates`, `requirements`,
--  `tuition`, `scholarships`, `documents_required`, `guideline_documents`,
--  `term_glossary`, `translations`) readable by anon — fine for a public
--  product but wrong for ADR-007's contracted-students-only model.
--
--  This migration:
--    1. Adds a `fn_is_app_user()` helper that returns true iff the
--       caller is an authenticated user with a profile row in one of
--       the allowed app-user roles.
--    2. Replaces every open `using (true)` / `using (is_visible_on_map=true)`
--       policy on the recruitment tables with `using (fn_is_app_user())`.
--    3. Extends the profiles role CHECK to include 'contracted_student'
--       (forward-compat — 'student' continues to work because the
--       existing magic-code flow only generates codes for contracted
--       students per ADR-007).
--
--  The user-scoped tables (user_tracked_universities, user_alerts,
--  review_decisions) already use `auth.uid() = user_id` style policies
--  and need no change.
--
--  The admin-only tables (announcement_sources, announcements,
--  crawl_runs, crawl_findings, change_events, extraction_jobs,
--  embedding_chunks) use `using (false)` and are untouched —
--  service_role bypasses RLS as before.
--
--  Idempotent: DROP POLICY IF EXISTS + CREATE POLICY chain.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  1. Allowed-roles superset, with 'contracted_student' added.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'student',                  -- legacy CRM rows (existing prod values)
    'contracted_student',       -- ADR-007 — explicit name for new sign-ups
    'counselor',                -- internal staff using counselor-side UX
    'admin',                    -- founders / ops
    'uni_db_reviewer'           -- HITL reviewer (ADR-005)
  ));

-- ----------------------------------------------------------------------------
--  2. Helper — true iff caller has an auth session AND a profile row
--     with one of the allowed app-user roles.
-- ----------------------------------------------------------------------------
create or replace function public.fn_is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role in (
        'student','contracted_student','counselor','admin','uni_db_reviewer'
      )
  );
$$;

revoke all on function public.fn_is_app_user() from public;
grant  execute on function public.fn_is_app_user() to anon, authenticated;

comment on function public.fn_is_app_user() is
  'ADR-007 access-boundary helper. Returns true for any authenticated '
  'user with a profiles row in an app-user role.';

-- ----------------------------------------------------------------------------
--  3. Replace open policies with `fn_is_app_user()` checks.
-- ----------------------------------------------------------------------------

-- institutions
drop policy if exists institutions_anon_read on public.institutions;
create policy institutions_app_read on public.institutions
  for select using (is_visible_on_map = true and public.fn_is_app_user());

-- recruitment_units
drop policy if exists recruitment_units_anon_read on public.recruitment_units;
create policy recruitment_units_app_read on public.recruitment_units
  for select using (is_active = true and public.fn_is_app_user());

-- programs + recruitment_unit_programs
drop policy if exists programs_anon_read on public.programs;
create policy programs_app_read on public.programs
  for select using (public.fn_is_app_user());

drop policy if exists recruitment_unit_programs_anon_read on public.recruitment_unit_programs;
create policy recruitment_unit_programs_app_read on public.recruitment_unit_programs
  for select using (public.fn_is_app_user());

-- admission_cycles
drop policy if exists admission_cycles_anon_read on public.admission_cycles;
create policy admission_cycles_app_read on public.admission_cycles
  for select using (status <> 'superseded' and public.fn_is_app_user());

-- cycle_dates
drop policy if exists cycle_dates_anon_read on public.cycle_dates;
create policy cycle_dates_app_read on public.cycle_dates
  for select using (public.fn_is_app_user());

-- requirements
drop policy if exists requirements_anon_read on public.requirements;
create policy requirements_app_read on public.requirements
  for select using (public.fn_is_app_user());

-- tuition
drop policy if exists tuition_anon_read on public.tuition;
create policy tuition_app_read on public.tuition
  for select using (public.fn_is_app_user());

-- scholarships
drop policy if exists scholarships_anon_read on public.scholarships;
create policy scholarships_app_read on public.scholarships
  for select using (public.fn_is_app_user());

-- documents_required
drop policy if exists documents_required_anon_read on public.documents_required;
create policy documents_required_app_read on public.documents_required
  for select using (public.fn_is_app_user());

-- guideline_documents
drop policy if exists guideline_documents_anon_read on public.guideline_documents;
create policy guideline_documents_app_read on public.guideline_documents
  for select using (public.fn_is_app_user());

-- term_glossary
drop policy if exists term_glossary_anon_read on public.term_glossary;
create policy term_glossary_app_read on public.term_glossary
  for select using (public.fn_is_app_user());

-- translations
drop policy if exists translations_anon_read on public.translations;
create policy translations_app_read on public.translations
  for select using (public.fn_is_app_user());

-- profiles read remains unchanged: profiles_self_read keeps each user
-- to their own row; profiles_self_upsert lets them maintain it. No
-- ADR-007 change here.

comment on schema public is
  'Hanguk uni_db v2 — internal tool for contracted students (ADR-007).';
