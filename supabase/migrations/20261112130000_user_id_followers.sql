-- Four tables lose a student on their first sign-in to the app.
--
-- student-login-v2 replaces profiles.user_id (the placeholder a student has
-- before signing in) with the id of the auth user it creates. Tables that
-- reference profiles(user_id) follow through their foreign keys. These four
-- hold the same id with no foreign key, so their rows stayed on the old id:
--
--   translation_jobs.student_id     the student's certified translations are
--                                   no longer listed under them (4 rows)
--   student_app_invites.student_id  "was this student invited?" is answered
--                                   no again (3 rows)
--   room_members.user_id            the student is out of their university
--                                   room (2 rows)
--   staff_bonuses.student_id        the bonus shows as «Unknown Student», and
--                                   the "sync missing bonuses" action — which
--                                   looks for the student's CURRENT id —
--                                   creates a second bonus (28 rows)
--
-- Counted on 2026-11-12 over the 57 students whose id has changed; the old id
-- survives in the auth email (student-<old id>@hanguk.local), which is how the
-- rows below are matched, not guessed (as in
-- 20260804140000_student_intakes_follow_user_id.sql).
--
-- 1. A trigger on profiles: when user_id changes, the four tables follow.
--    (No foreign keys: staff_bonuses keeps the bonuses of students who were
--    deleted since — 111 rows — and room_members holds staff too.)
-- 2. One-time repair of the rows left behind — except bonuses of students who
--    ALREADY have a bonus under the new id: 25 students have two bonuses now
--    (old id 3 250 000 UZS of duplicates, all still pending). Which of the two
--    stays is the owner's decision; they are not touched here.

create or replace function public.trg_profiles_user_id_followers()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if old.user_id is null or new.user_id is null or new.user_id = old.user_id then
    return null;
  end if;

  update public.translation_jobs    set student_id = new.user_id where student_id = old.user_id;
  update public.student_app_invites set student_id = new.user_id where student_id = old.user_id;
  update public.staff_bonuses       set student_id = new.user_id where student_id = old.user_id;
  -- (room_id, user_id) is unique: a membership the new id already has stays as it is.
  update public.room_members m
     set user_id = new.user_id
   where m.user_id = old.user_id
     and not exists (select 1 from public.room_members x
                      where x.room_id = m.room_id and x.user_id = new.user_id);
  return null;
end;
$$;

revoke all on function public.trg_profiles_user_id_followers() from public, anon, authenticated;

create or replace trigger profiles_user_id_followers
  after update of user_id on public.profiles
  for each row execute function public.trg_profiles_user_id_followers();

-- The rows left behind so far. old id → new id, only where the student lives
-- under the new id and nobody holds the old one.
do $$
declare
  v record;
begin
  for v in
    select m.old_id, m.new_id
      from (select (substring(u.email from '^student-([0-9a-f-]{36})@hanguk\.local$'))::uuid as old_id, u.id as new_id
              from auth.users u
             where u.email ~ '^student-[0-9a-f-]{36}@hanguk\.local$') m
     where m.old_id <> m.new_id
       and exists (select 1 from public.profiles p where p.user_id = m.new_id)
       and not exists (select 1 from public.profiles p where p.user_id = m.old_id)
  loop
    update public.translation_jobs    set student_id = v.new_id where student_id = v.old_id;
    update public.student_app_invites set student_id = v.new_id where student_id = v.old_id;
    update public.room_members m
       set user_id = v.new_id
     where m.user_id = v.old_id
       and not exists (select 1 from public.room_members x
                        where x.room_id = m.room_id and x.user_id = v.new_id);
    -- A bonus follows only when the student has none under the new id yet.
    update public.staff_bonuses b
       set student_id = v.new_id
     where b.student_id = v.old_id
       and not exists (select 1 from public.staff_bonuses x where x.student_id = v.new_id);
  end loop;
end $$;
