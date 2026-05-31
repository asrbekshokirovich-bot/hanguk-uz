-- ============================================================================
--  uni_db v3 — post-drop security cleanup
--
--  After 20260510130000 created the five forensic backup tables, the
--  Supabase advisor flagged them with rls_disabled_in_public ERRORs
--  (every public-facing table needs RLS). We enable RLS with no policies
--  on each (deny-all by default; service role still bypasses RLS for
--  ops inspection).
--
--  Also revokes EXECUTE on the new fn_review_* RPCs from the `anon` role.
--  Supabase's default privileges grant EXECUTE to anon on all functions in
--  public; without an explicit revoke, the advisor's
--  anon_security_definer_function_executable lint fires. The functions
--  still gate access on profiles.role internally, so anon callers were
--  always rejected — but the advisor doesn't see the runtime check.
-- ============================================================================

set local search_path = public, pg_catalog;

-- 1. Enable RLS (deny-all) on the forensic backup tables
alter table if exists public.universities_backup_20260510                       enable row level security;
alter table if exists public.applications_with_uni_backup_20260510              enable row level security;
alter table if exists public.student_university_priorities_backup_20260510      enable row level security;
alter table if exists public.gks_designated_universities_backup_20260510        enable row level security;
alter table if exists public.university_programs_backup_20260510                enable row level security;

-- Comments to make their forensic-only nature obvious in Studio
do $$
declare r record;
begin
  for r in
    select relname from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in (
        'universities_backup_20260510',
        'applications_with_uni_backup_20260510',
        'student_university_priorities_backup_20260510',
        'gks_designated_universities_backup_20260510',
        'university_programs_backup_20260510'
      )
  loop
    execute format(
      'comment on table public.%I is ''Forensic snapshot taken 2026-05-10. Service-role only. Drop after Phase 3R-C completes.''',
      r.relname);
  end loop;
end $$;

-- 2. Revoke anon EXECUTE on the fn_review_* RPCs added by
--    20260701001000_uni_db_v3_review_action_rpcs.sql
revoke execute on function public.fn_review_accept(uuid, uuid)                   from anon;
revoke execute on function public.fn_review_edit_accept(uuid, jsonb, uuid, text) from anon;
revoke execute on function public.fn_review_reject(uuid, text, text, uuid)       from anon;
