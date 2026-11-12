-- Local test for 20261112183000_profiles_protect_self_insert.sql.
--
--   createdb self_insert_test && psql -v ON_ERROR_STOP=1 -d self_insert_test \
--     -f supabase/tests/profiles_protect_self_insert.test.sql
--
-- The profiles columns, defaults, INSERT policies and has_role are as in
-- production (2026-11-12); auth.uid() reads the JWT claims as Supabase does.
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create type public.app_role as enum ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff', 'investor');
create type public.university_selection_status as enum ('none', 'pending', 'approved');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz default now()
);
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text,
  phone text,
  preferred_language text default 'uz',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  username text unique,
  office_location text,
  contract_date date,
  payment_plan text,
  notes text,
  magic_code text unique,
  payment_mode text default 'one_time' check (payment_mode in ('one_time', 'installment')),
  contract_url text,
  status text default 'offline' check (status in ('online', 'offline', 'away', 'active', 'cancelled')),
  sip1_user text, sip1_password text, sip1_server text, sip1_port text default '5060', sip1_label text,
  sip2_user text, sip2_password text, sip2_server text, sip2_port text default '5060', sip2_label text,
  university_notes text,
  university_selection_status public.university_selection_status default 'none',
  role text default 'student' check (role in ('student', 'contracted_student', 'counselor', 'admin', 'uni_db_reviewer')),
  is_demo boolean not null default false
);
alter table public.profiles enable row level security;
create policy "Users can insert their own profile" on public.profiles for insert
  with check ((select auth.uid()) = user_id);
create policy "Staff can insert student profiles" on public.profiles for insert
  with check (public.has_role((select auth.uid()), 'owner') or public.has_role((select auth.uid()), 'admin')
              or public.has_role((select auth.uid()), 'call_operator') or public.has_role((select auth.uid()), 'document_handler'));
create policy "Users can view their own profile" on public.profiles for select
  using ((select auth.uid()) = user_id);
create policy "Staff can view all profiles" on public.profiles for select
  using (public.has_role((select auth.uid()), 'owner') or public.has_role((select auth.uid()), 'admin'));
grant select, insert, update on public.profiles to authenticated, service_role;
grant select on public.user_roles to authenticated;

-- a person who signs in (no role), a call operator, and the student accounts they write for
insert into public.user_roles (user_id, role) values ('22222222-0000-4000-8000-000000000002', 'call_operator');

\i supabase/migrations/20261112183000_profiles_protect_self_insert.sql

-- 1. An account writes itself a profile with every privilege it can name.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.profiles (user_id, full_name, phone, preferred_language, created_at, role, username, magic_code,
                             status, is_demo, contract_date, contract_url, payment_plan, payment_mode, notes,
                             university_notes, university_selection_status, office_location,
                             sip1_user, sip1_password, sip1_server, sip1_port, sip1_label,
                             sip2_user, sip2_password, sip2_server, sip2_port, sip2_label)
values ('11111111-0000-4000-8000-000000000001', 'Ali Valiyev', '+998901234567', 'ru', '2020-01-01', 'admin', 'ali',
        'MAGIC1', 'active', true, '2026-01-01', 'https://example.com/c.pdf', 'premium', 'installment', 'paid in full',
        'note', 'approved', 'Toshkent', 'u1', 'p1', 's1', '1111', 'l1', 'u2', 'p2', 's2', '2222', 'l2');
commit;

do $$
declare p public.profiles;
begin
  select * into p from public.profiles where user_id = '11111111-0000-4000-8000-000000000001';
  -- what a person fills in stays
  if p.full_name <> 'Ali Valiyev' or p.phone <> '+998901234567' or p.preferred_language <> 'ru' then
    raise exception 'own fields lost: %', row_to_json(p);
  end if;
  -- privileges take their defaults
  if p.payment_plan is not null then raise exception 'payment_plan kept: %', p.payment_plan; end if;
  if p.role <> 'student' then raise exception 'role kept: %', p.role; end if;
  if p.status <> 'offline' or p.is_demo or p.payment_mode <> 'one_time' then raise exception 'status/is_demo/payment_mode kept'; end if;
  if p.username is not null or p.magic_code is not null then raise exception 'username/magic_code kept'; end if;
  if p.contract_date is not null or p.contract_url is not null or p.notes is not null or p.university_notes is not null then
    raise exception 'contract/notes kept';
  end if;
  if p.university_selection_status <> 'none' or p.office_location is not null then raise exception 'selection/office kept'; end if;
  if p.sip1_user is not null or p.sip1_password is not null or p.sip1_server is not null or p.sip1_port <> '5060' or p.sip1_label is not null
     or p.sip2_user is not null or p.sip2_password is not null or p.sip2_server is not null or p.sip2_port <> '5060' or p.sip2_label is not null then
    raise exception 'sip kept';
  end if;
  if p.created_at < now() - interval '1 minute' then raise exception 'created_at kept: %', p.created_at; end if;
end $$;

-- 2. Someone else's profile still cannot be written (RLS, unchanged).
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  insert into public.profiles (user_id, full_name) values ('99999999-0000-4000-8000-000000000009', 'X');
  raise exception 'wrote a profile for another account';
exception when insufficient_privilege then null;
end $$;
commit;

-- 3. Staff write a student's profile as they mean it.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.profiles (user_id, full_name, payment_plan, status, contract_date, role)
values ('33333333-0000-4000-8000-000000000003', 'Student S', 'standart', 'active', '2026-11-01', 'contracted_student');
commit;

-- 4. The service role (edge functions) and SECURITY DEFINER code (handle_new_user) pass through.
begin;
set local role service_role;
insert into public.profiles (user_id, full_name, payment_plan, is_demo) values ('44444444-0000-4000-8000-000000000004', 'Demo', 'premium', true);
commit;
create function public.definer_insert(p_user uuid) returns void language sql security definer set search_path = public as $$
  insert into public.profiles (user_id, full_name, payment_plan, username) values (p_user, 'Signed up', 'free', 'signed_up')
$$;
grant execute on function public.definer_insert(uuid) to authenticated;
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-0000-4000-8000-000000000005","role":"authenticated"}', true);
select public.definer_insert('55555555-0000-4000-8000-000000000005');
commit;

do $$ begin
  if (select payment_plan || '/' || status || '/' || role from public.profiles where user_id = '33333333-0000-4000-8000-000000000003')
     <> 'standart/active/contracted_student' then
    raise exception 'staff insert changed';
  end if;
  if (select payment_plan from public.profiles where user_id = '44444444-0000-4000-8000-000000000004') <> 'premium'
     or not (select is_demo from public.profiles where user_id = '44444444-0000-4000-8000-000000000004') then
    raise exception 'service role insert changed';
  end if;
  if (select payment_plan || '/' || username from public.profiles where user_id = '55555555-0000-4000-8000-000000000005')
     <> 'free/signed_up' then
    raise exception 'security definer insert changed';
  end if;
end $$;

-- 5. Run again: nothing to replace, no error.
\i supabase/migrations/20261112183000_profiles_protect_self_insert.sql
do $$ begin
  if (select count(*) from pg_trigger where tgrelid = 'public.profiles'::regclass and tgname = 'trg_profiles_protect_self_insert') <> 1 then
    raise exception 'trigger count';
  end if;
end $$;

\echo 'profiles_protect_self_insert: all checks passed'
