-- ─────────────────────────────────────────────────────────────────────────────
-- 20260512122000 — RLS audit closure
--
-- The store-readiness audit (docs/audits/store_readiness_audit_2026-05-12.md
-- §6 S1) found that only `app_version_pings` has an `ENABLE ROW LEVEL
-- SECURITY` statement in this repo's migrations folder. The other 18+
-- tables exist on the server (per Flutter `from('xxx')` usage) but their
-- RLS state cannot be confirmed from this repo alone — most policies
-- were created hand or via the Supabase Studio UI.
--
-- This migration is a SAFETY net: for every table we know Flutter
-- touches that has a `user_id` (or equivalent) ownership column, we
--   (a) enable RLS unconditionally (idempotent),
--   (b) add owner-only SELECT/INSERT/UPDATE/DELETE policies if missing,
--   (c) for reference data (universities, university_rooms, etc.) add a
--       read-for-authenticated, write-for-service-role policy.
--
-- Policies are created with `if not exists` guards so this migration is
-- safe to re-apply, and won't clobber existing policies that may have
-- different (better) shapes.
--
-- For each `do $$ begin ... end$$` block: we wrap in
-- `exception when undefined_table` so the migration completes even if a
-- table doesn't exist on this environment.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: enable RLS on a table iff it exists.
create or replace function public._enable_rls_if_table_exists(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', p_table);
exception when undefined_table then
  raise notice 'Table public.% does not exist, skipping', p_table;
end;
$$;

-- Helper: create an owner-only SELECT/INSERT/UPDATE/DELETE policy set on
-- a table that has `user_id uuid` ownership. No-op if any policy with
-- the target name already exists.
create or replace function public._add_owner_policies(p_table text)
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
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      p_table || '_owner_select', p_table
    );
  end if;

  -- INSERT
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_insert'
  ) then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      p_table || '_owner_insert', p_table
    );
  end if;

  -- UPDATE
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_update'
  ) then
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      p_table || '_owner_update', p_table
    );
  end if;

  -- DELETE
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table
      and policyname = p_table || '_owner_delete'
  ) then
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      p_table || '_owner_delete', p_table
    );
  end if;
exception when undefined_table then
  raise notice 'Table public.% does not exist; skipping policy creation', p_table;
end;
$$;

-- Helper: read-for-authenticated, no-write reference table.
create or replace function public._add_reference_read_policy(p_table text)
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
  raise notice 'Table public.% does not exist; skipping reference policy', p_table;
end;
$$;

-- ── Owner-scoped tables (have user_id ownership) ───────────────────────────
select public._enable_rls_if_table_exists('applications');
select public._add_owner_policies('applications');

select public._enable_rls_if_table_exists('documents');
select public._add_owner_policies('documents');

select public._enable_rls_if_table_exists('student_suggestions');
select public._add_owner_policies('student_suggestions');

select public._enable_rls_if_table_exists('study_plan_sessions');
select public._add_owner_policies('study_plan_sessions');

select public._enable_rls_if_table_exists('study_plan_drafts');
select public._add_owner_policies('study_plan_drafts');

select public._enable_rls_if_table_exists('study_plan_analyses');
select public._add_owner_policies('study_plan_analyses');

select public._enable_rls_if_table_exists('study_plan_chat_history');
select public._add_owner_policies('study_plan_chat_history');

select public._enable_rls_if_table_exists('interview_sessions');
select public._add_owner_policies('interview_sessions');

select public._enable_rls_if_table_exists('interview_messages');
select public._add_owner_policies('interview_messages');

select public._enable_rls_if_table_exists('interview_feedback');
select public._add_owner_policies('interview_feedback');

select public._enable_rls_if_table_exists('user_roles');
select public._add_owner_policies('user_roles');

-- ── profiles is special: ownership column may be `user_id` OR `id`. ────────
do $$
begin
  perform public._enable_rls_if_table_exists('profiles');
  -- Try user_id-based policies; ignore failures (column may not exist).
  begin
    perform public._add_owner_policies('profiles');
  exception when undefined_column then
    raise notice 'public.profiles has no user_id column; trying id';
  end;
  -- Fallback: id-based owner read.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_self_select'
  ) then
    begin
      execute 'create policy profiles_self_select on public.profiles for select to authenticated using (auth.uid() = id)';
    exception when others then null;
    end;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_self_update'
  ) then
    begin
      execute 'create policy profiles_self_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)';
    exception when others then null;
    end;
  end if;
end$$;

-- ── Reference data (read-only for authenticated, write via service_role) ───
select public._enable_rls_if_table_exists('universities');
select public._add_reference_read_policy('universities');

select public._enable_rls_if_table_exists('university_rooms');
select public._add_reference_read_policy('university_rooms');

select public._enable_rls_if_table_exists('room_channels');
select public._add_reference_read_policy('room_channels');

select public._enable_rls_if_table_exists('university_events');
select public._add_reference_read_policy('university_events');

select public._enable_rls_if_table_exists('app_versions');
select public._add_reference_read_policy('app_versions');

-- ── channel_messages: senders read room messages they're a member of. ──────
-- This is too complex for a blanket policy; we just enable RLS and trust the
-- pre-existing policies that the chat feature shipped against. If none
-- exist, the table will fail closed (Flutter requests will return empty
-- lists) which is the safer failure mode.
select public._enable_rls_if_table_exists('channel_messages');

-- ── system_settings: rarely read, never written by clients. Service-role
-- only. We do NOT add an authenticated read policy — sensitive flags. ──────
select public._enable_rls_if_table_exists('system_settings');

-- ── app_version_pings already has RLS from 20260506120100. ─────────────────

-- Clean up helpers — they were only needed for this migration's lifetime.
drop function if exists public._enable_rls_if_table_exists(text);
drop function if exists public._add_owner_policies(text);
drop function if exists public._add_reference_read_policy(text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Post-migration check (run manually, not as part of the migration):
--
--   select schemaname, tablename, rowsecurity
--     from pg_tables
--    where schemaname = 'public'
--    order by tablename;
--
-- Every row should show `rowsecurity = true`. Tables that this migration
-- couldn't touch (e.g. tables that exist on the server but aren't in the
-- migrations folder) need to be enabled by hand.
-- ─────────────────────────────────────────────────────────────────────────────
