-- Local test for 20261112110000_app_quality_voice_down.sql.
--
--   createdb voice_test && psql -v ON_ERROR_STOP=1 -d voice_test \
--     -f supabase/tests/app_quality_voice_down.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

-- What the migration stands on, as 20261030130000_app_quality_alerts.sql and
-- the analytics migrations left it (only the columns the scan reads).
create table public.app_installs (install_id uuid primary key, test_reason text);
create table public.app_events (
  id bigint generated always as identity primary key,
  install_id uuid, event text, props jsonb default '{}'::jsonb,
  received_at timestamptz default now(), app_build int
);
create table public.app_event_types (
  event text primary key, family text, description_uz text, props text[], status text default 'active', added_in text
);
insert into public.app_event_types (event, family, description_uz, props) values
  ('interview_connect', 'prepare', 'Suhbat ulanishi', '{result,ms,error}');
create table public.app_quality_alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('version_zero', 'daily_volume')),
  key text not null, day date not null, detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), sent_at timestamptz,
  unique (kind, key, day)
);

\i supabase/migrations/20261112110000_app_quality_voice_down.sql

create function pg_temp.try(p_install uuid, p_result text, p_ago interval, p_props jsonb default '{}'::jsonb)
returns void language sql as $$
  insert into public.app_events (install_id, event, props, received_at)
  values (p_install, 'interview_connect', jsonb_build_object('result', p_result) || p_props, now() - p_ago);
$$;

do $$
declare
  a constant uuid := '00000000-0000-4000-8000-00000000000a';
  b constant uuid := '00000000-0000-4000-8000-00000000000b';
  found jsonb;
  v jsonb;
begin
  insert into public.app_installs values (a, null), (b, null);

  -- The registry lets the new props through.
  if (select props from public.app_event_types where event = 'interview_connect')
     <> '{result,ms,error,status,reason,cause}'::text[] then
    raise exception 'interview_connect props not registered';
  end if;

  -- Nothing happened: nothing found.
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 0 then raise exception 'empty: %', found; end if;

  -- Two failed starts are not an alarm yet.
  perform pg_temp.try(a, 'start_failed', interval '40 minutes');
  perform pg_temp.try(a, 'start_failed', interval '39 minutes');
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 0 then raise exception 'two fails: %', found; end if;

  -- The third is — as an old build reports it, with no reason.
  perform pg_temp.try(b, 'start_failed', interval '5 minutes');
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 1 then raise exception 'three fails: %', found; end if;
  v := found -> 0;
  if v ->> 'kind' <> 'voice_down' or v ->> 'key' <> 'interview'
     or (v -> 'detail' ->> 'fails')::int <> 3 or (v -> 'detail' ->> 'devices')::int <> 2
     or (v -> 'detail' ->> 'hours')::int <> 6
     or v -> 'detail' ? 'reason' or v -> 'detail' ? 'status' then
    raise exception 'alarm shape: %', v;
  end if;

  -- A build that says why: the latest reason and status go with it.
  perform pg_temp.try(b, 'start_failed', interval '2 minutes',
    '{"status": 400, "reason": "Your Wallet Balance is -0.21."}'::jsonb);
  found := public.fn_app_quality_scan(true);
  v := found -> 0 -> 'detail';
  if v ->> 'reason' <> 'Your Wallet Balance is -0.21.' or v ->> 'status' <> '400' or (v ->> 'fails')::int <> 4 then
    raise exception 'reason: %', v;
  end if;

  -- A dry run keeps nothing.
  if exists (select 1 from public.app_quality_alerts) then raise exception 'dry run kept an alarm'; end if;

  -- A real run keeps one and hands it back to be sent; a second run makes no second one.
  found := public.fn_app_quality_scan(false);
  if jsonb_array_length(found) <> 1 or (found -> 0 ->> 'id') is null then raise exception 'kept: %', found; end if;
  found := public.fn_app_quality_scan(false);
  if (select count(*) from public.app_quality_alerts where kind = 'voice_down') <> 1 then
    raise exception 'second alarm the same day';
  end if;

  -- Someone was greeted after the first failure: the calls work, no alarm.
  delete from public.app_quality_alerts;
  perform pg_temp.try(a, 'greeted', interval '1 minute');
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 0 then raise exception 'greeted since: %', found; end if;

  -- A greeting BEFORE the failures does not hide them.
  delete from public.app_events;
  perform pg_temp.try(a, 'greeted', interval '5 hours');
  perform pg_temp.try(a, 'start_failed', interval '3 hours');
  perform pg_temp.try(a, 'start_failed', interval '2 hours');
  perform pg_temp.try(b, 'start_failed', interval '1 hour');
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 1 then raise exception 'greeted before: %', found; end if;

  -- Failures older than the window do not count.
  delete from public.app_events;
  perform pg_temp.try(a, 'start_failed', interval '7 hours');
  perform pg_temp.try(a, 'start_failed', interval '6 hours 30 minutes');
  perform pg_temp.try(b, 'start_failed', interval '10 minutes');
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 0 then raise exception 'old fails: %', found; end if;

  -- Other ways a call ends (the student left, no greeting) are not this alarm.
  delete from public.app_events;
  perform pg_temp.try(a, 'left', interval '30 minutes');
  perform pg_temp.try(a, 'no_greeting', interval '20 minutes');
  perform pg_temp.try(b, 'left', interval '10 minutes');
  found := public.fn_app_quality_scan(true);
  if jsonb_array_length(found) <> 0 then raise exception 'other results: %', found; end if;

  -- The table takes the new kind and still refuses an unknown one.
  begin
    insert into public.app_quality_alerts (kind, key, day) values ('nonsense', 'x', current_date);
    raise exception 'unknown kind accepted';
  exception when check_violation then null;
  end;

  -- Only the server may run the scan.
  if has_function_privilege('anon', 'public.fn_app_quality_scan(boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.fn_app_quality_scan(boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.fn_app_quality_scan(boolean)', 'execute') then
    raise exception 'grants';
  end if;

  raise notice 'app_quality_voice_down: all checks passed';
end $$;
