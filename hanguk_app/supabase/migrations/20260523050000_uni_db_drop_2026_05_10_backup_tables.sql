-- Drop the 5 forensic backup tables created during the 2026-05-10
-- institutions cutover (Phase 3R). Each carries a comment explicitly
-- saying "Drop after Phase 3R-C completes" — that phase is complete
-- (the cutover landed via PR #1: feat: uni_db cutover to institutions).
--
-- Pre-drop verification (2026-05-23 via Supabase MCP):
--   - 0 views reference any of the 5 tables
--   - 0 pg_depend entries (no FKs, triggers, or other dependencies)
--   - All 5 trip the "rls_enabled_no_policy" advisor at INFO level
--     (RLS is on but no policies — table is unreachable except by
--     service-role, which is the intended forensic-only access pattern)
--   - Total size ~370 KB across all 5 tables
--
-- Row counts at drop time:
--   universities_backup_20260510                  697
--   applications_with_uni_backup_20260510           7
--   student_university_priorities_backup_20260510  33
--   gks_designated_universities_backup_20260510   200
--   university_programs_backup_20260510           104
--
-- If something turns out to need recovery, the underlying institutions
-- table + the original pre-cutover schema files in supabase/migrations/
-- are the source of truth. The 697 historical universities rows
-- include legacy display-only data that was intentionally not migrated
-- into the new institutions structure (Plan §A.5 — only the canonical
-- top-12 + actively-recruited universities were carried forward).

drop table if exists public.universities_backup_20260510;
drop table if exists public.applications_with_uni_backup_20260510;
drop table if exists public.student_university_priorities_backup_20260510;
drop table if exists public.gks_designated_universities_backup_20260510;
drop table if exists public.university_programs_backup_20260510;
