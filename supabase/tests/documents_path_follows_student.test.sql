-- Local test for 20261112120000_documents_path_follows_student.sql.
--
--   createdb docpath_test && psql -v ON_ERROR_STOP=1 -d docpath_test \
--     -f supabase/tests/documents_path_follows_student.test.sql
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema storage;
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, unique (bucket_id, name));
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique not null);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (user_id) on update cascade on delete cascade,
  name text, file_path text, status text default 'uploaded', updated_at timestamptz default now()
);
create table public.documents_file_path_repairs (
  document_id uuid, old_file_path text, new_file_path text, repaired_at timestamptz
);
-- What must NOT run again for a document whose file did not change.
create table public.reprocessed (document_id uuid);
create function public.note_reprocess() returns trigger language plpgsql as $$
begin insert into public.reprocessed values (new.id); return null; end $$;
create trigger trg_enqueue_document_processing after insert or update of file_path on public.documents
  for each row execute function public.note_reprocess();

-- Three students. A: signed in before (stale rows already). B: will sign in during the test.
-- C: nothing wrong.
insert into public.profiles (user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000002'),   -- A's current id
  ('bbbbbbbb-0000-4000-8000-000000000001'),   -- B before the first sign-in
  ('cccccccc-0000-4000-8000-000000000001');
insert into public.documents (id, student_id, name, file_path) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000002', 'passport', 'aaaaaaaa-0000-4000-8000-000000000001/passport.jpg'),  -- stale, file moved
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000002', 'diploma',  'aaaaaaaa-0000-4000-8000-000000000001/diploma.pdf'),   -- stale, file lost altogether
  ('00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-000000000002', 'photo',    'aaaaaaaa-0000-4000-8000-000000000001/photo.png'),     -- other folder, but the file IS there
  ('00000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000001', 'passport', 'bbbbbbbb-0000-4000-8000-000000000001/passport.jpg'),
  ('00000000-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-000000000001', 'diploma',  'bbbbbbbb-0000-4000-8000-000000000001/diploma.pdf'),
  ('00000000-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-000000000001', 'passport', 'cccccccc-0000-4000-8000-000000000001/passport.jpg');
insert into storage.objects (bucket_id, name) values
  ('student-documents', 'aaaaaaaa-0000-4000-8000-000000000002/passport.jpg'),
  ('student-documents', 'aaaaaaaa-0000-4000-8000-000000000001/photo.png'),
  ('student-documents', 'bbbbbbbb-0000-4000-8000-000000000001/passport.jpg'),
  ('student-documents', 'bbbbbbbb-0000-4000-8000-000000000001/diploma.pdf'),
  ('student-documents', 'cccccccc-0000-4000-8000-000000000001/passport.jpg'),
  -- the same file name in ANOTHER bucket must not count
  ('payment-receipts',  'aaaaaaaa-0000-4000-8000-000000000002/diploma.pdf');
delete from public.reprocessed;

\i supabase/migrations/20261112120000_documents_path_follows_student.sql

do $$
declare n int;
begin
  -- The migration healed the one stale row whose file is in the student's folder…
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000a1')
     <> 'aaaaaaaa-0000-4000-8000-000000000002/passport.jpg' then raise exception 'a1 not healed'; end if;
  -- …left the one whose file is nowhere (nothing to point at)…
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000a2')
     <> 'aaaaaaaa-0000-4000-8000-000000000001/diploma.pdf' then raise exception 'a2 touched'; end if;
  -- …and the one that works where it is.
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000a3')
     <> 'aaaaaaaa-0000-4000-8000-000000000001/photo.png' then raise exception 'a3 touched'; end if;
  if (select count(*) from public.documents_file_path_repairs) <> 1 then raise exception 'repairs logged: %', (select count(*) from public.documents_file_path_repairs); end if;
  if (select old_file_path || ' -> ' || new_file_path from public.documents_file_path_repairs)
     <> 'aaaaaaaa-0000-4000-8000-000000000001/passport.jpg -> aaaaaaaa-0000-4000-8000-000000000002/passport.jpg' then
    raise exception 'repair log';
  end if;
  -- Healing did not send the documents through processing again.
  if exists (select 1 from public.reprocessed) then raise exception 'reprocessed on heal'; end if;

  -- B signs in for the first time, as student-login-v2 does it: the files are
  -- moved (one move fails), then the profile gets the new id.
  update storage.objects set name = 'bbbbbbbb-0000-4000-8000-000000000002/passport.jpg'
   where name = 'bbbbbbbb-0000-4000-8000-000000000001/passport.jpg';
  update public.profiles set user_id = 'bbbbbbbb-0000-4000-8000-000000000002'
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000001';

  select count(*) into n from public.documents where student_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  if n <> 2 then raise exception 'cascade: %', n; end if;
  -- The moved file is followed…
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000b1')
     <> 'bbbbbbbb-0000-4000-8000-000000000002/passport.jpg' then raise exception 'b1 not followed'; end if;
  -- …the one whose move failed stays reachable where it still is.
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000b2')
     <> 'bbbbbbbb-0000-4000-8000-000000000001/diploma.pdf' then raise exception 'b2 broken'; end if;
  if exists (select 1 from public.reprocessed) then raise exception 'reprocessed on sign-in'; end if;
  if (select count(*) from public.documents_file_path_repairs) <> 2 then raise exception 'second repair not logged'; end if;

  -- The failed move is retried later (by hand, or a later run): the next time the
  -- student is set on the row, it follows too.
  update storage.objects set name = 'bbbbbbbb-0000-4000-8000-000000000002/diploma.pdf'
   where name = 'bbbbbbbb-0000-4000-8000-000000000001/diploma.pdf';
  update public.documents set student_id = student_id where id = '00000000-0000-4000-8000-0000000000b2';
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000b2')
     <> 'bbbbbbbb-0000-4000-8000-000000000002/diploma.pdf' then raise exception 'b2 not followed later'; end if;

  -- C was never touched; an ordinary update (a status) changes no path.
  update public.documents set status = 'approved' where id = '00000000-0000-4000-8000-0000000000c1';
  if (select file_path from public.documents where id = '00000000-0000-4000-8000-0000000000c1')
     <> 'cccccccc-0000-4000-8000-000000000001/passport.jpg' then raise exception 'c1 touched'; end if;

  -- A new upload with its own path is processed as before (the insert trigger still runs).
  insert into public.documents (student_id, name, file_path)
  values ('cccccccc-0000-4000-8000-000000000001', 'photo', 'cccccccc-0000-4000-8000-000000000001/photo.png');
  if (select count(*) from public.reprocessed) <> 1 then raise exception 'insert not processed'; end if;

  -- Not callable from the API.
  if has_function_privilege('anon', 'public.trg_documents_path_follows_student()', 'execute')
     or has_function_privilege('authenticated', 'public.trg_documents_path_follows_student()', 'execute') then
    raise exception 'grants';
  end if;

  raise notice 'documents_path_follows_student: all checks passed';
end $$;
