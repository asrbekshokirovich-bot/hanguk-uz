-- Stop students silently vanishing from every season list on their first login.
--
-- `student_intakes.student_id` holds `profiles.user_id`, not `profiles.id`.
-- `student-login` rewrites `profiles.user_id` from the pre-login placeholder to
-- the real auth id the first time a student redeems a magic code. The
-- membership row kept the old value, and with no foreign key nothing objected
-- -- the student just dropped out of the CRM list, the dashboard counts and the
-- investor views at once, with no error anywhere.
--
-- The pre-login uuid survives verbatim in the auth email
-- (`student-<old_user_id>@hanguk.local`), which is how the four affected rows
-- were identified and repointed rather than guessed at:
--
--   AKHMADJANOVA DINARA TAGIROVNA   spring 2027
--   IBODULLAYEVA OYGUL PARDABOY QIZI spring 2027  (the 10M payment with no
--                                                  membership was this)
--   sssss                            spring 2027  (test record)
--   arslanov xo'jamurod test         spring 2027  (test record)
--
-- Dinara was hit twice: after the first login detached her, staff re-entered
-- her as a new profile, so the bug also produced the duplicate.
--
-- `profiles.user_id` is already UNIQUE, so it can carry a foreign key. The
-- cascade makes the database guarantee what the edge function kept forgetting:
-- repoint the profile and the membership follows; delete the profile and the
-- membership goes with it instead of becoming an orphan.
--
-- The data repair ran ahead of this constraint (the ALTER would have failed
-- while orphans existed) and is not repeated here -- it is inherently
-- one-shot, and re-running it against a healthy table would be a no-op at
-- best. Recorded above so the history is not lost.

alter table public.student_intakes
  add constraint student_intakes_student_id_fkey
  foreign key (student_id) references public.profiles(user_id)
  on update cascade
  on delete cascade;
