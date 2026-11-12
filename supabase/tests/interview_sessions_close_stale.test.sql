-- Local test for 20261112100000_interview_sessions_close_stale.sql and
-- 20261112101000_documents_file_type_fix.sql.
--
--   createdb stale_test && psql -v ON_ERROR_STOP=1 -d stale_test \
--     -f supabase/tests/interview_sessions_close_stale.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  status text default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);
create table public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.interview_sessions (id) on delete cascade,
  role text, content text, created_at timestamptz default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  file_path text, file_type text, status text default 'uploaded', updated_at timestamptz default now()
);

insert into public.interview_sessions (id, status, started_at, ended_at) values
  ('00000000-0000-4000-8000-00000000000a', 'active',    now() - interval '2 days',    null),                        -- left, with messages
  ('00000000-0000-4000-8000-00000000000b', 'active',    now() - interval '7 months',  null),                        -- left, never spoke
  ('00000000-0000-4000-8000-00000000000c', 'active',    now() - interval '20 minutes', null),                       -- going on right now
  ('00000000-0000-4000-8000-00000000000d', 'completed', now() - interval '3 days',    now() - interval '3 days'),   -- finished
  ('00000000-0000-4000-8000-00000000000e', 'active',    now() - interval '4 hours',   now() - interval '230 minutes'), -- has an end already
  ('00000000-0000-4000-8000-00000000000f', 'active',    now() - interval '2 hours 59 minutes', null);               -- not three hours yet
insert into public.interview_messages (session_id, role, content, created_at) values
  ('00000000-0000-4000-8000-00000000000a', 'interviewer', 'Hello', now() - interval '2 days' + interval '10 seconds'),
  ('00000000-0000-4000-8000-00000000000a', 'student', 'Hi', now() - interval '2 days' + interval '95 seconds');

insert into public.documents (id, file_path, file_type) values
  ('00000000-0000-4000-8000-000000000101', 'u1/passport.jpg', 'application/jpg'),
  ('00000000-0000-4000-8000-000000000102', 'u1/photo.JPG',    'application/JPG'),
  ('00000000-0000-4000-8000-000000000103', 'u1/diploma.PDF',  'application/PDF'),
  ('00000000-0000-4000-8000-000000000104', 'u1/scan.heic',    ''),
  ('00000000-0000-4000-8000-000000000105', 'u1/ok.pdf',       'application/pdf'),
  ('00000000-0000-4000-8000-000000000106', 'u1/ok.png',       'image/png'),
  ('00000000-0000-4000-8000-000000000107', 'u1/letter.docx',  'application/jpg'), -- the type lies about another kind of file: left alone
  ('00000000-0000-4000-8000-000000000108', 'u1/noext',        '');

\i supabase/migrations/20261112100000_interview_sessions_close_stale.sql
\i supabase/migrations/20261112101000_documents_file_type_fix.sql

do $$
declare s record; n int;
begin
  -- Left sessions are closed, with the time of their last line.
  select * into s from public.interview_sessions where id = '00000000-0000-4000-8000-00000000000a';
  assert s.status = 'abandoned', 'a: ' || s.status;
  assert abs(extract(epoch from (s.ended_at - (s.started_at + interval '95 seconds')))) < 1, 'a ended_at: ' || s.ended_at;

  -- Never spoke: ends when it began.
  select * into s from public.interview_sessions where id = '00000000-0000-4000-8000-00000000000b';
  assert s.status = 'abandoned' and s.ended_at = s.started_at, 'b';

  -- An interview going on now, and one not three hours old, are not touched.
  select * into s from public.interview_sessions where id = '00000000-0000-4000-8000-00000000000c';
  assert s.status = 'active' and s.ended_at is null, 'c';
  select * into s from public.interview_sessions where id = '00000000-0000-4000-8000-00000000000f';
  assert s.status = 'active', 'f';

  -- A finished one keeps its status; a recorded end is kept.
  select * into s from public.interview_sessions where id = '00000000-0000-4000-8000-00000000000d';
  assert s.status = 'completed', 'd';
  select * into s from public.interview_sessions where id = '00000000-0000-4000-8000-00000000000e';
  assert s.status = 'abandoned' and s.ended_at < now() - interval '3 hours', 'e';

  -- A second run finds nothing.
  assert public.interview_sessions_close_stale() = 0, 'second run closed something';

  -- Who may run it.
  assert not has_function_privilege('anon', 'public.interview_sessions_close_stale()', 'execute'), 'anon';
  assert not has_function_privilege('authenticated', 'public.interview_sessions_close_stale()', 'execute'), 'authenticated';
  assert has_function_privilege('service_role', 'public.interview_sessions_close_stale()', 'execute'), 'service_role';

  -- Document types.
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000101') = 'image/jpeg', '101';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000102') = 'image/jpeg', '102';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000103') = 'application/pdf', '103';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000104') = 'image/heic', '104';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000105') = 'application/pdf', '105';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000106') = 'image/png', '106';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000107') = 'application/jpg', '107 changed';
  assert (select file_type from public.documents where id = '00000000-0000-4000-8000-000000000108') = '', '108 changed';
end $$;

\echo ALL TESTS PASSED
