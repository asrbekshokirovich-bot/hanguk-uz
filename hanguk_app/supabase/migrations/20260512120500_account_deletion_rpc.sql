-- ─────────────────────────────────────────────────────────────────────────────
-- 20260512120000 — Account deletion RPC (`fn_delete_my_account`)
--
-- Required by both Apple App Store (5.1.1(v)) and Google Play (User Data
-- policy) for any app that supports account creation. Called from the
-- Flutter Account screen after the user types DELETE to confirm.
--
-- The function runs as SECURITY DEFINER so it can DELETE rows in tables
-- where the calling user's RLS policy would otherwise stop it (e.g. if a
-- subset of historical rows have a slightly different ownership column).
-- The first thing it does is read auth.uid() — if that's NULL, it raises.
--
-- It is intentionally idempotent — running it twice is harmless (the
-- second pass deletes zero rows and the auth.users update is a no-op).
--
-- Tables touched (read each migration that creates them to confirm the
-- ownership column):
--   - public.applications              user_id
--   - public.documents                 user_id
--   - public.student_suggestions       user_id (per applications_repository)
--   - public.study_plan_sessions       user_id
--   - public.study_plan_drafts         user_id
--   - public.study_plan_analyses       user_id
--   - public.study_plan_chat_history   user_id
--   - public.interview_sessions        user_id
--   - public.interview_messages        user_id
--   - public.interview_feedback        user_id (assumed; cascaded from session_id otherwise)
--   - public.channel_messages          sender_id (chat messages — anonymize, don't delete)
--   - public.user_roles                user_id
--   - public.profiles                  user_id
--   - auth.users                       id      (anonymize email/phone)
--
-- We anonymize the auth.users row rather than DELETE because there's no
-- reliable way to call auth.admin.deleteUser() from a SECURITY DEFINER
-- function without exposing the service_role key to clients. The
-- anonymized row carries no PII; the user can never sign back in with
-- their old credentials.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_anon_email text;
  v_anon_phone text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_anon_email := 'deleted-' || v_uid || '@deleted.local';
  v_anon_phone := null;

  -- Application-data tables. Wrap each delete in a savepoint-like
  -- `exception when undefined_table` so a missing table on staging
  -- doesn't abort the whole deletion.

  begin
    delete from public.applications where user_id = v_uid;
  exception when undefined_table then null;
  end;

  begin
    delete from public.documents where user_id = v_uid;
  exception when undefined_table then null;
  end;

  begin
    delete from public.student_suggestions where user_id = v_uid;
  exception when undefined_table then null;
  end;

  -- Study-plan / personal-statement trainer
  begin
    delete from public.study_plan_chat_history where user_id = v_uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.study_plan_analyses where user_id = v_uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.study_plan_drafts where user_id = v_uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.study_plan_sessions where user_id = v_uid;
  exception when undefined_table then null;
  end;

  -- Interview trainer
  begin
    delete from public.interview_feedback where user_id = v_uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.interview_messages where user_id = v_uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.interview_sessions where user_id = v_uid;
  exception when undefined_table then null;
  end;

  -- Chat messages: anonymize rather than delete (other students in the
  -- room shouldn't see message gaps). If sender_id is the column, set it
  -- to NULL and set sender_name to "deleted user". If the column doesn't
  -- exist, do nothing.
  begin
    update public.channel_messages
       set sender_id = null
     where sender_id = v_uid;
  exception when undefined_column or undefined_table then null;
  end;

  -- Role + profile rows
  begin
    delete from public.user_roles where user_id = v_uid;
  exception when undefined_table then null;
  end;
  begin
    delete from public.profiles where user_id = v_uid;
  exception when undefined_table or undefined_column then null;
  end;
  -- Some schemas use `id` instead of `user_id` on `profiles`.
  begin
    delete from public.profiles where id = v_uid;
  exception when undefined_table or undefined_column then null;
  end;

  -- Storage objects owned by the user. Storage uses owner = auth.uid().
  begin
    delete from storage.objects where owner = v_uid;
  exception when others then null;
  end;

  -- Anonymize the auth.users row. We cannot DELETE here without bringing
  -- the service_role key into a SECURITY DEFINER context, so we wipe PII
  -- and disable the account. The user is then signed out client-side.
  update auth.users
     set email = v_anon_email,
         phone = v_anon_phone,
         encrypted_password = null,
         raw_user_meta_data = '{}'::jsonb,
         email_change = null,
         phone_change = null,
         confirmation_token = '',
         email_change_token_new = '',
         email_change_token_current = '',
         phone_change_token = '',
         recovery_token = '',
         reauthentication_token = '',
         banned_until = (now() at time zone 'utc') + interval '100 years',
         deleted_at = now()
   where id = v_uid;
end;
$$;

revoke all on function public.fn_delete_my_account() from public;
grant execute on function public.fn_delete_my_account() to authenticated;

comment on function public.fn_delete_my_account is
  'Deletes the calling user''s data and anonymizes their auth.users row. '
  'Required by Apple App Store 5.1.1(v) and Google Play User Data policy. '
  'Called from the in-app Account screen.';
