-- Hanguk AI: talaba "odam bilan gaplashmoqchiman" desa yoki AI javob topa
-- olmasa, so'rov operatorlar navbatiga tushadi (2026-11-03, Asrbek:
-- "Operatorlar navbati").
--
--   app_signal_rules 'ai_handoff'   HOZIR navbati, operatorlarga, 10 daqiqa
--   ai_request_handoff(question)    talabaning o'zi (auth.uid()) chaqiradi;
--                                   kuniga bitta ochiq so'rov (keyingisi
--                                   savolni qo'shib qo'yadi)
--   app_handoff_alerts(dry)         lead-sla-check: 10 daqiqada hech kim
--                                   yopmagan so'rovlar Telegram'ga (bir marta)
--
-- Vaqt fn_app_request_due bilan bir xil: ish kunlari 09:00–18:00
-- operatorlar, 18:00–22:00 rahbar, kechasi va yakshanba — keyingi ish kuni
-- 09:10. "Bugun ilovada" sahifasida qator ochiq turadi; ertasi kuni
-- tugaganda "expired" bo'ladi.

insert into public.app_signal_rules (key, name_uz, queue, target, minutes, enabled) values
  ('ai_handoff', 'Talaba Hanguk AI orqali xodim so''radi', 'now', 'operators', 10, true)
on conflict (key) do update
   set name_uz = excluded.name_uz, queue = excluded.queue, target = excluded.target, minutes = excluded.minutes;

create or replace function public.ai_request_handoff(p_question text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_q    text := nullif(left(btrim(coalesce(p_question, '')), 500), '');
  v_due  record;
  v_lead uuid;
  v_id   bigint;
begin
  if v_uid is null then
    raise exception 'not authorized: sign in first' using errcode = '42501';
  end if;
  if public.ai_is_staff(v_uid) then
    raise exception 'staff do not hand off to staff' using errcode = '42501';
  end if;

  select * into v_due from public.fn_app_request_due(now());
  select l.id into v_lead from public.leads l
   where l.converted_to_student_id = v_uid order by l.created_at desc limit 1;

  insert into public.app_signals (rule_key, lead_id, user_id, day, asked_at, due_at, target, detail)
  values ('ai_handoff', null, v_uid, v_due.day, now(), v_due.due_at, v_due.target,
          jsonb_build_object('via', 'ai', 'questions', jsonb_build_array(v_q), 'lead_id', v_lead))
  on conflict (user_id, rule_key, day) where lead_id is null
  do update set detail = jsonb_set(app_signals.detail, '{questions}',
                                   coalesce(app_signals.detail -> 'questions', '[]'::jsonb) || to_jsonb(v_q)),
                status = 'open', done_at = null
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_id,
    -- when an operator is alerted if nobody has answered by then
    'alert_at', v_due.due_at,
    'working_hours_now', v_due.due_at <= now() + interval '10 minutes');
end;
$$;

revoke all on function public.ai_request_handoff(text) from public, anon;
grant execute on function public.ai_request_handoff(text) to authenticated;

create or replace function public.app_handoff_alerts(p_dry boolean default false)
returns table (id bigint, user_id uuid, full_name text, phone text, questions jsonb,
               target text, asked_at timestamptz, minutes_waiting int)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if not p_dry then
    update public.app_signals s
       set status = 'expired', done_at = now()
     where s.rule_key = 'ai_handoff' and s.status = 'open' and s.day < v_today - 1;
  end if;

  return query
  with due as (
    select s.id as sid from public.app_signals s
     where s.status = 'open' and s.rule_key = 'ai_handoff' and s.alerted_at is null and s.due_at <= now()
  ),
  marked as (
    update public.app_signals s set alerted_at = now()
      from due d where d.sid = s.id and not p_dry
    returning s.id
  )
  select s.id, s.user_id, p.full_name, p.phone, coalesce(s.detail -> 'questions', '[]'::jsonb), s.target, s.asked_at,
         floor(extract(epoch from (now() - s.asked_at)) / 60)::int
    from due d
    join public.app_signals s on s.id = d.sid
    left join public.profiles p on p.user_id = s.user_id
   order by s.asked_at;
end;
$$;

revoke all on function public.app_handoff_alerts(boolean) from public, anon, authenticated;
grant execute on function public.app_handoff_alerts(boolean) to service_role;
