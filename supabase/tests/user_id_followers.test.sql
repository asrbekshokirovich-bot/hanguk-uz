-- Local test for 20261112130000_user_id_followers.sql.
--
--   createdb followers_test && psql -v ON_ERROR_STOP=1 -d followers_test \
--     -f supabase/tests/user_id_followers.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key, email text);
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique not null, full_name text);
create table public.translation_jobs (id uuid primary key default gen_random_uuid(), student_id uuid, status text default 'completed');
create table public.student_app_invites (id uuid primary key default gen_random_uuid(), student_id uuid);
create table public.staff_bonuses (id uuid primary key default gen_random_uuid(), student_id uuid, staff_user_id uuid, bonus_amount numeric, status text default 'pending');
create table public.room_members (id uuid primary key default gen_random_uuid(), room_id uuid, user_id uuid, unique (room_id, user_id));

-- A: signed in long ago (old …a1 → new …a2); rows were left behind, and a second
--    bonus was made under the new id since.
-- B: signed in long ago (…b1 → …b2); one bonus, still under the old id.
-- C: has not signed in yet (placeholder …c1); signs in during the test.
-- D: a deleted student whose bonus must stay as it is.
insert into auth.users values
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'student-aaaaaaaa-0000-4000-8000-0000000000a1@hanguk.local'),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'student-bbbbbbbb-0000-4000-8000-0000000000b1@hanguk.local'),
  -- an account whose email carries its own id: nothing moved
  ('eeeeeeee-0000-4000-8000-0000000000e1', 'student-eeeeeeee-0000-4000-8000-0000000000e1@hanguk.local'),
  ('ffffffff-0000-4000-8000-0000000000f1', 'staff@example.com');
insert into public.profiles (user_id, full_name) values
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'A'),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', 'B'),
  ('cccccccc-0000-4000-8000-0000000000c1', 'C'),
  ('eeeeeeee-0000-4000-8000-0000000000e1', 'E'),
  ('ffffffff-0000-4000-8000-0000000000f1', 'Staff');

insert into public.translation_jobs (student_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1'), ('aaaaaaaa-0000-4000-8000-0000000000a1'),
  ('cccccccc-0000-4000-8000-0000000000c1'), ('eeeeeeee-0000-4000-8000-0000000000e1');
insert into public.student_app_invites (student_id) values
  ('bbbbbbbb-0000-4000-8000-0000000000b1'), ('cccccccc-0000-4000-8000-0000000000c1');
insert into public.staff_bonuses (student_id, staff_user_id, bonus_amount) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'ffffffff-0000-4000-8000-0000000000f1', 150000),  -- A, old id
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'ffffffff-0000-4000-8000-0000000000f1', 150000),  -- A, the duplicate under the new id
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'ffffffff-0000-4000-8000-0000000000f1', 100000),  -- B, old id only
  ('cccccccc-0000-4000-8000-0000000000c1', 'ffffffff-0000-4000-8000-0000000000f1', 100000),  -- C
  ('dddddddd-0000-4000-8000-0000000000d1', 'ffffffff-0000-4000-8000-0000000000f1', 200000);  -- D, deleted student
insert into public.room_members (room_id, user_id) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a1'),  -- A's old id…
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000a2'),  -- …and the new one, same room
  ('22222222-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-0000000000a1'),  -- A's old id, another room
  ('11111111-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-0000000000c1'),
  ('11111111-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-0000000000f1');

\i supabase/migrations/20261112130000_user_id_followers.sql

do $$
declare n int;
begin
  -- Repair: translations and the invite follow.
  if (select count(*) from public.translation_jobs where student_id = 'aaaaaaaa-0000-4000-8000-0000000000a2') <> 2 then raise exception 'A translations'; end if;
  if (select count(*) from public.student_app_invites where student_id = 'bbbbbbbb-0000-4000-8000-0000000000b2') <> 1 then raise exception 'B invite'; end if;
  -- B's only bonus follows; A's two bonuses are both left where they are.
  if (select count(*) from public.staff_bonuses where student_id = 'bbbbbbbb-0000-4000-8000-0000000000b2') <> 1 then raise exception 'B bonus'; end if;
  if (select count(*) from public.staff_bonuses where student_id = 'aaaaaaaa-0000-4000-8000-0000000000a1') <> 1
     or (select count(*) from public.staff_bonuses where student_id = 'aaaaaaaa-0000-4000-8000-0000000000a2') <> 1 then
    raise exception 'A duplicate bonuses were touched';
  end if;
  -- The deleted student's bonus and the account that never moved: untouched.
  if (select count(*) from public.staff_bonuses where student_id = 'dddddddd-0000-4000-8000-0000000000d1') <> 1 then raise exception 'D bonus'; end if;
  if (select count(*) from public.translation_jobs where student_id = 'eeeeeeee-0000-4000-8000-0000000000e1') <> 1 then raise exception 'E'; end if;
  -- Rooms: where the new id is already a member the old row stays (no duplicate key), elsewhere it follows.
  if (select count(*) from public.room_members where room_id = '11111111-0000-4000-8000-000000000001' and user_id = 'aaaaaaaa-0000-4000-8000-0000000000a2') <> 1 then raise exception 'room 1'; end if;
  if (select count(*) from public.room_members where room_id = '22222222-0000-4000-8000-000000000002' and user_id = 'aaaaaaaa-0000-4000-8000-0000000000a2') <> 1 then raise exception 'room 2'; end if;
  -- C has not signed in: nothing of theirs moved.
  if (select count(*) from public.translation_jobs where student_id = 'cccccccc-0000-4000-8000-0000000000c1') <> 1 then raise exception 'C early'; end if;

  -- C signs in for the first time: the profile gets the new id, everything follows.
  update public.profiles set user_id = 'cccccccc-0000-4000-8000-0000000000c2' where user_id = 'cccccccc-0000-4000-8000-0000000000c1';
  select count(*) into n from (
    select 1 from public.translation_jobs    where student_id = 'cccccccc-0000-4000-8000-0000000000c2'
    union all select 1 from public.student_app_invites where student_id = 'cccccccc-0000-4000-8000-0000000000c2'
    union all select 1 from public.staff_bonuses       where student_id = 'cccccccc-0000-4000-8000-0000000000c2'
    union all select 1 from public.room_members        where user_id    = 'cccccccc-0000-4000-8000-0000000000c2') x;
  if n <> 4 then raise exception 'C after sign-in: %', n; end if;
  select count(*) into n from (
    select 1 from public.translation_jobs    where student_id = 'cccccccc-0000-4000-8000-0000000000c1'
    union all select 1 from public.student_app_invites where student_id = 'cccccccc-0000-4000-8000-0000000000c1'
    union all select 1 from public.staff_bonuses       where student_id = 'cccccccc-0000-4000-8000-0000000000c1'
    union all select 1 from public.room_members        where user_id    = 'cccccccc-0000-4000-8000-0000000000c1') x;
  if n <> 0 then raise exception 'C left behind: %', n; end if;

  -- Another change to a profile moves nothing.
  update public.profiles set full_name = 'Staff 2' where user_id = 'ffffffff-0000-4000-8000-0000000000f1';
  if (select count(*) from public.room_members where user_id = 'ffffffff-0000-4000-8000-0000000000f1') <> 1 then raise exception 'staff'; end if;

  if has_function_privilege('anon', 'public.trg_profiles_user_id_followers()', 'execute')
     or has_function_privilege('authenticated', 'public.trg_profiles_user_id_followers()', 'execute') then
    raise exception 'grants';
  end if;
  raise notice 'user_id_followers: all checks passed';
end $$;
