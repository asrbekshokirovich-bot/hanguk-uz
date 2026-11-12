-- Test helpers: assertions and switching who the database thinks is calling.
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Fails the test file with [msg] unless [cond] is true.
create function tests.ok(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAILED: %', msg;
  end if;
end $$;

create function tests.eq(got anyelement, want anyelement, msg text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % (got %, want %)', msg, got, want;
  end if;
end $$;

-- Runs [stmt]; it must fail with an error whose message contains [want].
create function tests.throws(stmt text, want text, msg text) returns void
language plpgsql as $$
declare
  v_msg text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if position(want in v_msg) = 0 then
      raise exception 'FAILED: % (error was "%", wanted "%")', msg, v_msg, want;
    end if;
    return;
  end;
  raise exception 'FAILED: % (no error, wanted "%")', msg, want;
end $$;

-- Whether [p_user] is an anonymous account (Supabase puts it in the JWT).
create function tests.is_anonymous(p_user uuid) returns boolean
language sql stable security definer as $$
  select coalesce((select u.is_anonymous from auth.users u where u.id = p_user), false)
$$;

-- Acts as [p_user] through PostgREST: role authenticated + JWT claims (with
-- is_anonymous, as Supabase Auth issues them).
create function tests.as_user(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', tests.is_anonymous(p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

-- Back to the superuser the tests run as (fixtures, time travel).
create function tests.as_admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'none', true);
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
