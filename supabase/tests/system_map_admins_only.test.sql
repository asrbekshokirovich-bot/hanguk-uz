-- Local test for 20261112140000_system_map_admins_only.sql.
--
--   createdb sysmap_test && psql -v ON_ERROR_STOP=1 -d sysmap_test \
--     -f supabase/tests/system_map_admins_only.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

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

-- The two tables and their policies, as production has them.
create table public.system_map_nodes (id text primary key, label text not null, ring int not null default 1);
create table public.system_map_connections (
  id uuid primary key default gen_random_uuid(),
  from_node text not null references public.system_map_nodes(id) on delete cascade,
  to_node text not null references public.system_map_nodes(id) on delete cascade);
alter table public.system_map_nodes enable row level security;
alter table public.system_map_connections enable row level security;
grant select, insert, update, delete on public.system_map_nodes, public.system_map_connections to anon, authenticated, service_role;

create policy "Public can read nodes" on public.system_map_nodes for select to anon using (true);
create policy "Authenticated users can read nodes" on public.system_map_nodes for select to authenticated using (true);
create policy "Admins can manage nodes" on public.system_map_nodes for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) or has_role((select auth.uid()), 'owner'::app_role));
create policy "Public can read connections" on public.system_map_connections for select to anon using (true);
create policy "Authenticated users can read connections" on public.system_map_connections for select to authenticated using (true);
create policy "Admins can manage connections" on public.system_map_connections for all to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) or has_role((select auth.uid()), 'owner'::app_role));

insert into public.user_roles values
  ('00000000-0000-4000-8000-00000000000a', 'owner'),
  ('00000000-0000-4000-8000-00000000000b', 'admin'),
  ('00000000-0000-4000-8000-00000000000c', 'call_operator');
insert into public.system_map_nodes (id, label) values ('hub', 'Hanguk'), ('t-leads', 'Leads DB');
insert into public.system_map_connections (from_node, to_node) values ('hub', 't-leads');

-- Before: a visitor and a student read the whole map.
set role anon;
do $$ begin
  if (select count(*) from public.system_map_nodes) <> 2 then raise exception 'setup: anon should read before'; end if;
end $$;
reset role;

\i supabase/migrations/20261112140000_system_map_admins_only.sql

-- A visitor: not even allowed to ask.
set role anon;
do $$ begin
  begin
    perform 1 from public.system_map_nodes;
    raise exception 'anon can still read nodes';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.system_map_connections;
    raise exception 'anon can still read connections';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Signed in, not an admin (a student, a guest, an operator): sees nothing.
set role authenticated;
select set_config('test.uid', '00000000-0000-4000-8000-0000000000ff', false);
do $$ begin
  if (select count(*) from public.system_map_nodes) <> 0 then raise exception 'a student reads nodes'; end if;
  if (select count(*) from public.system_map_connections) <> 0 then raise exception 'a student reads connections'; end if;
end $$;
select set_config('test.uid', '00000000-0000-4000-8000-00000000000c', false);
do $$ begin
  if (select count(*) from public.system_map_nodes) <> 0 then raise exception 'an operator reads nodes'; end if;
  if (select count(*) from public.system_map_connections) <> 0 then raise exception 'an operator reads connections'; end if;
end $$;

-- Owner and admin: read as before, and still edit.
select set_config('test.uid', '00000000-0000-4000-8000-00000000000a', false);
do $$ begin
  if (select count(*) from public.system_map_nodes) <> 2 then raise exception 'owner cannot read nodes'; end if;
  if (select count(*) from public.system_map_connections) <> 1 then raise exception 'owner cannot read connections'; end if;
end $$;
select set_config('test.uid', '00000000-0000-4000-8000-00000000000b', false);
do $$ begin
  if (select count(*) from public.system_map_nodes) <> 2 then raise exception 'admin cannot read nodes'; end if;
  insert into public.system_map_nodes (id, label) values ('t-tasks', 'Tasks DB');
  update public.system_map_nodes set label = 'Tasks' where id = 't-tasks';
  if (select label from public.system_map_nodes where id = 't-tasks') <> 'Tasks' then raise exception 'admin cannot edit nodes'; end if;
  insert into public.system_map_connections (from_node, to_node) values ('hub', 't-tasks');
  delete from public.system_map_nodes where id = 't-tasks';
  if (select count(*) from public.system_map_connections) <> 1 then raise exception 'admin cannot delete'; end if;
end $$;
reset role;

-- No policy is left for anon, and none says "true".
do $$ begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename in ('system_map_nodes', 'system_map_connections')
                and ('anon' = any (roles) or 'public' = any (roles) or coalesce(qual, '') in ('true', '(true)'))) then
    raise exception 'an open policy is left';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('system_map_nodes', 'system_map_connections')) <> 6 then
    raise exception 'policies were added or lost';
  end if;
end $$;

\echo system_map_admins_only: all checks passed
