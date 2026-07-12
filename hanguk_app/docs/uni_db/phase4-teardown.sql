-- ============================================================================
-- Phase 4 teardown — LEGACY PROD DB + EDGE-FUNCTION CLEANUP
-- ============================================================================
-- ⚠️  OWNER-RUN, NOT AUTO-APPLIED. This file lives in docs/ (NOT in
--     supabase/migrations/) on purpose, so no migration runner sweeps it up.
--     It DROPS production tables/functions. Read it, take a backup, then apply
--     it deliberately (Supabase MCP apply_migration, the SQL editor, or psql).
--
-- Provenance: cleanup-plan.md Phase 4 + owner decision B (ai-crawl abandoned).
-- Verified read-only against prod `Hanguk 2026` (lysjdtyanhdfphqyijsr) on
-- 2026-07-12: row counts, FK graph, cron job, RPC, and that NO view/RPC
-- references any drop target. Row counts at verification time are noted inline.
--
-- The `begin; ... commit;` wraps every DROP with an archive-first snapshot into
-- the `_archive` schema, so the drop is reversible (restore with
-- `insert into public.<t> select * from _archive.<t>_<date>` after recreating
-- the table, or just `create table public.<t> as table _archive....`).
-- If you would rather NOT keep archives, delete the section 0 block.
-- ============================================================================

begin;

-- 0. ARCHIVE the non-empty targets first (reversible safety net) ---------------
create schema if not exists _archive;
create table if not exists _archive.admission_sync_jobs_20260712            as table public.admission_sync_jobs;             -- 47 rows
create table if not exists _archive.crawl_page_cache_20260712              as table public.crawl_page_cache;                -- 8 rows
create table if not exists _archive.tasks_backup_20260612_arch20260712     as table public.tasks_backup_20260612;           -- 58 rows
create table if not exists _archive.task_comments_backup_20260612_arch20260712 as table public.task_comments_backup_20260612; -- 5 rows
create table if not exists _archive.mig_contract_to_receipt_20260712       as table public.mig_contract_to_receipt;         -- 49 rows
create table if not exists _archive.ai_crawl_config_20260712               as table public.ai_crawl_config;                 -- 1 row (singleton, enabled=false)
-- (application_form_cache / _changes / _validations are all 0 rows — not archived.)

-- 1. AI edge-crawl cluster — decision B: abandoned, tear it down ---------------
--    cron job #5 `ai-crawl-dispatcher` (0 */4 * * *, active) -> fn_invoke_crawl_dispatcher()
--    -> the crawl-dispatcher/crawl-worker edge fns. Inert only via ai_crawl_config.enabled=false.
select cron.unschedule('ai-crawl-dispatcher');
drop function if exists public.fn_invoke_crawl_dispatcher();
drop table    if exists public.ai_crawl_config;

-- 2. Dead legacy application-form tables (all 0 rows). cache is the FK parent of
--    _changes and _validations, so CASCADE removes all three together.
drop table if exists public.application_form_cache cascade;

-- 3. Superseded / orphaned tables ---------------------------------------------
drop table if exists public.admission_sync_jobs;   -- superseded by extraction_jobs; 47 stale rows
drop table if exists public.crawl_page_cache;      -- ETag cache for the removed crawl-worker; 8 rows

-- 4. Ad-hoc backup + one-time migration-mapping tables (RLS was disabled) ------
drop table if exists public.tasks_backup_20260612;
drop table if exists public.task_comments_backup_20260612;
drop table if exists public.mig_contract_to_receipt;

commit;

-- ============================================================================
-- NOT dropped here — deliberately deferred
-- ============================================================================
-- crawl_findings (100 rows) / crawl_runs / announcement_sources / announcements:
--   still read by the KEPT `uni-db run-pipeline` + fetch_worker.fetch_candidates
--   path. Retire these only after run-pipeline itself is removed, as a separate
--   coordinated change — do NOT drop them here.
--
-- ============================================================================
-- OWNER-RUN, CLI-ONLY (no SQL / no MCP tool for this) — undeploy prod edge fns
-- ============================================================================
-- Abandoned / superseded prod-only functions (verified absent from the repo):
--   supabase functions delete crawl-dispatcher
--   supabase functions delete crawl-worker
--   supabase functions delete process-guideline
--   supabase functions delete import-korean-universities
--   supabase functions delete voice-bakeoff-tmp        # drop voice_bakeoff_results too if the TTS bake-off is done (owner_decision E)
--   supabase functions delete diagtranslate
-- Legacy application-form functions removed from the repo in Phase 2 (undeploy to match):
--   supabase functions delete sync-admission-forms find-application-form \
--     analyze-application-form discover-university-websites find-faculty-forms \
--     search-university check-search-job validate-application-data \
--     import-academyinfo seed-gks-data
-- DO NOT delete `compare-universities` yet — decision C is to REBUILD it on
--   `institutions`; coordinate the fn change with the student compare UI.
-- Leave `orbit-*` alone — foreign product sharing this DB (owner_decision D).
-- ============================================================================
