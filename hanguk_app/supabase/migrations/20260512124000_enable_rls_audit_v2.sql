-- ─────────────────────────────────────────────────────────────────────────────
-- 20260512124000 — RLS audit closure v2 (replaces 20260512122000)
--
-- The v1 migration assumed every user-scoped table has a `user_id`
-- column. That's wrong: most tables in this codebase use `student_id`
-- (because the auth user IS the student), and the join tables under
-- interview_* and study_plan_* link to a parent via `session_id`
-- instead. This v2 migration uses the actual ownership column per table.
--
-- Column map (verified via information_schema):
--   profiles.user_id           — direct owner
--   user_roles.user_id         — direct owner
--   applications.student_id    — direct owner
--   documents.student_id       — direct owner
--   interview_sessions.student_id  — direct owner
--   study_plan_sessions.student_id — direct owner
--   study_plan_drafts.student_id   — direct owner
--   student_suggestions.student_id — direct owner
--   interview_feedback.session_id  → interview_sessions.student_id
--   interview_messages.session_id  → interview_sessions.student_id
--   study_plan_analyses.session_id → study_plan_sessions.student_id
--   study_plan_chat_history.session_id → study_plan_sessions.student_id
--
-- All operations are idempotent: enable RLS is safe to re-run, and
-- policy creates are guarded with `if not exists`.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: enable RLS on a table iff it exists.
create or replace function public._rls_enable_if_table_exists(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
exception when undefined_table then
  raise notice 'Table public.% does not exist, skipping enable', p_table;
end;
$$;

-- Helper: create owner-only S/I/U/D policies on a table whose direct
-- ownership column is p_owner_col (passed by name).
create or replace function public._rls_add_owner_policies_col(p_table text, p_owner_col text)
returns void
language plpgsql
as $$
begin
  -- SELECT
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_select'
  ) then
    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = %I)',
      p_table || '_owner_select', p_table, p_owner_col
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_insert'
  ) then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = %I)',
      p_table || '_owner_insert', p_table, p_owner_col
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_update'
  ) then
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = %I) with check (auth.uid() = %I)',
      p_table || '_owner_update', p_table, p_owner_col, p_owner_col
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_delete'
  ) then
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = %I)',
      p_table || '_owner_delete', p_table, p_owner_col
    );
  end if;
exception when undefined_table or undefined_column then
  raise notice 'Table or column public.%(%) not found; skipping policies', p_table, p_owner_col;
end;
$$;

-- Helper: create owner-only policies on a child table whose ownership
-- is via session_id -> p_parent_table.id (where p_parent_table has
-- a `student_id` ownership column).
create or replace function public._rls_add_child_policies(p_child text, p_parent text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_child
      and policyname = p_child || '_owner_select'
  ) then
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.%I p where p.id = %I.session_id and p.student_id = auth.uid()))',
      p_child || '_owner_select', p_child, p_parent, p_child
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_child
      and policyname = p_child || '_owner_insert'
  ) then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.%I p where p.id = session_id and p.student_id = auth.uid()))',
      p_child || '_owner_insert', p_child, p_parent
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_child
      and policyname = p_child || '_owner_update'
  ) then
    execute format(
      'create policy %I on public.%I for update to authenticated using (exists (select 1 from public.%I p where p.id = %I.session_id and p.student_id = auth.uid())) with check (exists (select 1 from public.%I p where p.id = session_id and p.student_id = auth.uid()))',
      p_child || '_owner_update', p_child, p_parent, p_child, p_parent
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_child
      and policyname = p_child || '_owner_delete'
  ) then
    execute format(
      'create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.%I p where p.id = %I.session_id and p.student_id = auth.uid()))',
      p_child || '_owner_delete', p_child, p_parent, p_child
    );
  end if;
exception when undefined_table or undefined_column then
  raise notice 'Child policy setup skipped for %  (parent %): not present in this environment', p_child, p_parent;
end;
$$;

-- Helper: reference table read policy (read for any authenticated user;
-- writes only via service_role / RPC).
create or replace function public._rls_add_reference_read_policy(p_table text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_authenticated_read'
  ) then
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      p_table || '_authenticated_read', p_table
    );
  end if;
exception when undefined_table then
  raise notice 'Reference table public.% does not exist; skipping', p_table;
end;
$$;

-- ── Drop the v1 broken helpers (no-op if they don't exist) ───────────────────
drop function if exists public._enable_rls_if_table_exists(text);
drop function if exists public._add_owner_policies(text);
drop function if exists public._add_reference_read_policy(text);

-- ── Direct-owner tables ─────────────────────────────────────────────────────
select public._rls_enable_if_table_exists('profiles');
select public._rls_add_owner_policies_col('profiles', 'user_id');

select public._rls_enable_if_table_exists('user_roles');
select public._rls_add_owner_policies_col('user_roles', 'user_id');

select public._rls_enable_if_table_exists('applications');
select public._rls_add_owner_policies_col('applications', 'student_id');

select public._rls_enable_if_table_exists('documents');
select public._rls_add_owner_policies_col('documents', 'student_id');

select public._rls_enable_if_table_exists('interview_sessions');
select public._rls_add_owner_policies_col('interview_sessions', 'student_id');

select public._rls_enable_if_table_exists('study_plan_sessions');
select public._rls_add_owner_policies_col('study_plan_sessions', 'student_id');

select public._rls_enable_if_table_exists('study_plan_drafts');
select public._rls_add_owner_policies_col('study_plan_drafts', 'student_id');

select public._rls_enable_if_table_exists('student_suggestions');
select public._rls_add_owner_policies_col('student_suggestions', 'student_id');

-- ── Child tables (ownership via session_id) ─────────────────────────────────
select public._rls_enable_if_table_exists('interview_feedback');
select public._rls_add_child_policies('interview_feedback', 'interview_sessions');

select public._rls_enable_if_table_exists('interview_messages');
select public._rls_add_child_policies('interview_messages', 'interview_sessions');

select public._rls_enable_if_table_exists('study_plan_analyses');
select public._rls_add_child_policies('study_plan_analyses', 'study_plan_sessions');

select public._rls_enable_if_table_exists('study_plan_chat_history');
select public._rls_add_child_policies('study_plan_chat_history', 'study_plan_sessions');

-- ── Reference tables (read-only for any authenticated user) ─────────────────
select public._rls_enable_if_table_exists('app_versions');
select public._rls_add_reference_read_policy('app_versions');

select public._rls_enable_if_table_exists('room_channels');
select public._rls_add_reference_read_policy('room_channels');

select public._rls_enable_if_table_exists('university_events');
select public._rls_add_reference_read_policy('university_events');

select public._rls_enable_if_table_exists('university_rooms');
select public._rls_add_reference_read_policy('university_rooms');

-- ── Cleanup the v1 broken migration's helpers if they were left behind ──────
-- (already done in the drop function calls above)
