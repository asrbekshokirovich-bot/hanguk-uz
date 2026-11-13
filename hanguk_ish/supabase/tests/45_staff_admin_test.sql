-- P58: a Hanguk Ish staff admin keeps the staff list in the CRM — adds
-- hanguk.uz's own CRM people only, sets their role, removes them; nobody
-- removes or demotes themselves; only admins see or change the list.
--
-- People: c1 — staff admin; c2 — staff (operator); e1 — a hanguk.uz call
-- operator, e2 — an investor, e3 — a student (no CRM role); a1 — a worker of
-- the fixtures.
select tests.as_admin();

-- hanguk.uz's CRM roles and profiles: the stub has them on plain PostgreSQL;
-- the Supabase stack has no hanguk.uz — made here, for this test only.
do $$
begin
  if to_regclass('public.user_roles') is null then
    create type public.app_role as enum ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff', 'investor');
    create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null,
                                    role public.app_role not null);
  end if;
  if to_regclass('public.profiles') is null then
    create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique, full_name text);
  end if;
end
$$;

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-0000000000c1', '+821000000031'),
  ('00000000-0000-0000-0000-0000000000c2', '+821000000032');
insert into ish.staff_members (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin'),
  ('00000000-0000-0000-0000-0000000000c2', 'operator');
update ish.profiles set first_name = 'Asrbek' where id = '00000000-0000-0000-0000-0000000000c1';
update ish.profiles set first_name = 'Madina', last_name = 'Rahimova' where id = '00000000-0000-0000-0000-0000000000c2';
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'olmos@hanguk.uz', '{"full_name": "Olmos Karimov"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'investor@example.com', '{"full_name": "Investor"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'student@example.com', '{"full_name": "Talaba"}');
insert into public.profiles (user_id, full_name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Olmos Karimov'),
  ('00000000-0000-0000-0000-0000000000e2', 'Investor'),
  ('00000000-0000-0000-0000-0000000000e3', 'Talaba')
on conflict (user_id) do nothing;
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'call_operator'),
  ('00000000-0000-0000-0000-0000000000e2', 'investor'),
  ('00000000-0000-0000-0000-0000000000c1', 'owner');

-- Only a staff admin.
select tests.as_user('00000000-0000-0000-0000-0000000000c2');
select tests.ok(not ish.is_staff_admin(), 'an operator is not an admin');
select tests.throws($$select ish.staff_people()$$, 'FORBIDDEN', 'an operator cannot see the list');
select tests.throws($$select ish.staff_add('00000000-0000-0000-0000-0000000000e1')$$, 'FORBIDDEN', 'nor add anyone');
select tests.throws($$select ish.staff_remove('00000000-0000-0000-0000-0000000000c1')$$, 'FORBIDDEN', 'nor remove anyone');
select tests.throws($$select ish.staff_set_role('00000000-0000-0000-0000-0000000000c2', 'admin')$$, 'FORBIDDEN',
                    'nor make themselves an admin');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.throws($$select ish.staff_people()$$, 'FORBIDDEN', 'nor a worker');
select tests.as_user('00000000-0000-0000-0000-0000000000e1');
select tests.throws($$select ish.staff_people()$$, 'FORBIDDEN', 'nor a CRM operator who is not Hanguk Ish staff');
select tests.as_anon();
select tests.throws($$select ish.staff_people()$$, 'permission denied', 'nor anybody signed out');
select tests.throws($$select * from ish.crm_staff_accounts()$$, 'permission denied', 'who cannot list the CRM either');

-- The list: the staff (the admin first, marked as the caller), and the CRM
-- people who could be added — not the investor, the student, the worker.
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.ok(ish.is_staff_admin(), 'the admin is one');
create temp table people as select ish.staff_people() as j;
grant select on people to authenticated;
select tests.eq((select array_agg(e ->> 'name' order by o) from people, jsonb_array_elements(j -> 'staff') with ordinality x(e, o)),
                array['Asrbek', 'Madina Rahimova'], 'the staff, the admin first');
select tests.eq((select (j -> 'staff' -> 0 ->> 'me') || '|' || (j -> 'staff' -> 0 ->> 'role') || '|' || (j -> 'staff' -> 1 ->> 'me')
                 from people), 'true|admin|false', 'which one is the caller, and the roles');
select tests.eq((select jsonb_agg(e ->> 'email') from people, jsonb_array_elements(j -> 'candidates') e),
                '["olmos@hanguk.uz"]'::jsonb, 'who could be added: hanguk.uz''s CRM people only');
select tests.eq((select j -> 'candidates' -> 0 -> 'roles' from people), '["call_operator"]'::jsonb, 'with their CRM role');

-- Adding: an ish profile named as in the CRM, staff at once.
select tests.eq(ish.staff_add('00000000-0000-0000-0000-0000000000e1'), 'operator', 'added');
select tests.as_admin();
select tests.eq((select first_name || '|' || last_name from ish.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
                'Olmos|Karimov', 'named as in the CRM');
select tests.as_user('00000000-0000-0000-0000-0000000000e1');
select tests.ok(ish.is_staff(), 'the CRM section opens for them');
select tests.eq(jsonb_typeof(ish.staff_businesses()), 'array', 'and its work');
select tests.ok(not ish.is_staff_admin(), 'as an operator');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.eq((select jsonb_array_length(ish.staff_people() -> 'candidates')), 0, 'nobody left to add');
select tests.eq((select e ->> 'email' from jsonb_array_elements(ish.staff_people() -> 'staff') e where e ->> 'name' = 'Olmos Karimov'),
                'olmos@hanguk.uz', 'on the list with the CRM e-mail');

-- Not everybody.
select tests.throws($$select ish.staff_add('00000000-0000-0000-0000-0000000000e2')$$, 'NOT_FOUND', 'not an investor');
select tests.throws($$select ish.staff_add('00000000-0000-0000-0000-0000000000e3')$$, 'NOT_FOUND', 'not a student');
select tests.throws($$select ish.staff_add('00000000-0000-0000-0000-0000000000a1')$$, 'NOT_FOUND', 'not a Hanguk Ish app account');
select tests.throws($$select ish.staff_add('00000000-0000-0000-0000-0000000000e1', 'boss')$$, 'INVALID', 'no made-up role');
select tests.throws($$select ish.staff_add('00000000-0000-0000-0000-0000000000c1', 'operator')$$, 'SELF',
                    'nor the admin''s own role through adding');

-- Roles: another admin; nobody demotes themselves.
select tests.eq(ish.staff_set_role('00000000-0000-0000-0000-0000000000e1', 'admin'), 'admin', 'made an admin');
select tests.throws($$select ish.staff_set_role('00000000-0000-0000-0000-0000000000c1', 'operator')$$, 'SELF',
                    'the admin cannot demote themselves');
select tests.throws($$select ish.staff_set_role('00000000-0000-0000-0000-0000000000c1', 'chief')$$, 'INVALID', 'no made-up role');
select tests.throws($$select ish.staff_set_role('00000000-0000-0000-0000-0000000000e3', 'admin')$$, 'NOT_FOUND',
                    'only someone on the list');
select tests.as_user('00000000-0000-0000-0000-0000000000e1');
select tests.ok(ish.is_staff_admin(), 'the new admin is one');
select tests.eq(ish.staff_set_role('00000000-0000-0000-0000-0000000000c1', 'operator'), 'operator',
                'one admin can make another an operator (one is always left)');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
select tests.throws($$select ish.staff_people()$$, 'FORBIDDEN', 'then the list is not theirs');

-- Removing: off the list, the section closes; their profile stays.
select tests.as_user('00000000-0000-0000-0000-0000000000e1');
select ish.staff_remove('00000000-0000-0000-0000-0000000000c2');
select tests.throws($$select ish.staff_remove('00000000-0000-0000-0000-0000000000e1')$$, 'SELF', 'nobody removes themselves');
select tests.throws($$select ish.staff_remove('00000000-0000-0000-0000-0000000000c2')$$, 'NOT_FOUND', 'nor someone not on it');
select tests.as_user('00000000-0000-0000-0000-0000000000c2');
select tests.ok(not ish.is_staff(), 'the removed one is not staff');
select tests.throws($$select ish.staff_businesses()$$, 'FORBIDDEN', 'and the work is closed to them');
select tests.as_admin();
select tests.eq((select first_name from ish.profiles where id = '00000000-0000-0000-0000-0000000000c2'), 'Madina',
                'their profile stays (what they made keeps its author)');
-- Added again, the profile is not renamed.
update ish.profiles set first_name = 'Madina (Hanguk Ish)' where id = '00000000-0000-0000-0000-0000000000c2';
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000c2', 'call_operator');
select tests.as_user('00000000-0000-0000-0000-0000000000e1');
select tests.eq(ish.staff_add('00000000-0000-0000-0000-0000000000c2', 'operator'), 'operator', 'back on the list');
select tests.as_admin();
select tests.eq((select first_name from ish.profiles where id = '00000000-0000-0000-0000-0000000000c2'), 'Madina (Hanguk Ish)',
                'with the profile it had');
