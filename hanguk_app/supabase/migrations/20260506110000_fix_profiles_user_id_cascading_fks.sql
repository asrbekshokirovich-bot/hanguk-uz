-- Root cause of the magic-code login failures:
--   The handle_new_user trigger UPDATEs profiles.user_id when a new student
--   auth user is created. But four foreign keys reference profiles.user_id
--   WITHOUT ON UPDATE CASCADE, so the UPDATE fails and createUser bombs out
--   with "Database error creating new user". This blocks ~18 orphan students
--   from ever logging in.
--
-- Fix: drop the broken FKs and recreate them with ON UPDATE CASCADE.
-- Verified empirically against profile 67e1cb1d-...DUSANOV via a savepoint
-- test that reproduced the exact failure.
--
-- One FK (payments_student_id_profiles_fkey) is a true duplicate of the
-- already-correct payments_student_id_fkey, so it gets dropped outright.

begin;

-- 1. payments — has TWO FKs to profiles.user_id, one without CASCADE.
--    Drop the broken duplicate.
alter table public.payments
  drop constraint if exists payments_student_id_profiles_fkey;

-- 2. scheduled_payments — recreate with ON UPDATE CASCADE.
alter table public.scheduled_payments
  drop constraint if exists scheduled_payments_student_id_fkey;
alter table public.scheduled_payments
  add constraint scheduled_payments_student_id_fkey
  foreign key (student_id) references public.profiles(user_id)
  on update cascade on delete cascade
  not valid;  -- pre-existing orphan rows are unrelated; enforce only forward.

-- 3. student_budgets — recreate with ON UPDATE CASCADE.
alter table public.student_budgets
  drop constraint if exists student_budgets_student_id_fkey;
alter table public.student_budgets
  add constraint student_budgets_student_id_fkey
  foreign key (student_id) references public.profiles(user_id)
  on update cascade on delete cascade
  not valid;  -- pre-existing orphan rows are unrelated; enforce only forward.

-- 4. university_documents — recreate with ON UPDATE CASCADE.
alter table public.university_documents
  drop constraint if exists university_documents_uploaded_by_fkey;
alter table public.university_documents
  add constraint university_documents_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(user_id)
  on update cascade on delete cascade
  not valid;  -- pre-existing orphan rows are unrelated; enforce only forward.

commit;
