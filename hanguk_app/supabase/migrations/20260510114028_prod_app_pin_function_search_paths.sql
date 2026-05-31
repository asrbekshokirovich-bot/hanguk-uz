-- ============================================================================
--  Prod-app SECURITY DEFINER functions — pin search_path = pg_catalog, public
--
--  These functions belong to the existing Hanguk app (handle_new_user,
--  has_role, etc.) — not uni_db — but the Supabase advisor flagged
--  them under 0011_function_search_path_mutable. Pinning closes the
--  schema-shadow attack surface where a user with CREATE on a schema
--  earlier in the path could shadow a built-in.
--
--  pg_catalog comes first so built-ins always resolve to pg_catalog
--  even if a public-schema lookalike exists.
--
--  Applied via Supabase MCP on 2026-05-10 to prod
--  (lysjdtyanhdfphqyijsr) only — staging doesn't carry these
--  prod-app functions.
-- ============================================================================

alter function public.get_regional_stats()
  set search_path = pg_catalog, public;
alter function public.handle_new_application_room()
  set search_path = pg_catalog, public;
alter function public.handle_new_user()
  set search_path = pg_catalog, public;
alter function public.handle_university_staff_assignment()
  set search_path = pg_catalog, public;
alter function public.has_role(_user_id uuid, _role public.app_role)
  set search_path = pg_catalog, public;
alter function public.increment_thread_unread(p_source text, p_sender_id text, p_sender_name text)
  set search_path = pg_catalog, public;
alter function public.is_room_member(_room_id uuid, _user_id uuid)
  set search_path = pg_catalog, public;
