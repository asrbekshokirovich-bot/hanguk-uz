-- ============================================================================
--  uni_db v3 fix — revoke EXECUTE on internal helper functions
--
--  Two uni_db helpers were callable by anon / authenticated as
--  PostgREST RPCs (/rest/v1/rpc/<name>):
--
--  * fn_emit_change_event — trigger function. There is no legitimate
--    reason for any caller to invoke it directly via RPC; that path
--    would side-effect into change_event_outbox with a spoofed payload.
--    Locked down to service_role only.
--
--  * fn_is_app_user — RLS predicate helper. We keep authenticated's
--    EXECUTE because RLS policies that reference it must resolve
--    under the calling user's privileges; revoking it from anon
--    closes the unauthenticated-probe surface.
--
--  Supabase advisors 0028_anon_security_definer_function_executable
--  and 0029_authenticated_security_definer_function_executable.
--
--  Other SECURITY DEFINER functions on the prod baseline
--  (handle_new_user, has_role, increment_thread_unread, is_room_member,
--  handle_new_application_room, handle_university_staff_assignment,
--  get_regional_stats) belong to the existing app and are not touched
--  here — that's a prod-team call.
--
--  Applied to staging + prod via Supabase MCP on 2026-05-10
--  (versions 20260510110046 in supabase_migrations.schema_migrations
--  on both projects).
-- ============================================================================

revoke execute on function public.fn_emit_change_event() from anon, authenticated, public;
revoke execute on function public.fn_is_app_user()       from anon, authenticated, public;

grant execute on function public.fn_emit_change_event() to service_role;
grant execute on function public.fn_is_app_user()       to service_role, authenticated;
