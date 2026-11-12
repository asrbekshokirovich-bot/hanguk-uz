-- Local test for 20261112090000_guest_credentials.sql.
--
--   createdb guest_test && psql -v ON_ERROR_STOP=1 -d guest_test \
--     -f supabase/tests/guest_credentials.test.sql
--
-- A stub of leads with passwords as they were typed, the migration, then:
-- nothing typed is left, the hashes check, wrong guesses lock, and nobody but
-- server code reaches any of it.
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  password text,
  updated_at timestamptz not null default now()
);
grant all on public.leads to anon, authenticated, service_role;

insert into public.leads (id, full_name, email, password) values
  ('00000000-0000-4000-8000-000000000001', 'ALI', 'ali@example.com', 'secret1'),
  ('00000000-0000-4000-8000-000000000002', 'VALI', 'vali@example.com', 'abcd'),
  ('00000000-0000-4000-8000-000000000003', 'NO PASSWORD', 'none@example.com', null),
  ('00000000-0000-4000-8000-000000000004', 'EMPTY', 'empty@example.com', '');

\i supabase/migrations/20261112090000_guest_credentials.sql

do $$
declare n int; h text; r text; i int;
begin
  -- 1. Nothing typed is left in leads; only the two real passwords became hashes.
  select count(*) into n from public.leads where password is not null;
  assert n = 0, format('%s passwords still in leads', n);
  select count(*) into n from public.lead_credentials;
  assert n = 2, format('expected 2 hashes, got %s', n);
  select password_hash into h from public.lead_credentials where lead_id = '00000000-0000-4000-8000-000000000001';
  assert h like '$2a$10$%' and h not like '%secret1%', 'not a bcrypt hash: ' || h;

  -- 2. The hashes check.
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000001', 'secret1') = 'ok', 'right password refused';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000001', 'Secret1') = 'wrong', 'wrong password accepted';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'abcd') = 'ok', 'second lead';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000003', 'x') = 'none', 'lead without a password';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000004', '') = 'none', 'empty password became an account';
  assert public.fn_guest_check_password(gen_random_uuid(), 'x') = 'none', 'unknown lead';

  -- 3. A right password clears the count of wrong ones.
  select failed_attempts into n from public.lead_credentials where lead_id = '00000000-0000-4000-8000-000000000001';
  assert n = 1, format('one wrong guess counted, got %s', n);
  perform public.fn_guest_check_password('00000000-0000-4000-8000-000000000001', 'secret1');
  select failed_attempts into n from public.lead_credentials where lead_id = '00000000-0000-4000-8000-000000000001';
  assert n = 0, 'count not cleared';

  -- 4. Five wrong guesses lock it, and then even the right password waits.
  for i in 1..4 loop
    r := public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'guess' || i);
    assert r = 'wrong', format('guess %s: %s', i, r);
  end loop;
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'abcd') = 'ok', 'four wrong guesses must not lock';
  for i in 1..5 loop
    r := public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'guess' || i);
    assert r = 'wrong', format('guess %s: %s', i, r);
  end loop;
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'abcd') = 'locked', 'not locked after five';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'another') = 'locked', 'guessing while locked';

  -- 5. When the lock has run out the right password works again, a wrong one locks at once.
  update public.lead_credentials set locked_until = now() - interval '1 second' where lead_id = '00000000-0000-4000-8000-000000000002';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'nope') = 'wrong', 'after the lock';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'abcd') = 'locked', 'one more wrong guess must lock again';
  update public.lead_credentials set locked_until = now() - interval '1 second' where lead_id = '00000000-0000-4000-8000-000000000002';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000002', 'abcd') = 'ok', 'right password after the lock';

  -- 6. A new password replaces the old one and lifts a lock.
  perform public.fn_guest_set_password('00000000-0000-4000-8000-000000000003', 'brand-new');
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000003', 'brand-new') = 'ok', 'set then check';
  perform public.fn_guest_set_password('00000000-0000-4000-8000-000000000003', 'changed');
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000003', 'brand-new') = 'wrong', 'old password still works';
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000003', 'changed') = 'ok', 'new password';

  -- 7. Deleting the lead deletes its hash.
  delete from public.leads where id = '00000000-0000-4000-8000-000000000003';
  select count(*) into n from public.lead_credentials where lead_id = '00000000-0000-4000-8000-000000000003';
  assert n = 0, 'hash outlived its lead';
end $$;

-- 8. Who can reach it.
do $$
declare who text; ok boolean;
begin
  foreach who in array array['anon', 'authenticated'] loop
    assert not has_table_privilege(who, 'public.lead_credentials', 'select'), who || ' can read the hashes';
    assert not has_table_privilege(who, 'public.lead_credentials', 'insert'), who || ' can write the hashes';
    assert not has_function_privilege(who, 'public.fn_guest_check_password(uuid, text)', 'execute'), who || ' can guess passwords';
    assert not has_function_privilege(who, 'public.fn_guest_set_password(uuid, text)', 'execute'), who || ' can set passwords';
    execute format('set local role %I', who);
    begin
      perform 1 from public.lead_credentials;
      ok := false;
    exception when insufficient_privilege then ok := true;
    end;
    reset role;
    assert ok, who || ' read lead_credentials';
  end loop;
  assert has_function_privilege('service_role', 'public.fn_guest_check_password(uuid, text)', 'execute'), 'server code cannot check';
  assert has_function_privilege('service_role', 'public.fn_guest_set_password(uuid, text)', 'execute'), 'server code cannot set';
  set local role service_role;
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000001', 'secret1') = 'ok', 'as service_role';
  reset role;
  assert (select relrowsecurity from pg_class where oid = 'public.lead_credentials'::regclass), 'RLS is off';
  assert not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_credentials'), 'a policy opens the table';
end $$;

-- 9. Running the migration again changes nothing (it is safe to re-apply).
\i supabase/migrations/20261112090000_guest_credentials.sql
do $$
begin
  assert public.fn_guest_check_password('00000000-0000-4000-8000-000000000001', 'secret1') = 'ok', 're-applied: password lost';
  assert (select count(*) from public.lead_credentials) = 2, 're-applied: rows changed';
end $$;

\echo ALL TESTS PASSED
