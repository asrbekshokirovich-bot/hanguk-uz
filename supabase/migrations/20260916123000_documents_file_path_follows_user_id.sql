-- A document must live in the folder its student is allowed to read.
--
-- `documents.student_id` references `profiles.user_id` ON UPDATE CASCADE
-- (20260506110000_fix_profiles_user_id_cascading_fks). The first time a
-- student redeems a magic code, `student-login-v2` creates the real auth user,
-- repoints `profiles.user_id` at it, and the cascade carries every document
-- row across. The function also moves the files themselves from
-- `<placeholder id>/...` to `<auth id>/...` in the `student-documents` bucket.
-- What nothing ever did was rewrite `documents.file_path`, so the row kept
-- naming the folder from before the first login.
--
-- The storage policy for students is "first folder of the object name equals
-- auth.uid()". A path in the old folder fails that check, so every preview
-- from the app answered 400 "Object not found" -- the 서류 tab's
-- "문서를 열지 못했습니다" toast, reported 2026-09-16 by a student whose five
-- approved documents all pointed at the pre-login folder. Staff were hit too:
-- document-proxy downloads by `file_path`, and the object had left that path
-- when it was moved.
--
-- On 2026-09-16, 137 rows across 23 students named a folder other than their
-- `student_id`. This repairs the 111 whose file is already in the student's
-- folder (the move ran, the row never followed). A path is rewritten only when
-- the object verifiably exists at the new name, so a row pointing at a legacy
-- public URL or at a file that is gone is left exactly as it is.
--
-- The other 26 rows (3 students) still have their file in the old folder: the
-- accounts were created outside the login function, so the move never ran.
-- SQL cannot move a storage object (the name is part of its S3 key), so
-- `student-login-v2` now reconciles paths on every login and moves what is
-- left; those three are repaired the next time they sign in.
--
-- Every rewrite is recorded so it can be undone:
--
--   update public.documents d set file_path = r.old_file_path
--   from public.documents_file_path_repairs r where r.document_id = d.id;

create table if not exists public.documents_file_path_repairs (
  document_id   uuid        primary key,
  old_file_path text        not null,
  new_file_path text        not null,
  repaired_at   timestamptz not null default now()
);

comment on table public.documents_file_path_repairs is
  'Audit of documents.file_path rewrites made so paths follow profiles.user_id. No policies: service role only.';

alter table public.documents_file_path_repairs enable row level security;

with candidates as (
  select d.id,
         d.file_path as old_file_path,
         d.student_id::text || '/' || substr(d.file_path, position('/' in d.file_path) + 1)
           as new_file_path
  from public.documents d
  where position('/' in d.file_path) > 0
    and d.file_path not like d.student_id::text || '/%'
),
verified as (
  select c.*
  from candidates c
  where exists (
    select 1 from storage.objects o
    where o.bucket_id = 'student-documents' and o.name = c.new_file_path
  )
),
recorded as (
  insert into public.documents_file_path_repairs (document_id, old_file_path, new_file_path)
  select id, old_file_path, new_file_path from verified
  on conflict (document_id) do nothing
  returning document_id
)
update public.documents d
set file_path = v.new_file_path
from verified v
where d.id = v.id;
