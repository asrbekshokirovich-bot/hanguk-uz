-- ============================================================================
--  Pre-uni_db bridge: ensure public.profiles has a 'role' column
--
--  uni_db Phase 0/1/2 migrations assume `profiles.role` exists with values
--  like 'student', 'admin', 'uni_db_reviewer', 'contracted_student'. The
--  prod baseline schema however uses a separate `public.user_roles` table
--  for role-based access (see public.has_role(uuid, app_role) in the
--  baseline). Both can coexist, but uni_db's RLS policies need a column
--  to inspect via auth.uid().
--
--  This migration adds `role text` to profiles if missing, with a sane
--  default. Existing prod rows get 'student'; counsellor/admin role
--  assignment flows through user_roles unchanged.
--
--  Idempotent — safe to re-run.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public'
       and table_name = 'profiles'
       and table_type = 'BASE TABLE'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'role'
  ) then
    alter table public.profiles
      add column role text default 'student';
    raise notice 'added public.profiles.role with default ''student''';
  else
    raise notice 'pre_uni_db_profiles_role: nothing to do (column or table missing)';
  end if;
end
$$;

-- Index helps the per-row RLS subquery
-- (select role from profiles where user_id = auth.uid()) which fires on
-- every read of a recruitment-data row under the v2 internal-only RLS.
create index if not exists profiles_user_id_role_idx
  on public.profiles (user_id, role);
