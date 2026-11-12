-- Hanguk Ish lives in hanguk.uz's Supabase project, in its own schema `ish`
-- (P48). On the plain PostgreSQL tests/run.sh made hanguk.uz's look-alikes
-- before the migrations (tests/main_app_stub.sql, hanguk.uz's sign-up
-- function and trigger); on the Supabase stack there is no hanguk.uz and only
-- what holds there too is checked.
select to_regclass('public.main_canary') is not null as main \gset

-- Nothing of Hanguk Ish is in `public`: no function, table or type of its
-- names there, but hanguk.uz's own.
select tests.eq(
  (select coalesce(array_agg(distinct p.proname::text order by p.proname::text), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname <> 'handle_new_user'
     and p.proname in (select q.proname from pg_proc q join pg_namespace m on m.oid = q.pronamespace
                       where m.nspname = 'ish')),
  '{}'::text[], 'no Hanguk Ish function in public');
select tests.eq(
  (select coalesce(array_agg(c.relname::text order by c.relname::text), '{}')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname not in ('profiles', 'applications', 'messages', 'main_canary')
     and c.relname in (select d.relname from pg_class d join pg_namespace m on m.oid = d.relnamespace
                       where m.nspname = 'ish' and d.relkind = 'r')),
  '{}'::text[], 'no Hanguk Ish table in public');
select tests.eq(
  (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
     and t.typname in ('app_language', 'business_status', 'shift_status', 'application_status')),
  0, 'no Hanguk Ish type in public');

-- Sign-up. A Hanguk Ish app signs up with user_metadata.app = 'hanguk_ish':
-- its profile is ish.profiles, never hanguk.uz's public.profiles.
insert into auth.users (id, phone, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000e1', '+821011112222', '{"app": "hanguk_ish"}');
select tests.eq((select phone from ish.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
                '+821011112222', 'an app sign-up gets a Hanguk Ish profile');

-- hanguk.uz's staff and students sign up with an e-mail: no Hanguk Ish
-- profile (they are not workers or employers by signing in to hanguk.uz).
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000e2', 'ali@example.com', '{"full_name": "Ali"}');
select tests.ok(not exists (select 1 from ish.profiles where id = '00000000-0000-0000-0000-0000000000e2'),
                'an e-mail sign-up (hanguk.uz) gets no Hanguk Ish profile');

-- A phone-only account without the mark is a Hanguk Ish one too.
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000e3', '+821033334444');
select tests.ok(exists (select 1 from ish.profiles where id = '00000000-0000-0000-0000-0000000000e3'),
                'a phone-only sign-up gets a Hanguk Ish profile');

-- P49: the apps start an anonymous account on the phone (no SMS), marked as
-- Hanguk Ish's: it gets a Hanguk Ish profile. An unmarked anonymous account
-- (another client's) gets none.
insert into auth.users (id, is_anonymous, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000e4', true, '{"app": "hanguk_ish"}');
select tests.ok(exists (select 1 from ish.profiles where id = '00000000-0000-0000-0000-0000000000e4'),
                'an anonymous app account gets a Hanguk Ish profile');
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000e5', true);
select tests.ok(not exists (select 1 from ish.profiles where id = '00000000-0000-0000-0000-0000000000e5'),
                'an unmarked anonymous account gets no Hanguk Ish profile');

-- A hanguk.uz account (e-mail) becomes Hanguk Ish staff the way README
-- («Xodimlar») says: a Hanguk Ish profile first — what the staff make points
-- to it (the employers they keep, their notes) — then the staff row.
select tests.throws(
  $$insert into ish.staff_members (user_id) values ('00000000-0000-0000-0000-0000000000e2')$$,
  'violates foreign key constraint', 'staff without a Hanguk Ish profile: refused (profile first)');
insert into ish.profiles (id) select id from auth.users where email = 'ali@example.com' on conflict (id) do nothing;
insert into ish.staff_members (user_id) select id from auth.users where email = 'ali@example.com';
select tests.as_user('00000000-0000-0000-0000-0000000000e2');
select tests.ok(ish.is_staff(), 'a hanguk.uz e-mail account made staff: is_staff()');
select tests.ok(ish.staff_save_business(null, '달빛카페', p_contact => '{"phone": "010-1234-5678"}') is not null,
                'and keeps an employer outside the app');
select tests.as_admin();

-- Live updates: the three Hanguk Ish tables are in the publication.
select tests.eq(
  (select coalesce(array_agg(tablename::text order by tablename::text), '{}')
   from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'ish'),
  case when exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       then array['applications', 'messages', 'notifications'] else '{}'::text[] end,
  'realtime: ish.applications, ish.messages, ish.notifications');

\if :main
-- hanguk.uz's sign-up still makes its own profile, and skips the app's.
select tests.eq((select full_name from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e2'),
                'Ali', 'hanguk.uz sign-up: its profile row as before');
select tests.ok(not exists (select 1 from public.profiles where user_id = '00000000-0000-0000-0000-0000000000e1'),
                'a Hanguk Ish app sign-up: no hanguk.uz profile row');
select tests.ok(not exists (select 1 from public.profiles
                           where user_id in ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e5')),
                'an anonymous account (P49): no hanguk.uz profile row, marked or not');

-- hanguk.uz's rights and rows are as they were.
select tests.ok(has_table_privilege('authenticated', 'public.main_canary', 'select'),
                'hanguk.uz table: signed-in still read it');
select tests.ok(not has_table_privilege('authenticated', 'public.main_canary', 'insert'),
                'hanguk.uz table: and still cannot write it');
select tests.ok(not has_table_privilege('anon', 'public.main_canary', 'select'),
                'hanguk.uz table: signed-out still cannot read it');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select note from public.main_canary where id = 1), 'hanguk.uz',
                'hanguk.uz row: readable by its own policy');
select tests.as_admin();

-- P53: an anonymous account (the apps' since P49) is kept out of hanguk.uz's
-- tables (supabase/migrations/…_hanguk_ish_no_anonymous.sql at the repository
-- root): the policy that lets a signed-in account read the row does not let it.
-- Its Hanguk Ish side works as before.
select tests.eq((select count(*)::int from pg_policy
                 where polname = 'hanguk_ish_no_anonymous' and not polpermissive
                   and polrelid in ('public.profiles'::regclass, 'public.applications'::regclass,
                                    'public.messages'::regclass, 'public.main_canary'::regclass)),
                4, 'every hanguk.uz table with row security keeps anonymous accounts out');
select tests.eq((select count(*)::int from pg_policy
                 where polname = 'hanguk_ish_no_anonymous'
                   and polrelid in (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                    where n.nspname = 'ish')),
                0, 'Hanguk Ish''s own tables are not touched');
select tests.as_user('00000000-0000-0000-0000-0000000000e4');
select tests.eq((select count(*)::int from public.main_canary), 0, 'an anonymous account: hanguk.uz rows are not for it');
select tests.throws($$insert into public.profiles (user_id, full_name) values ('00000000-0000-0000-0000-0000000000e4', 'x')$$,
                    'row-level security', 'nor can it write itself a hanguk.uz profile');
select tests.eq((select count(*)::int from ish.profiles where id = '00000000-0000-0000-0000-0000000000e4'), 1,
                'its Hanguk Ish profile is there for it');
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
select tests.eq((select count(*)::int from public.main_canary), 1, 'a hanguk.uz account still reads the row');
select tests.as_admin();
select tests.ok(exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'),
                'hanguk.uz live updates: its table is still in the publication');
select tests.eq((select count(*)::int from pg_trigger where tgrelid = 'auth.users'::regclass
                 and tgname in ('on_auth_user_created', 'ish_on_auth_user_created')),
                2, 'both sign-up triggers on auth.users: hanguk.uz''s and Hanguk Ish''s');
\endif
