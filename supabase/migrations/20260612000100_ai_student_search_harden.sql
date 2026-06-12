-- Harden the Hanguk AI student-search helpers.
--   • Don't expose student names/phones to the public anon key. search_students
--     is SECURITY DEFINER and was reachable via /rest/v1/rpc/search_students with
--     the publishable key. The edge function calls it with the service_role key,
--     so anon / authenticated / PUBLIC do not need EXECUTE.
--   • Pin search_path on hanguk_normalize_name to silence the linter and avoid
--     search_path hijacking.

revoke execute on function public.search_students(text, int) from anon, authenticated, public;
revoke execute on function public.hanguk_normalize_name(text) from anon, authenticated, public;
grant  execute on function public.search_students(text, int) to service_role;
grant  execute on function public.hanguk_normalize_name(text) to service_role;

create or replace function public.hanguk_normalize_name(p text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select regexp_replace(
           regexp_replace(lower(coalesce(p, '')), '[''ʼ`’]', '', 'g'),
           '\s+', ' ', 'g'
         )
$$;
