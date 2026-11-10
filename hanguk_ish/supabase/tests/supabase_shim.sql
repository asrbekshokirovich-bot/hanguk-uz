-- Minimal stand-in for what a Supabase database provides before migrations
-- run: the API roles, auth.users, auth.uid()/auth.role() and the default
-- grants on the public schema. Used ONLY by tests/run.sh on a plain
-- PostgreSQL (local or the CI service container) — never applied to a real
-- Supabase project, which already has all of this.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator noinherit login password 'test';
grant anon, authenticated, service_role to authenticator;

create schema auth;
create schema extensions;
grant usage on schema auth, extensions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Same definitions as Supabase's (they read the JWT claims PostgREST sets).
create function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
