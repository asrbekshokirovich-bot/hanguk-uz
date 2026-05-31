-- ============================================================================
--  uni_db v3 fix — set security_invoker = on for all 10 uni_db views
--
--  Without this option, views run as the view owner (postgres) and
--  bypass the underlying tables' RLS — a user could read rows they
--  shouldn't. Supabase advisor 0010_security_definer_view flags this
--  as ERROR.
--
--  Each underlying table already has the RLS policy we want
--  (fn_is_app_user() for recruitment data per ADR-007, auth.uid() for
--  user-scoped tables, role-based for review_queue / reviewer
--  surfaces). Switching to security_invoker makes the views honour
--  those policies on a per-caller basis.
--
--  Applied to staging + prod via Supabase MCP on 2026-05-10
--  (versions 20260510110031 in supabase_migrations.schema_migrations
--  on both projects).
-- ============================================================================

alter view public.v_institutions_for_map           set (security_invoker = on);
alter view public.v_user_upcoming_deadlines        set (security_invoker = on);
alter view public.v_user_recent_changes            set (security_invoker = on);
alter view public.v_recruitment_for_interview      set (security_invoker = on);
alter view public.v_review_queue_dashboard         set (security_invoker = on);
alter view public.v_review_queue_overdue           set (security_invoker = on);
alter view public.v_review_queue_by_archetype      set (security_invoker = on);
alter view public.v_review_queue_by_field_group    set (security_invoker = on);
alter view public.v_extraction_accuracy_by_archetype set (security_invoker = on);
alter view public.v_proposed_sources_queue         set (security_invoker = on);
