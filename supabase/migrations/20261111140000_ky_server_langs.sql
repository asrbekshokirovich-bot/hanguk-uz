-- Qirg'iz tili (reja claude/qirgiziston-reja.md, KG6; Asrbek 2026-11-11):
-- ilova 'ky' tilida ham ishlaydi (KG7). Mehmonning push tokeni va Telegram
-- obunasi tilini server hozir 5 til ro'yxatidan tashqari bo'lsa 'uz' ga
-- aylantiradi — qirg'izcha telefon o'zbekcha eslatma olardi. Bu migratsiya
-- ro'yxatga 'ky' qo'shadi; boshqa hech narsa o'zgarmaydi (funksiyalar prod
-- ta'rifidan, md5 bc5d7bbb… va d75e95f6… bilan tekshirilgan nusxa).

alter table public.app_guest_push_tokens drop constraint if exists app_guest_push_tokens_preferred_lang_check;
alter table public.app_guest_push_tokens add constraint app_guest_push_tokens_preferred_lang_check
  check (preferred_lang = any (array['uz', 'ru', 'en', 'ko', 'vi', 'ky']));

alter table public.app_telegram_subs drop constraint if exists app_telegram_subs_lang_check;
alter table public.app_telegram_subs add constraint app_telegram_subs_lang_check
  check (lang = any (array['uz', 'ru', 'en', 'ko', 'vi', 'ky']));

CREATE OR REPLACE FUNCTION public.app_push_token_register(p_install_id uuid, p_platform text, p_token text, p_lang text DEFAULT 'uz'::text, p_app_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_lang text := lower(left(coalesce(p_lang, 'uz'), 2));
begin
  if p_install_id is null or p_token is null or length(p_token) not between 20 and 4096
     or coalesce(p_platform, '') not in ('android', 'ios', 'web') then
    return jsonb_build_object('status', 'bad_input');
  end if;
  if not exists (select 1 from public.app_installs i where i.install_id = p_install_id) then
    return jsonb_build_object('status', 'unknown_install');
  end if;
  if v_lang not in ('uz', 'ru', 'en', 'ko', 'vi', 'ky') then
    v_lang := 'uz';
  end if;
  insert into public.app_guest_push_tokens as t (token, install_id, platform, preferred_lang, app_version)
  values (p_token, p_install_id, p_platform, v_lang, left(p_app_version, 40))
  on conflict (token) do update
     set install_id = excluded.install_id, platform = excluded.platform,
         preferred_lang = excluded.preferred_lang, app_version = excluded.app_version,
         enabled = true, updated_at = now();
  -- a phone keeps its three newest tokens at most
  delete from public.app_guest_push_tokens t
   where t.install_id = p_install_id
     and t.token not in (select x.token from public.app_guest_push_tokens x
                          where x.install_id = p_install_id order by x.updated_at desc limit 3);
  return jsonb_build_object('status', 'ok');
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_telegram_sub_code(p_install_id uuid, p_lang text DEFAULT 'uz'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_lang text := lower(left(coalesce(p_lang, 'uz'), 2));
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_install_id is null or not exists (select 1 from public.app_installs i where i.install_id = p_install_id) then
    return jsonb_build_object('status', 'unknown_install');
  end if;
  if v_lang not in ('uz', 'ru', 'en', 'ko', 'vi', 'ky') then v_lang := 'uz'; end if;
  select s.code into v_code from public.app_telegram_subs s where s.install_id = p_install_id;
  if v_code is null then
    loop
      v_code := (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 10));
      begin
        insert into public.app_telegram_subs (install_id, code, lang) values (p_install_id, v_code, v_lang);
        exit;
      exception when unique_violation then
        if exists (select 1 from public.app_telegram_subs s where s.install_id = p_install_id) then
          select s.code into v_code from public.app_telegram_subs s where s.install_id = p_install_id;
          exit;
        end if;
      end;
    end loop;
  else
    update public.app_telegram_subs set lang = v_lang where install_id = p_install_id;
  end if;
  return jsonb_build_object('status', 'ok', 'code', v_code,
    'linked', exists (select 1 from public.app_telegram_subs s where s.install_id = p_install_id and s.enabled));
end;
$function$;
