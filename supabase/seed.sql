-- ─────────────────────────────────────────────────────────────────────────────
-- Local seed — runs automatically on `supabase db reset` / first `supabase start`.
-- NEVER runs against the hosted project (`supabase db push` does not apply seeds).
--
-- Creates one owner staff account so you can log in immediately:
--
--     username: owner
--     password: password123
--
-- (The app signs staff in as `${username}@hanguk.local`, so this is the
--  owner@hanguk.local auth user.)
--
-- The whole bootstrap is wrapped in an exception-guarded block: if the local
-- GoTrue (auth) schema differs from what we insert here, the seed rolls back
-- cleanly and does NOTHING — the reset still succeeds and the app falls back to
-- its built-in first-run owner setup (system_settings.owner_created stays false,
-- so opening the app shows the "create first owner" screen).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

do $seed$
declare
  v_uid      uuid := '00000000-0000-4000-8000-000000000001';
  v_email    text := 'owner@hanguk.local';
  v_password text := 'password123';
begin
  perform set_config('search_path', 'extensions, public, pg_catalog', true);

  -- Idempotent: skip if this owner already exists.
  if exists (select 1 from auth.users where email = v_email) then
    return;
  end if;

  -- 1) Auth user (bcrypt password, pre-confirmed email).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Local Owner', 'username', 'owner', 'preferred_language', 'uz'),
    now(), now(), '', '', '', ''
  );

  -- 2) Email identity (required for signInWithPassword).
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email),
    'email', now(), now(), now()
  );

  -- 3) The on_auth_user_created trigger already created the profile row; stamp
  --    the staff username / name onto it.
  update public.profiles
     set username = 'owner', full_name = 'Local Owner'
   where user_id = v_uid;

  -- 4) Grant the owner role (this is what makes the app treat them as staff → /crm).
  insert into public.user_roles (user_id, role)
  values (v_uid, 'owner')
  on conflict (user_id, role) do nothing;

  -- 5) Flip the app out of first-run setup mode into the normal login screen.
  update public.system_settings
     set owner_created = true, signup_enabled = false
   where id = 'main';

  raise notice 'seed: local owner ready — log in with  owner / password123';
exception when others then
  raise notice 'seed: owner bootstrap skipped (%); use the app''s first-run owner setup instead.', sqlerrm;
end
$seed$;
