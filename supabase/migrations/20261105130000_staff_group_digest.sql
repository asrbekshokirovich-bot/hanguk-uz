-- Xodim boti: har ish kuni ertalab (morning_time, standart 09:00) «Staff» guruhiga jamoa xulosasi.
-- (2026-11-05, Asrbek: "make the bot to give digest to the staff group everyday at 9 am")
--
-- Xulosada (hammasi bazadan, AI emas):
--   - vazifalar: ochiq / kechikkan / bugungi soni, oxirgi ish kunidan beri bajarilganlar;
--   - har xodimning kechikkan va bugungi vazifalari;
--   - bot_morning_brief'dagi umumiy qism: yangi lidlar, kutayotgan hujjatlar, 7 kunlik ariza muddatlari;
--   - oxirgi ish kunidagi kunlik hisobot: nechta xodim topshirdi (ism ko'rsatilmaydi).
-- Yoqish/o'chirish: bot_settings.group_digest_enabled (CRM → Sozlamalar → Bot). Vaqt va kunlar —
-- ertalabki ro'yxat bilan bir xil (morning_time, workdays), bitta cron (staff-bot-morning).

insert into public.bot_settings (key, value) values ('group_digest_enabled', 'true')
on conflict (key) do nothing;

create or replace function public.bot_group_digest()
returns jsonb
language sql
stable
security definer
set search_path = public
set statement_timeout = '10s'
as $$
  with b as (
    select (now() at time zone 'Asia/Tashkent')::date as today
  ), b2 as (
    -- oxirgi ish kuni (bot_settings.workdays bo'yicha), topilmasa — kecha
    select b.today,
           coalesce((select max(g.d)::date
                       from generate_series((b.today - 7)::timestamp, (b.today - 1)::timestamp, interval '1 day') g(d)
                      where extract(isodow from g.d)::int::text = any (string_to_array(
                              coalesce((select s.value from public.bot_settings s where s.key = 'workdays'), '1,2,3,4,5,6'), ','))),
                    b.today - 1) as prev
      from b
  ), b3 as (
    select today, prev,
           (today::timestamp at time zone 'Asia/Tashkent') as d0,
           (prev::timestamp at time zone 'Asia/Tashkent') as p0
      from b2
  ), open_t as (
    select t.assigned_to, t.title, t.status, t.priority, t.due_date, t.created_at,
           (t.due_date at time zone 'Asia/Tashkent')::date as due_day
      from public.tasks t
     where t.status in ('todo', 'in_progress')
       and t.assigned_to is not null
       and public.is_staff_user(t.assigned_to)
       and not public.fn_is_demo_user(t.assigned_to)
  ), hot as (
    -- kechikkan (muddati bugundan oldin) yoki bugungi
    select o.*, case when o.due_day < b3.today then 'overdue' else 'today' end as kind,
           b3.today - o.due_day as late_days
      from open_t o, b3
     where o.due_day is not null and o.due_day <= b3.today
  ), people as (
    select h.assigned_to,
           coalesce(nullif(trim(p.full_name), ''), '—') as name,
           count(*) filter (where h.kind = 'overdue') as n_overdue,
           count(*) filter (where h.kind = 'today') as n_today,
           jsonb_agg(jsonb_build_object(
               'title', h.title, 'due', h.due_date, 'kind', h.kind, 'late_days', h.late_days,
               'wip', h.status = 'in_progress', 'hi', h.priority in ('urgent', 'high'))
             order by h.due_date, h.created_at) as tasks
      from hot h
      left join public.profiles p on p.user_id = h.assigned_to
     group by h.assigned_to, p.full_name
  ), rep as (
    -- hisobot so'raladiganlar (bot_report_targets bilan bir xil): ulangan, owner emas, test emas
    select count(*) as expected,
           count(*) filter (where exists (select 1 from public.daily_reports d, b3
                                           where d.user_id = l.user_id and d.report_date = b3.prev)) as submitted
      from public.staff_telegram_links l
     where l.is_active and l.dm_chat_id is not null
       and public.is_staff_user(l.user_id)
       and not public.has_role(l.user_id, 'owner'::public.app_role)
       and not public.fn_is_demo_user(l.user_id)
  )
  select jsonb_build_object(
    'date', b3.today,
    'weekday', extract(isodow from b3.today)::int,
    'prev_date', b3.prev,
    'counts', jsonb_build_object(
      'open', (select count(*) from open_t),
      'overdue', (select count(*) from hot where kind = 'overdue'),
      'today', (select count(*) from hot where kind = 'today'),
      'done', (select count(*) from public.tasks t
                where t.status = 'completed' and t.completed_at >= b3.p0 and t.completed_at < b3.d0
                  and t.assigned_to is not null
                  and public.is_staff_user(t.assigned_to)
                  and not public.fn_is_demo_user(t.assigned_to))),
    'people', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'overdue', n_overdue, 'today', n_today, 'tasks', tasks)
                                order by n_overdue desc, n_today desc, name)
                          from people), '[]'::jsonb),
    'brief', (select x - 'my_new_leads' - 'my_overdue_tasks' from public.bot_morning_brief(null) x),
    'reports', case when coalesce((select s.value from public.bot_settings s where s.key = 'report_enabled'), 'true') = 'true'
                    then (select jsonb_build_object('submitted', submitted, 'expected', expected) from rep) end)
  from b3;
$$;

revoke all on function public.bot_group_digest() from public, anon, authenticated;
grant execute on function public.bot_group_digest() to service_role;

-- Sozlamani saqlash: group_digest_enabled qo'shildi (qolgani 20261102230000 bilan bir xil).
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
      when 'morning_enabled', 'report_enabled', 'group_digest_enabled' then
        if v not in ('true', 'false') then
          raise exception 'bad boolean for %', k using errcode = '22023';
        end if;
      when 'group_ai_mode' then
        if v not in ('off', 'shadow', 'on') then
          raise exception 'bad group_ai_mode' using errcode = '22023';
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

-- Ertalabki cron: DM ro'yxati YOKI guruh xulosasi yoqilgan bo'lsa ishlaydi
-- (qaysi biri yuborilishini staff-bot o'zi sozlamadan tekshiradi).
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

  if coalesce(s->>'morning_enabled', 'true') = 'true' or coalesce(s->>'group_digest_enabled', 'true') = 'true' then
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
