-- Xodim boti PR-6: CRM «Sozlamalar → Bot».
-- Owner vaqtlarni, ish kunlarini, xulosa oluvchilarni va yoqish/o'chirishni o'zgartiradi;
-- saqlanganda cron jadvallari bot_settings asosida qayta tuziladi.
-- Vaqtlar Toshkent bo'yicha 05:00–23:59 oralig'ida (UTC'da o'sha kun bo'lishi uchun).

insert into public.bot_settings (key, value) values
  ('morning_enabled', 'true'),
  ('report_enabled', 'true')
on conflict (key) do nothing;

-- Toshkent HH:MM → cron "m h * * dow" (UTC = Toshkent − 5 soat).
create or replace function public.bot_cron_expr(p_time text, p_workdays text)
returns text
language plpgsql
immutable
as $$
declare
  h int; m int; dows text;
begin
  if p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'bad time %', p_time using errcode = '22023';
  end if;
  h := split_part(p_time, ':', 1)::int;
  m := split_part(p_time, ':', 2)::int;
  if h < 5 then
    raise exception 'time must be between 05:00 and 23:59: %', p_time using errcode = '22023';
  end if;
  select string_agg(case when d::int = 7 then '0' else d end, ',' order by d::int)
    into dows
    from unnest(string_to_array(p_workdays, ',')) as d
   where d ~ '^[1-7]$';
  if dows is null then
    raise exception 'no workdays' using errcode = '22023';
  end if;
  return format('%s %s * * %s', m, h - 5, dows);
end;
$$;

-- Cron jadvallarini sozlamalardan qayta tuzish.
create or replace function public.bot_apply_schedule()
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  s jsonb;
  v_days text;
  v_rem text[];
  i int;
  v_url constant text := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=%s';
  v_cmd constant text := $c$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)
  $c$;
begin
  select jsonb_object_agg(key, value) into s from public.bot_settings;
  v_days := s->>'workdays';

  perform cron.unschedule(jobname) from cron.job
   where jobname in ('staff-bot-morning', 'staff-bot-report-ask', 'staff-bot-report-summary')
      or jobname like 'staff-bot-report-remind%';

  if coalesce(s->>'morning_enabled', 'true') = 'true' then
    perform cron.schedule('staff-bot-morning', public.bot_cron_expr(s->>'morning_time', v_days),
      format(v_cmd, format(v_url, 'morning')));
  end if;

  if coalesce(s->>'report_enabled', 'true') = 'true' then
    perform cron.schedule('staff-bot-report-ask', public.bot_cron_expr(s->>'report_time', v_days),
      format(v_cmd, format(v_url, 'report&kind=ask')));
    v_rem := array_remove(string_to_array(replace(coalesce(s->>'reminder_times', ''), ' ', ''), ','), '');
    for i in 1 .. coalesce(array_length(v_rem, 1), 0) loop
      perform cron.schedule('staff-bot-report-remind' || i, public.bot_cron_expr(v_rem[i], v_days),
        format(v_cmd, format(v_url, 'report&kind=remind')));
    end loop;
    perform cron.schedule('staff-bot-report-summary', public.bot_cron_expr(s->>'digest_time', v_days),
      format(v_cmd, format(v_url, 'report&kind=summary')));
  end if;
end;
$$;

-- CRM uchun: sozlamalar va xodimlar ro'yxati (faqat owner).
create or replace function public.bot_settings_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role((select auth.uid()), 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'settings', (select jsonb_object_agg(key, value) from public.bot_settings),
    'staff', (
      select coalesce(jsonb_agg(x order by x->>'full_name'), '[]'::jsonb) from (
        select jsonb_build_object(
          'user_id', s.user_id,
          'full_name', coalesce(nullif(trim(p.full_name), ''), '—'),
          'is_owner', public.has_role(s.user_id, 'owner'::public.app_role),
          'is_linked', exists (select 1 from public.staff_telegram_links l
                                where l.user_id = s.user_id and l.is_active)) as x
        from (select distinct ur.user_id from public.user_roles ur
               where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')) s
        left join public.profiles p on p.user_id = s.user_id
      ) q));
end;
$$;

-- Saqlash (faqat owner). Faqat ruxsat etilgan kalitlar; noto'g'ri qiymat — xato, hech narsa o'zgarmaydi.
create or replace function public.bot_settings_save(p_values jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text; v text; t text;
  v_uid uuid := (select auth.uid());
begin
  if not public.has_role(v_uid, 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;

  for k, v in select key, value #>> '{}' from jsonb_each(p_values) loop
    v := trim(coalesce(v, ''));
    case k
      when 'report_time', 'digest_time', 'morning_time' then
        perform public.bot_cron_expr(v, '1');
      when 'reminder_times' then
        foreach t in array array_remove(string_to_array(replace(v, ' ', ''), ','), '') loop
          perform public.bot_cron_expr(t, '1');
        end loop;
        if coalesce(array_length(array_remove(string_to_array(replace(v, ' ', ''), ','), ''), 1), 0) > 3 then
          raise exception 'at most 3 reminders' using errcode = '22023';
        end if;
        v := replace(v, ' ', '');
      when 'workdays' then
        perform public.bot_cron_expr('09:00', v);
      when 'morning_enabled', 'report_enabled' then
        if v not in ('true', 'false') then
          raise exception 'bad boolean for %', k using errcode = '22023';
        end if;
      when 'digest_user_ids' then
        if v <> '' and exists (
          select 1 from unnest(string_to_array(v, ',')) u
           where u !~ '^[0-9a-f-]{36}$' or not public.is_staff_user(u::uuid)) then
          raise exception 'bad digest user' using errcode = '22023';
        end if;
      else
        raise exception 'unknown setting %', k using errcode = '22023';
    end case;
    update public.bot_settings set value = v, updated_at = now(), updated_by = v_uid where key = k;
  end loop;

  perform public.bot_apply_schedule();
end;
$$;

-- Xulosa oluvchilar: digest_user_ids tanlangan bo'lsa — ular, aks holda ulangan ownerlar.
create or replace function public.bot_owner_chats()
returns table (user_id uuid, dm_chat_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select nullif(value, '') as v from public.bot_settings where key = 'digest_user_ids'
  )
  select l.user_id, l.dm_chat_id
  from public.staff_telegram_links l, ids
  where l.is_active and l.dm_chat_id is not null
    and case when ids.v is null then public.has_role(l.user_id, 'owner'::public.app_role)
             else l.user_id::text = any (string_to_array(ids.v, ',')) end;
$$;

revoke all on function public.bot_cron_expr(text, text) from public, anon, authenticated;
revoke all on function public.bot_apply_schedule() from public, anon, authenticated;
revoke all on function public.bot_settings_overview() from public, anon;
revoke all on function public.bot_settings_save(jsonb) from public, anon;
grant execute on function public.bot_settings_overview() to authenticated;
grant execute on function public.bot_settings_save(jsonb) to authenticated;

-- Hozirgi sozlamalar bilan bir xil jadval (17:00 / 17:30,18:00 / 18:15 / 09:00, Du–Sha).
select public.bot_apply_schedule();
