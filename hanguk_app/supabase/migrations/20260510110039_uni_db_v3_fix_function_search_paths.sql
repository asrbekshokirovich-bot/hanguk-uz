-- ============================================================================
--  uni_db v3 fix — pin search_path on every uni_db helper function
--
--  A mutable search_path is a privilege-escalation vector: a user who
--  can create their own schema can shadow built-in functions
--  (e.g. by creating their own `sum()` or `coalesce()` in a schema
--  earlier in the path). Setting search_path explicitly on each
--  SECURITY DEFINER / RLS-helper function closes that hole.
--
--  Setting `public, pg_catalog` keeps unqualified table references
--  (`from institutions`) working while ensuring built-ins always
--  resolve to pg_catalog.
--
--  Supabase advisor 0011_function_search_path_mutable.
--
--  Applied to staging + prod via Supabase MCP on 2026-05-10
--  (versions 20260510110039 in supabase_migrations.schema_migrations
--  on both projects).
-- ============================================================================

alter function public.fn_pick_next_reviewer(boolean)
  set search_path = public, pg_catalog;
alter function public.fn_claim_review_queue(uuid, smallint[])
  set search_path = public, pg_catalog;
alter function public.fn_legacy_universities_present()
  set search_path = public, pg_catalog;
alter function public.fn_copy_legacy_universities_to_institutions()
  set search_path = public, pg_catalog;
alter function public.trg_fn_proposed_source_promote()
  set search_path = public, pg_catalog;
alter function public.trg_fn_review_queue_audit()
  set search_path = public, pg_catalog;
alter function public.fn_emit_change_event()
  set search_path = public, pg_catalog;
alter function public.fn_is_app_user()
  set search_path = public, pg_catalog;
