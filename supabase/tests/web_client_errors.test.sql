-- Local test for 20261112160000_web_client_errors.sql.
--
--   createdb web_errors_test && psql -v ON_ERROR_STOP=1 -d web_errors_test \
--     -f supabase/tests/web_client_errors.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase gives every new function in public to the three API roles.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create type public.app_role as enum ('owner', 'admin', 'call_operator', 'student');
create table public.user_roles (user_id uuid, role public.app_role);
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

\i supabase/migrations/20261112160000_web_client_errors.sql
-- Applying it twice is harmless.
\i supabase/migrations/20261112160000_web_client_errors.sql

insert into public.user_roles values
  ('00000000-0000-4000-8000-00000000000a', 'owner'),
  ('00000000-0000-4000-8000-00000000000b', 'call_operator');

-- An operator's page crashes: one row; the same crash again within the hour: one more hit.
set role authenticated;
select set_config('test.uid', '00000000-0000-4000-8000-00000000000b', false);
do $$
declare ok boolean;
begin
  select public.web_error_log('crash', '  Cannot read properties of undefined (reading ''map'')  ', 'at LeadsTable (index.js:1:2)',
                              '/crm/leads?intake=spring-2027#top', '9887a267', 'Mozilla/5.0') into ok;
  assert ok, 'a crash is recorded';
  select public.web_error_log('CRASH', 'Cannot read properties of undefined (reading ''map'')', null, '/crm/leads?intake=fall-2027', null, null) into ok;
  assert ok, 'the same crash on the same page counts as a hit';
  select public.web_error_log('rejection', 'Request timed out', null, '/crm/leads', null, null) into ok;
  assert ok, 'another error is another row';

  -- What cannot be a report is refused, not stored.
  assert not public.web_error_log('warning', 'x'), 'unknown kind';
  assert not public.web_error_log('error', '   '), 'empty message';
  assert not public.web_error_log(null, null), 'nulls';
end $$;

-- The operator cannot read the log or write to it directly.
do $$
declare n int;
begin
  select count(*) into n from public.web_client_errors;
  assert n = 0, format('an operator sees no rows, got %s', n);
  begin
    insert into public.web_client_errors (user_id, kind, message, fingerprint) values (auth.uid(), 'crash', 'x', 'x');
    assert false, 'direct insert must be refused';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
declare r record;
begin
  assert (select count(*) from public.web_client_errors) = 2, 'two rows in all';
  select * into r from public.web_client_errors where kind = 'crash';
  assert r.hits = 2, format('two hits, got %s', r.hits);
  assert r.path = '/crm/leads', format('the path without query or hash, got %s', r.path);
  assert r.message = 'Cannot read properties of undefined (reading ''map'')', 'the message trimmed';
  assert r.build = '9887a267' and r.user_agent = 'Mozilla/5.0' and r.stack like 'at LeadsTable%', 'details kept from the first report';
  assert r.user_id = '00000000-0000-4000-8000-00000000000b', 'whose browser it was';
end $$;

-- Nobody signed in: nothing is written. A visitor (anon) cannot call it at all.
set role authenticated;
select set_config('test.uid', '', false);
do $$ begin assert not public.web_error_log('crash', 'no user'), 'no uid, no row'; end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.web_error_log('crash', 'visitor');
    assert false, 'anon must not be able to call it';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin assert (select count(*) from public.web_client_errors) = 2, 'still two rows'; end $$;

-- The owner reads everything.
set role authenticated;
select set_config('test.uid', '00000000-0000-4000-8000-00000000000a', false);
do $$ begin assert (select count(*) from public.web_client_errors) = 2, 'the owner sees both rows'; end $$;

-- Long texts are cut; a broken page cannot flood the table: 40 different errors an hour per person.
do $$
declare ok boolean; i int; n int;
begin
  select public.web_error_log('error', repeat('m', 900), repeat('s', 9000), repeat('/p', 400), repeat('b', 90), repeat('u', 900)) into ok;
  assert ok, 'long report accepted';
  for i in 2 .. 40 loop
    assert public.web_error_log('error', 'distinct error ' || i), format('error %s accepted', i);
  end loop;
  assert not public.web_error_log('error', 'one too many'), 'the 41st distinct error this hour is dropped';
  assert public.web_error_log('error', 'distinct error 7'), 'a repeat of a known one still counts';
end $$;
reset role;
do $$
declare r record;
begin
  select * into r from public.web_client_errors where message like 'mmm%';
  assert length(r.message) = 500 and length(r.stack) = 4000 and length(r.path) = 300 and length(r.build) = 40 and length(r.user_agent) = 300,
    format('cut to size: %s %s %s %s %s', length(r.message), length(r.stack), length(r.path), length(r.build), length(r.user_agent));
  assert (select count(*) from public.web_client_errors where user_id = '00000000-0000-4000-8000-00000000000a') = 40, 'forty rows for the owner';
  assert (select hits from public.web_client_errors where message = 'distinct error 7') = 2, 'the repeat was counted';
end $$;

-- The next hour starts a new row for the same crash.
update public.web_client_errors set hour_bucket = hour_bucket - interval '1 hour', created_at = created_at - interval '1 hour', last_seen_at = last_seen_at - interval '1 hour';
set role authenticated;
select set_config('test.uid', '00000000-0000-4000-8000-00000000000b', false);
do $$ begin
  assert public.web_error_log('crash', 'Cannot read properties of undefined (reading ''map'')', null, '/crm/leads', null, null), 'recorded again next hour';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.web_client_errors where kind = 'crash') = 2, 'one row per hour';
end $$;

\echo web_client_errors: OK
