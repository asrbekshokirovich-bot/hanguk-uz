-- ============================================================================
--  uni_db v1 + v2 staging smoke test
--
--  Run via:
--    supabase db query --linked --file scripts/smoke_test_uni_db.sql
--
--  Each SELECT carries its own descriptive alias so the JSON / table
--  output reads like a checklist. Expected values are inline.
--
--  Phase 2 additions (lines 56+):
--    * pdf_access_log table (ADR-009)
--    * proposed_sources table (Phase 2-D3)
--    * fn_is_app_user() helper (ADR-007)
--    * announcement_sources count bumps from 19 → 34
--    * profiles role-check accepts 'contracted_student'
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Phase 0/1 baseline checks (unchanged)
-- ----------------------------------------------------------------------------

-- 1. uni_db v1 tables present (expected: 24)
select 'uni_db_tables_found' as check_name, count(*) as observed, 24 as expected
  from information_schema.tables
 where table_schema='public'
   and table_name in (
     'institutions','recruitment_units','programs','recruitment_unit_programs',
     'admission_cycles','cycle_dates','requirements','tuition',
     'scholarships','documents_required','guideline_documents',
     'announcement_sources','announcements','crawl_runs','crawl_findings',
     'change_events','extraction_jobs','review_queue','review_decisions',
     'user_tracked_universities','user_alerts','translations',
     'term_glossary','embedding_chunks');

-- 2. uni_db v1 views present (expected: 9)
select 'uni_db_views_found' as check_name, count(*) as observed, 9 as expected
  from information_schema.views
 where table_schema='public' and table_name like 'v_%';

-- 3. RLS enabled on user-scoped tables (expected: every row rowsecurity=true)
select 'rls_'||tablename as check_name, rowsecurity::text as observed, 'true' as expected
  from pg_tables
 where schemaname='public'
   and tablename in (
     'user_tracked_universities','user_alerts',
     'review_decisions','institutions');

-- 4. Top-15 institution glossary seeded (expected: 30)
select 'glossary_institution_rows' as check_name, count(*) as observed, 30 as expected
  from public.term_glossary
 where category='institution_name' and authoritative=true;

-- 6. plpgsql round-robin function returns null when no reviewers (expected: null)
select 'fn_pick_next_reviewer' as check_name,
       coalesce(public.fn_pick_next_reviewer()::text, '<null>') as observed,
       '<null>' as expected;

-- 7. Recent-changes view safe for anon (expected: 0)
select 'recent_changes_for_anon' as check_name, count(*) as observed, 0 as expected
  from public.v_user_recent_changes;

-- ----------------------------------------------------------------------------
--  Phase 2 additions
-- ----------------------------------------------------------------------------

-- 8. announcement_sources expanded from 19 → 34 (Phase 2-D4)
select 'announcement_sources_rows_post_phase2' as check_name,
       count(*) as observed, 34 as expected
  from public.announcement_sources;

-- 9. pdf_access_log table exists with RLS (ADR-009)
select 'pdf_access_log_rls' as check_name,
       coalesce(rowsecurity::text, '<missing>') as observed,
       'true' as expected
  from pg_tables
 where schemaname='public' and tablename='pdf_access_log';

-- 10. proposed_sources table exists with RLS (Phase 2-D3)
select 'proposed_sources_rls' as check_name,
       coalesce(rowsecurity::text, '<missing>') as observed,
       'true' as expected
  from pg_tables
 where schemaname='public' and tablename='proposed_sources';

-- 11. v_proposed_sources_queue view exists (Phase 2-D3)
select 'v_proposed_sources_queue_exists' as check_name,
       count(*)::text as observed,
       '1' as expected
  from information_schema.views
 where table_schema='public' and table_name='v_proposed_sources_queue';

-- 12. fn_is_app_user() helper exists (ADR-007)
select 'fn_is_app_user_exists' as check_name,
       count(*)::text as observed,
       '1' as expected
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='fn_is_app_user';

-- 13. profiles role-check now accepts 'contracted_student'
-- Roundabout but reliable: parse the constraint definition.
select 'profiles_role_check_includes_contracted_student' as check_name,
       case when pg_get_constraintdef(oid) like '%contracted_student%'
            then 'true' else 'false' end as observed,
       'true' as expected
  from pg_constraint
 where conname='profiles_role_check' and conrelid='public.profiles'::regclass;

-- 14. RLS policies on recruitment-data tables now reference fn_is_app_user
-- (Phase 2-C tightening). Pick `institutions` as the witness.
select 'institutions_uses_fn_is_app_user' as check_name,
       case when exists (
         select 1 from pg_policies
          where schemaname='public' and tablename='institutions'
            and qual like '%fn_is_app_user%'
       ) then 'true' else 'false' end as observed,
       'true' as expected;

-- 15. guideline-blobs bucket created and PRIVATE (ADR-009)
select 'guideline_blobs_bucket_private' as check_name,
       coalesce((not public)::text, '<missing>') as observed,
       'true' as expected
  from storage.buckets
 where id='guideline-blobs';

-- 16. proposed_sources promotion trigger registered (Phase 2-D3)
select 'trg_proposed_source_promote_exists' as check_name,
       count(*)::text as observed,
       '1' as expected
  from pg_trigger
 where tgname='trg_proposed_source_promote'
   and tgrelid='public.proposed_sources'::regclass;
