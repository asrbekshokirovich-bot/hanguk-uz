-- A student's documents stopped opening in the CRM after their first sign-in
-- to the app.
--
-- Staff upload a new student's documents before the student has ever signed
-- in: the files go to student-documents/<profile.user_id>/<file>. On the first
-- sign-in student-login-v2 creates the auth user (a new id), MOVES the files
-- to <new id>/<file> and then sets profiles.user_id to the new id, which the
-- foreign key cascades to documents.student_id. Nothing rewrote
-- documents.file_path: the rows kept pointing at the old folder, where there
-- is no file any more.
--
-- 2026-11-12: 40 documents of 5 students were unreachable this way — all 8 of
-- a student who signed in on 10 November, all 11 of one who signed in on the
-- 11th — and 2 translation jobs were waiting on such a source. The same thing
-- had been repaired by hand before: documents_file_path_repairs holds 118 rows
-- from 16 September to 3 November.
--
-- 1. A trigger: whenever a document's student_id is set, a path that is under
--    another folder follows the student — but only when the file is NOT where
--    the row says and IS in the student's folder. A path that works is never
--    touched, and a file whose move failed stays reachable where it is.
--    The rewrite is logged in documents_file_path_repairs, as the manual
--    repairs were.
-- 2. The rows that are stale today are healed by the same trigger (setting
--    student_id to itself). file_path is not in that statement's SET list, so
--    the triggers on "UPDATE OF file_path" (document processing, automatic
--    translation) do not run again for documents that did not change.

create or replace function public.trg_documents_path_follows_student()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_folder text;
  v_new    text;
  v_slash  int;
begin
  if new.student_id is null or coalesce(new.file_path, '') = '' then
    return new;
  end if;
  v_slash := position('/' in new.file_path);
  if v_slash < 2 then
    return new;
  end if;
  v_folder := left(new.file_path, v_slash - 1);
  if v_folder = new.student_id::text then
    return new;
  end if;

  v_new := new.student_id::text || substr(new.file_path, v_slash);
  if not exists (select 1 from storage.objects o
                  where o.bucket_id = 'student-documents' and o.name = new.file_path)
     and exists (select 1 from storage.objects o
                  where o.bucket_id = 'student-documents' and o.name = v_new) then
    insert into public.documents_file_path_repairs (document_id, old_file_path, new_file_path, repaired_at)
    values (new.id, new.file_path, v_new, now());
    new.file_path := v_new;
  end if;
  return new;
end;
$$;

revoke all on function public.trg_documents_path_follows_student() from public, anon, authenticated;

drop trigger if exists documents_path_follows_student on public.documents;
create trigger documents_path_follows_student
  before update of student_id on public.documents
  for each row execute function public.trg_documents_path_follows_student();

-- Heal what is stale now (only rows whose file is missing where they point).
update public.documents d
   set student_id = d.student_id
 where coalesce(d.file_path, '') <> ''
   and split_part(d.file_path, '/', 1) <> d.student_id::text
   and not exists (select 1 from storage.objects o
                    where o.bucket_id = 'student-documents' and o.name = d.file_path);
