-- Used by the student-login-v2 Edge Function to do an O(1) lookup of an
-- auth.users row by email. Replaces v1's paginated listUsers loop which
-- scaled O(N) per cold-path login and could timeout on growing projects.
--
-- SECURITY DEFINER + restricted EXECUTE makes this safe — only the
-- service_role (used by Edge Functions) can call it.

create or replace function public.admin_get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where email = p_email limit 1;
$$;

revoke all on function public.admin_get_auth_user_id_by_email(text) from public;
revoke all on function public.admin_get_auth_user_id_by_email(text) from anon;
revoke all on function public.admin_get_auth_user_id_by_email(text) from authenticated;
grant execute on function public.admin_get_auth_user_id_by_email(text) to service_role;

comment on function public.admin_get_auth_user_id_by_email(text) is
  'O(1) email -> auth user id lookup for the student-login-v2 Edge Function. '
  'service_role only. Replaces v1 paginated listUsers loop.';
