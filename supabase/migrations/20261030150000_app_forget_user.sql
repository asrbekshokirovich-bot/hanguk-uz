-- When a student deletes their account (plan v2, section 9 «Maxfiylik»:
-- «hisob o'chirilsa, o'chirish oqimi hodisalarni anonimlashtiradi va
-- bog'lanishni uzadi»): their app activity stays only as anonymous counts.
--   * events, visits and device days lose the user;
--   * their phones lose the user and the lead card, and every tie of those
--     phones to a lead (app_identity, Telegram codes) goes;
--   * the person's profile, signals and guest push tokens go.
-- It runs when the account is marked deleted (auth.users.deleted_at set —
-- what fn_delete_my_account does at its end), in the same transaction.

create or replace function public.fn_app_forget_user(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_installs uuid[];
  v_events   int;
begin
  if p_uid is null then
    return jsonb_build_object('status', 'nothing');
  end if;
  select coalesce(array_agg(i.install_id), '{}') into v_installs
    from public.app_installs i where i.user_id = p_uid;

  delete from public.app_identity where install_id = any (v_installs);
  update public.app_contact_codes set lead_id = null where install_id = any (v_installs);
  delete from public.app_guest_push_tokens where install_id = any (v_installs);

  update public.app_events set user_id = null where user_id = p_uid;
  get diagnostics v_events = row_count;
  update public.app_sessions set user_id = null where user_id = p_uid;
  update public.app_device_days set user_id = null where user_id = p_uid;
  update public.app_installs set user_id = null, lead_id = null where install_id = any (v_installs);

  delete from public.app_signals where user_id = p_uid;
  delete from public.app_person_profile
   where user_id = p_uid or person_key = 'user:' || p_uid
      or exists (select 1 from unnest(installs) x where x = any (v_installs));

  return jsonb_build_object('status', 'ok', 'installs', coalesce(array_length(v_installs, 1), 0), 'events', v_events);
end;
$$;

revoke all on function public.fn_app_forget_user(uuid) from public, anon, authenticated;

create or replace function public.trg_auth_user_deleted_forget_app()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  perform public.fn_app_forget_user(new.id);
  return null;
end;
$$;

revoke all on function public.trg_auth_user_deleted_forget_app() from public, anon, authenticated;

drop trigger if exists auth_user_deleted_forget_app on auth.users;
create trigger auth_user_deleted_forget_app
  after update of deleted_at on auth.users
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.trg_auth_user_deleted_forget_app();
