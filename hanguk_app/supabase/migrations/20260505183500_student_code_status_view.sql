-- Self-serve diagnostic view for counsellors / owner to debug
-- "code didn't work" reports without engineering involvement.
--
-- Usage:
--   select * from student_code_status where magic_code = 'QR6ZUBDZ';
-- Returns one row whose `status` column tells you exactly why it failed:
--   OK                    — login should work
--   NO_CODE               — student has no magic code at all
--   AUTH_USER_MISSING     — profile.user_id points to nothing (orphan)
--   PROFILE_USER_ID_DRIFT — auth user with deterministic email exists
--                           but profile.user_id is stale
--   BANNED                — auth user is banned
--   DELETED               — auth user is soft-deleted

create or replace view public.student_code_status as
select
  p.id                    as profile_id,
  p.full_name,
  p.magic_code,
  p.user_id               as profile_user_id,
  u.id                    as auth_user_id,
  u.email                 as auth_email,
  u.banned_until,
  u.deleted_at,
  case
    when p.magic_code is null then 'NO_CODE'
    when u.id is null then 'AUTH_USER_MISSING'
    when u.banned_until is not null and u.banned_until > now() then 'BANNED'
    when u.deleted_at is not null then 'DELETED'
    else 'OK'
  end                      as status
from public.profiles p
left join auth.users u on u.id = p.user_id;

-- Lock down: only service_role and owner-roles can read.
revoke all on public.student_code_status from public;
revoke all on public.student_code_status from anon;
revoke all on public.student_code_status from authenticated;
grant select on public.student_code_status to service_role;

comment on view public.student_code_status is
  'Counsellor-facing diagnostic view: paste a magic code and see the exact '
  'reason the student-login Edge Function would (or would not) accept it.';
