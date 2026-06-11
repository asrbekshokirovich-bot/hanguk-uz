-- Postgres grants EXECUTE to PUBLIC by default, so revoking from anon/authenticated
-- alone leaves the hole open. Revoke from PUBLIC and re-grant to the intended roles.
-- Closes the "SECURITY DEFINER function executable by anon" advisor findings.

-- Pure trigger functions: not callable via API by anyone (triggers fire as owner).
REVOKE EXECUTE ON FUNCTION public.finance_audit_log_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_application_room() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_university_staff_assignment() FROM PUBLIC, anon, authenticated;

-- Self-service account deletion: signed-in users only.
REVOKE EXECUTE ON FUNCTION public.fn_delete_my_account() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_delete_my_account() TO authenticated;

-- Aggregate stats: signed-in users only (no anon).
REVOKE EXECUTE ON FUNCTION public.get_regional_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_regional_stats() TO authenticated;

-- Communication helpers: invoked only by edge functions running as service_role.
REVOKE EXECUTE ON FUNCTION public.increment_thread_unread(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_thread_unread(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_message_thread(text, text, text, text, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.upsert_message_thread(text, text, text, text, uuid, timestamptz, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_communication_identity(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_communication_identity(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.search_communications_text(text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.search_communications_text(text, integer, uuid) TO service_role;
