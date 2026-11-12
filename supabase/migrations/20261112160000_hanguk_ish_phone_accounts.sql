-- Hanguk Ish (hanguk_ish/, P54): its apps sign in by phone and SMS code
-- again (Twilio Verify, «Phone» provider in Authentication). Such an account
-- is not anonymous, so P53 (20261112140000_hanguk_ish_no_anonymous.sql) does
-- not hold it back — and anyone can make one with the publishable key.
--
-- hanguk.uz has no phone accounts of its own (2026-11-12: 0 of 352 users
-- have a phone): its staff, students and guests sign in with an e-mail. So:
--
-- 1. Every account made without an e-mail — phone-only or anonymous — or
--    marked by the apps (user_metadata.app = 'hanguk_ish', P48) gets
--    app_metadata.app = 'hanguk_ish' as it is made. app_metadata is changed
--    only with the service key; the mark is put back if a later write of
--    app_metadata (Supabase Auth rewrites it on sign-in) leaves it out, so
--    the account cannot lose it. It is in every token of the account.
-- 2. P53's restrictive policies keep marked accounts out too: no row of any
--    hanguk.uz table (schema public), no file outside Hanguk Ish's buckets.
-- 3. hanguk.uz's sign-up trigger makes no hanguk.uz profile for them.
--
-- Hanguk Ish lives in the schema `ish` and its own buckets, which this does
-- not touch. Service keys and security definer functions are not under row
-- security anyway. Apply after P53, before the apps sign in by phone.
--
-- No DROP: triggers and functions are replaced, policies altered.
set local lock_timeout = '5s';

-- 1. The mark ---------------------------------------------------------------

create or replace function public.fn_mark_hanguk_ish_account()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if coalesce(NEW.is_anonymous, false)
     or coalesce(NEW.raw_user_meta_data->>'app', '') = 'hanguk_ish'
     or (coalesce(NEW.phone, '') <> '' and coalesce(NEW.email, '') = '')
     or (TG_OP = 'UPDATE' and coalesce(OLD.raw_app_meta_data->>'app', '') = 'hanguk_ish') then
    NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('app', 'hanguk_ish');
  end if;
  return NEW;
end;
$function$;

comment on function public.fn_mark_hanguk_ish_account() is
  'P54: marks Hanguk Ish accounts (phone-only, anonymous, or user_metadata.app = hanguk_ish) with app_metadata.app = hanguk_ish, and keeps the mark.';

revoke all on function public.fn_mark_hanguk_ish_account() from public, anon, authenticated;

create or replace trigger hanguk_ish_mark_account
  before insert or update of raw_app_meta_data, phone, email, is_anonymous on auth.users
  for each row execute function public.fn_mark_hanguk_ish_account();

-- Accounts made before this migration (none on 2026-11-12; P49's anonymous
-- ones if any): mark them now. The trigger does it on this update.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
where coalesce(raw_app_meta_data->>'app', '') <> 'hanguk_ish'
  and (coalesce(is_anonymous, false)
       or coalesce(raw_user_meta_data->>'app', '') = 'hanguk_ish'
       or (coalesce(phone, '') <> '' and coalesce(email, '') = ''));

-- 2. hanguk.uz's tables and files ---------------------------------------------
-- The rule for a table made later (in its own migration):
--   create policy hanguk_ish_no_anonymous on public.<table> as restrictive
--     for all to authenticated
--     using (coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) is false
--            and coalesce((select auth.jwt() -> 'app_metadata' ->> 'app'), '') <> 'hanguk_ish')
--     with check (<the same>);
do $$
declare
  t record;
  rule constant text :=
    '(coalesce((select auth.jwt() ->> ''is_anonymous'')::boolean, false) is false '
    'and coalesce((select auth.jwt() -> ''app_metadata'' ->> ''app''), '''') <> ''hanguk_ish'')';
  files constant text :=
    '(bucket_id = ''ish-avatars'' or ' || rule || ')';
begin
  for t in
    select c.relname,
           exists (select 1 from pg_policy p
                   where p.polrelid = c.oid and p.polname = 'hanguk_ish_no_anonymous') as has_policy
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    if t.has_policy then
      execute format('alter policy hanguk_ish_no_anonymous on public.%I using %s with check %s',
                     t.relname, rule, rule);
    else
      execute format('create policy hanguk_ish_no_anonymous on public.%I as restrictive for all to authenticated '
                     'using %s with check %s', t.relname, rule, rule);
    end if;
  end loop;

  if to_regclass('storage.objects') is not null then
    if exists (select 1 from pg_policy p
               where p.polrelid = to_regclass('storage.objects') and p.polname = 'hanguk_ish_no_anonymous') then
      execute format('alter policy hanguk_ish_no_anonymous on storage.objects using %s with check %s', files, files);
    else
      execute format('create policy hanguk_ish_no_anonymous on storage.objects as restrictive for all to authenticated '
                     'using %s with check %s', files, files);
    end if;
  end if;
end
$$;

-- 3. No hanguk.uz profile ------------------------------------------------------
-- Production's definition (20261111180000_hanguk_ish_skip_anonymous.sql,
-- md5 20fb880c… on 2026-11-12) with the mark of step 1 added.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
      BEGIN
        -- Hanguk Ish's people (P48), every anonymous account (P49) and every
        -- account the database marks as Hanguk Ish's (P54: phone-only):
        -- hanguk.uz makes no such accounts of its own.
        IF COALESCE(NEW.raw_user_meta_data->>'app', '') = 'hanguk_ish'
           OR COALESCE(NEW.raw_app_meta_data->>'app', '') = 'hanguk_ish'
           OR COALESCE(NEW.is_anonymous, false) THEN
          RETURN NEW;
        END IF;

        IF NEW.email LIKE 'guest-%@hanguk.local' THEN
          RETURN NEW;
        END IF;

        IF NEW.email LIKE 'student-%@hanguk.local' THEN
          UPDATE public.profiles
          SET user_id = NEW.id
          WHERE user_id = (NEW.raw_user_meta_data->>'original_user_id')::uuid;
          RETURN NEW;
        END IF;

        INSERT INTO public.profiles (user_id, full_name, preferred_language)
        VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'uz'))
        ON CONFLICT(user_id) DO NOTHING;

        RETURN NEW;
      END;
      $function$;
