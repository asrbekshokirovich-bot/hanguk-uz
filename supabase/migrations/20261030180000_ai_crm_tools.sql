-- Hanguk AI covers the whole CRM, not only students (Asrbek, 2026-10-27:
-- "saytdagi barcha narsa bo'yicha o'tishing kerak"). It could not answer
-- "how many leads came today / from the site", "how many leads did Madina call
-- today", or find a lead by name. Each tool below counts exactly like the CRM
-- page it mirrors (rules copied from src/components/crm/leads/intake/*.ts etc.).
--
-- All are read-only, SECURITY DEFINER, staff-only (ai_is_staff), and never
-- return lead passwords, login history or link codes.
--
--   ai_leads_overview(day, intake)   Yangi lid / Bugungi lidlar / Lidlar
--   ai_search_leads(query)           find a lead by name, phone or handle
--   ai_lead_card(lead)               one lead: fields, notes, calls
--   ai_staff_activity(name, from,to) what each staff member did
--   ai_calls_summary(from, to)       Telefon
--   ai_messages_queue()              Xabarlar
--   ai_university_selection(intake)  Universitet tanlash
--   ai_application_fees(intake)      Application fee
--   ai_learning_centers()            O'quv markazlar
--   ai_surveys()                     So'rovnomalar
--   ai_finance_summary(intake)       Moliya (owner / finance_access only)

create or replace function public.ai_tk_day(p timestamptz)
returns date language sql immutable set search_path = pg_catalog
as $$ select (p at time zone 'Asia/Tashkent')::date $$;

create or replace function public.ai_default_intake()
returns uuid language sql stable security definer set search_path = public
as $$ select id from intakes where is_default order by year desc limit 1 $$;

create or replace function public.ai_staff_name(p uuid)
returns text language sql stable security definer set search_path = public
as $$ select nullif(btrim(full_name), '') from profiles where user_id = p $$;

revoke all on function public.ai_default_intake() from public, anon, authenticated;
revoke all on function public.ai_staff_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- leads ----
create or replace function public.ai_leads_overview(p_day date default null, p_intake_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_day date := coalesce(p_day, public.ai_tk_day(now()));
  v_intake uuid := coalesce(p_intake_id, public.ai_default_intake());
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;

  with l as (
    select x.*,
           (x.new_lead_at is not null and x.call_result is null and x.last_contacted_at is null
            and coalesce(x.status, '') not in ('converted', 'lost') and x.converted_to_student_id is null) as is_new,
           coalesce(public.ai_tk_day(coalesce(x.new_lead_at, x.replied_chat_at, x.created_at)) = v_day, false)
            or coalesce(public.ai_tk_day(x.sla_start_at) = v_day, false) as arrived,
           case when x.status = 'converted' or x.converted_to_student_id is not null then 'mijozga aylandi'
                when x.status = 'lost' then 'rad etildi' else 'faol' end as outcome
      from leads x
     where x.qualified and x.intake_id = v_intake
  ), new_l as (select * from l where is_new),
     today_l as (select * from l where arrived and not is_new),
     pipe as (select * from l where not arrived)
  select jsonb_build_object(
    'season', (select initcap(season) || ' ' || year from intakes where id = v_intake),
    'day', v_day,
    'yangi_lid', jsonb_build_object(
      'count', (select count(*) from new_l),
      'note', 'Yangi lid: hali hech kim javob bermagan lidlar (sanaga bog''liq emas, javob berilguncha shu yerda turadi).',
      'by_channel', coalesce((select jsonb_object_agg(k, n) from (select coalesce(contact_channel, source, '—') k, count(*) n from new_l group by 1) z), '{}'::jsonb),
      'oldest', coalesce((select jsonb_agg(r) from (
          select jsonb_build_object('name', full_name, 'phone', phone, 'channel', coalesce(contact_channel, source),
                   'waiting_minutes', round(extract(epoch from (now() - coalesce(sla_start_at, new_lead_at))) / 60),
                   'assignee', public.ai_staff_name(assigned_to)) r
            from new_l order by new_lead_at asc limit 15) z), '[]'::jsonb)),
    'bugungi_lidlar', jsonb_build_object(
      'count', (select count(*) from today_l),
      'note', 'Bugungi lidlar: shu kuni kelgan (yoki ish vaqtidan tashqari kelib, shu kuni navbatga tushgan) va kimdir javob bergan lidlar.',
      'by_outcome', coalesce((select jsonb_object_agg(outcome, n) from (select outcome, count(*) n from today_l group by 1) z), '{}'::jsonb),
      'by_channel', coalesce((select jsonb_object_agg(k, n) from (select coalesce(contact_channel, source, '—') k, count(*) n from today_l group by 1) z), '{}'::jsonb),
      'by_call_result', coalesce((select jsonb_object_agg(k, n) from (select coalesce(call_result, 'bog''lanilmagan') k, count(*) n from today_l group by 1) z), '{}'::jsonb),
      'list', coalesce((select jsonb_agg(r) from (
          select jsonb_build_object('name', full_name, 'phone', phone, 'channel', coalesce(contact_channel, source),
                   'call_result', call_result, 'outcome', outcome, 'next_follow_up', next_follow_up,
                   'assignee', public.ai_staff_name(assigned_to)) r
            from today_l order by coalesce(new_lead_at, replied_chat_at, created_at) desc limit 40) z), '[]'::jsonb)),
    'arrived_on_day_total', (select count(*) from l where arrived),
    'lidlar_pipeline', jsonb_build_object(
      'count', (select count(*) from pipe),
      'by_outcome', coalesce((select jsonb_object_agg(outcome, n) from (select outcome, count(*) n from pipe group by 1) z), '{}'::jsonb),
      'by_call_result', coalesce((select jsonb_object_agg(k, n) from (select coalesce(call_result, 'bog''lanilmagan') k, count(*) n from pipe group by 1) z), '{}'::jsonb)),
    'all_season_by_source', coalesce((select jsonb_object_agg(k, n) from (select coalesce(source, '—') k, count(*) n from l group by 1) z), '{}'::jsonb),
    'source_meaning', 'contact_channel "Sayt formasi" = saytdagi forma; source "Public Registration" = saytda ro''yxatdan o''tish; "app"/"Ilova" = talabalar ilovasi.'
  ) into v;
  return v;
end;
$$;

create or replace function public.ai_search_leads(p_query text, p_limit integer default 8)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  with q as (
    select public.hanguk_fold_name(p_query) fq, regexp_replace(coalesce(p_query, ''), '\D', '', 'g') dg
  ), qt as (select t from q, regexp_split_to_table(q.fq, '[^[:alnum:]]+') t where length(t) >= 3),
  c as (
    select l.*, public.hanguk_fold_name(l.full_name) fn,
           regexp_split_to_array(public.hanguk_fold_name(coalesce(l.full_name, '') || ' ' || coalesce(l.telegram_handle, '') || ' ' || coalesce(l.instagram_handle, '')), '[^[:alnum:]]+') words
      from leads l
  ), s as (
    select c.*, greatest(
             word_similarity(q.fq, c.fn),
             coalesce((select avg((select max(similarity(qt.t, w)) from unnest(c.words) w)) from qt), 0),
             case when length(q.dg) >= 7 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.dg || '%' then 1 else 0 end) score,
           (exists (select 1 from qt) and not exists (select 1 from qt where not exists (
              select 1 from unnest(c.words) w where w like qt.t || '%' or similarity(qt.t, w) >= 0.45))) all_words,
           (length(q.dg) >= 7 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.dg || '%') by_phone,
           (c.fn like '%' || q.fq || '%') whole
      from c, q
  )
  select coalesce(jsonb_agg(r order by sc desc), '[]'::jsonb) into v from (
    select jsonb_build_object('lead_id', id, 'name', full_name, 'phone', phone, 'status', status,
             'source', source, 'channel', contact_channel, 'call_result', call_result,
             'created_at', public.ai_tk_day(created_at), 'shown_in_crm', qualified,
             'season', (select initcap(season) || ' ' || year from intakes where id = s.intake_id),
             'assignee', public.ai_staff_name(assigned_to)) r, score sc
      from s where all_words or by_phone or whole
     order by score desc, created_at desc
     limit greatest(least(coalesce(p_limit, 8), 30), 1)) z;
  return v;
end;
$$;

create or replace function public.ai_lead_card(p_lead_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  select jsonb_build_object(
    'lead', jsonb_build_object(
      'name', l.full_name, 'phone', l.phone, 'email', l.email, 'city', l.city, 'age', l.age,
      'status', l.status, 'call_result', l.call_result, 'source', l.source, 'channel', l.contact_channel,
      'how_heard', l.how_heard, 'source_note', l.source_note, 'education_level', l.education_level,
      'korean_level', l.korean_level, 'english_level', l.english_level, 'cert_level', l.cert_level,
      'target_intake', l.target_intake, 'preferred_university', l.preferred_university,
      'preferred_program', l.preferred_program, 'tariff_interest', l.tariff_interest,
      'interest_level', l.interest_level, 'priority_score', l.priority_score,
      'next_follow_up', l.next_follow_up, 'last_contacted_at', l.last_contacted_at,
      'created_at', l.created_at, 'new_lead_at', l.new_lead_at, 'notes', left(l.notes, 600),
      'ai_summary', left(l.ai_summary, 600), 'telegram', l.telegram_handle, 'instagram', l.instagram_handle,
      'assignee', public.ai_staff_name(l.assigned_to), 'created_by', public.ai_staff_name(l.created_by),
      'converted_to_student', l.converted_to_student_id is not null,
      'season', (select initcap(season) || ' ' || year from intakes where id = l.intake_id),
      'learning_center', (select name from learning_centers where id = l.learning_center_id)),
    'notes', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('date', coalesce(n.contacted_at, public.ai_tk_day(n.created_at)), 'type', n.contact_type,
                 'outcome', n.outcome, 'text', left(n.content, 300), 'by', public.ai_staff_name(n.created_by)) r
          from lead_notes n where n.lead_id = l.id order by n.created_at desc limit 8) z), '[]'::jsonb),
    'calls', jsonb_build_object(
      'count', (select count(*) from calls c where c.lead_id = l.id),
      'last', (select jsonb_build_object('at', c.started_at, 'status', c.status, 'by', public.ai_staff_name(c.staff_id))
                 from calls c where c.lead_id = l.id order by c.started_at desc nulls last limit 1))
  ) into v
  from leads l where l.id = p_lead_id;
  return coalesce(v, jsonb_build_object('error', 'lead not found'));
end;
$$;

-- ---------------------------------------------------------------- staff ----
create or replace function public.ai_staff_activity(p_staff text default null, p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_from date := coalesce(p_from, public.ai_tk_day(now()));
  v_to date := coalesce(p_to, coalesce(p_from, public.ai_tk_day(now())));
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  with st as (
    select distinct ur.user_id, p.full_name,
           (select string_agg(r.role::text, ', ') from user_roles r where r.user_id = ur.user_id) roles
      from user_roles ur join profiles p on p.user_id = ur.user_id
     where ur.role::text <> 'investor'
       and (p_staff is null or public.hanguk_fold_name(p.full_name) like '%' || public.hanguk_fold_name(p_staff) || '%')
  ), n as (
    select * from lead_notes where public.ai_tk_day(created_at) between v_from and v_to
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to,
    'note', 'Lid bilan gaplashish = lid izohi (lead_notes) yozilgani: qo''ng''iroq, telegram, whatsapp, uchrashuv. call_result kim tomonidan qo''yilgani saqlanmaydi.',
    'staff', coalesce(jsonb_agg(jsonb_build_object(
      'name', st.full_name, 'roles', st.roles,
      'lead_contacts', jsonb_build_object(
        'notes', (select count(*) from n where n.created_by = st.user_id),
        'distinct_leads', (select count(distinct lead_id) from n where n.created_by = st.user_id),
        'by_type', coalesce((select jsonb_object_agg(k, c) from (select coalesce(contact_type, '—') k, count(*) c from n where n.created_by = st.user_id group by 1) z), '{}'::jsonb),
        'by_outcome', coalesce((select jsonb_object_agg(k, c) from (select coalesce(outcome, '—') k, count(*) c from n where n.created_by = st.user_id group by 1) z), '{}'::jsonb),
        'leads', coalesce((select jsonb_agg(distinct l.full_name) from n join leads l on l.id = n.lead_id where n.created_by = st.user_id), '[]'::jsonb)),
      'phone_calls', (select jsonb_build_object('count', count(*), 'completed', count(*) filter (where status = 'completed'),
                        'minutes', round(coalesce(sum(duration), 0) / 60.0))
                        from calls where staff_id = st.user_id and public.ai_tk_day(coalesce(started_at, created_at)) between v_from and v_to),
      'messages_replied', (select count(*) from messages where replied_by = st.user_id and public.ai_tk_day(replied_at) between v_from and v_to),
      'open_chats_assigned', (select count(*) from message_threads where assigned_to = st.user_id and status <> 'archived'),
      'leads_created', (select count(*) from leads where created_by = st.user_id and public.ai_tk_day(created_at) between v_from and v_to),
      'tasks_completed', (select count(*) from tasks where assigned_to = st.user_id and status = 'completed' and public.ai_tk_day(completed_at) between v_from and v_to),
      'tasks_open', (select count(*) from tasks where assigned_to = st.user_id and status not in ('completed', 'cancelled')),
      'documents_reviewed', (select count(*) from documents where reviewed_by = st.user_id and public.ai_tk_day(reviewed_at) between v_from and v_to),
      'online_submitted', (select count(*) from student_university_submissions where online_submitted_by = st.user_id and public.ai_tk_day(online_submitted_at) between v_from and v_to),
      'offline_sent', (select count(*) from student_university_submissions where offline_sent_by = st.user_id and public.ai_tk_day(offline_sent_at) between v_from and v_to)
    ) order by st.full_name), '[]'::jsonb)
  ) into v
  from st;
  return v;
end;
$$;

create or replace function public.ai_calls_summary(p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_from date := coalesce(p_from, public.ai_tk_day(now()) - 6);
  v_to date := coalesce(p_to, public.ai_tk_day(now()));
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  with c as (select * from calls where public.ai_tk_day(coalesce(started_at, created_at)) between v_from and v_to)
  select jsonb_build_object(
    'from', v_from, 'to', v_to,
    'note', 'Telefon bo''limi: calls jadvali. Operatorlarning lid bilan qo''ng''iroqlari asosan lid izohlarida — ai_staff_activity.',
    'total', (select count(*) from c),
    'by_direction', coalesce((select jsonb_object_agg(coalesce(direction, '—'), n) from (select direction, count(*) n from c group by 1) z), '{}'::jsonb),
    'by_status', coalesce((select jsonb_object_agg(coalesce(status, '—'), n) from (select status, count(*) n from c group by 1) z), '{}'::jsonb),
    'missed', (select count(*) from c where status in ('missed', 'no_answer')),
    'avg_minutes', (select round(avg(duration) / 60.0, 1) from c where duration > 0),
    'by_staff', coalesce((select jsonb_object_agg(coalesce(public.ai_staff_name(staff_id), '—'), n) from (select staff_id, count(*) n from c group by 1) z), '{}'::jsonb),
    'recent', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('at', c.started_at, 'phone', c.phone_number, 'direction', c.direction, 'status', c.status,
                 'minutes', round(coalesce(c.duration, 0) / 60.0, 1), 'by', public.ai_staff_name(c.staff_id),
                 'lead', (select full_name from leads where id = c.lead_id),
                 'student', (select full_name from profiles where user_id = c.student_id)) r
          from c order by c.started_at desc nulls last limit 15) z), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.ai_messages_queue()
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  with t as (
    select th.*, lm.direction last_direction, lm.created_at last_at
      from message_threads th
      left join lateral (select m.direction, m.created_at from messages m
                          where m.source = th.source and m.sender_id = th.sender_id
                          order by m.created_at desc, m.id desc limit 1) lm on true
     where th.status <> 'archived'
  ), w as (select * from t where last_direction = 'incoming' and last_at <= now() - interval '10 minutes')
  select jsonb_build_object(
    'note', 'Xabarlar bo''limi: ochiq suhbatlar (arxivlanmagan). Javob kutayotgan = oxirgi xabar mijozdan va 10 daqiqadan ko''p kutyapti.',
    'open_chats', (select count(*) from t),
    'unassigned', (select count(*) from t where assigned_to is null),
    'unread_chats', (select count(*) from t where unread_count > 0),
    'by_source', coalesce((select jsonb_object_agg(coalesce(source, '—'), n) from (select source, count(*) n from t group by 1) z), '{}'::jsonb),
    'by_assignee', coalesce((select jsonb_object_agg(coalesce(public.ai_staff_name(assigned_to), 'biriktirilmagan'), n) from (select assigned_to, count(*) n from t group by 1) z), '{}'::jsonb),
    'waiting_for_reply', (select count(*) from w),
    'longest_waiting', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('name', sender_name, 'source', source,
                 'waiting_minutes', round(extract(epoch from (now() - last_at)) / 60),
                 'assignee', public.ai_staff_name(assigned_to)) r
          from w order by last_at asc limit 15) z), '[]'::jsonb),
    'today', jsonb_build_object(
      'incoming', (select count(*) from messages where direction = 'incoming' and public.ai_tk_day(created_at) = public.ai_tk_day(now())),
      'outgoing', (select count(*) from messages where direction = 'outgoing' and public.ai_tk_day(created_at) = public.ai_tk_day(now())))
  ) into v;
  return v;
end;
$$;

-- --------------------------------------------------------- other pages ----
create or replace function public.ai_university_selection(p_intake_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_intake uuid := coalesce(p_intake_id, public.ai_default_intake());
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  with m as (
    select si.student_id from student_intakes si join profiles p on p.user_id = si.student_id
     where si.intake_id = v_intake and si.contract_cancelled_at is null and not p.is_demo
  ), ch as (
    select c.*, p.full_name, coalesce(i.name_en, i.name_ko) uni
      from student_university_choices c join m on m.student_id = c.student_id
      join profiles p on p.user_id = c.student_id left join institutions i on i.id = c.institution_id
  )
  select jsonb_build_object(
    'season', (select initcap(season) || ' ' || year from intakes where id = v_intake),
    'note', 'Universitet tanlash: offered = taklif qilingan, accepted = talaba rozi, change_requested = o''zgartirish so''ragan, confirmed = tasdiqlangan.',
    'students_with_choices', (select count(distinct student_id) from ch),
    'students_without_choices', (select count(*) from m where not exists (select 1 from ch where ch.student_id = m.student_id)),
    'by_status', coalesce((select jsonb_object_agg(coalesce(status, '—'), n) from (select status, count(*) n from ch group by 1) z), '{}'::jsonb),
    'by_university', coalesce((select jsonb_object_agg(uni, n) from (select uni, count(*) n from ch where status = 'confirmed' group by 1) z), '{}'::jsonb),
    'change_requested', coalesce((select jsonb_agg(jsonb_build_object('student', full_name, 'university', uni, 'reason', change_reason)) from ch where status = 'change_requested'), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.ai_application_fees(p_intake_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_intake uuid := coalesce(p_intake_id, public.ai_default_intake());
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  if not public.has_application_fee_access(auth.uid()) then raise exception 'not authorized: application fee access only'; end if;
  with f as (select a.*, coalesce(i.name_en, i.name_ko) uni, p.full_name
               from application_fee_payments a left join institutions i on i.id = a.institution_id
               left join profiles p on p.user_id = a.student_id where a.intake_id = v_intake)
  select jsonb_build_object(
    'season', (select initcap(season) || ' ' || year from intakes where id = v_intake),
    'payments', (select count(*) from f),
    'students_paid', (select count(distinct student_id) from f),
    'total_krw', (select coalesce(sum(amount_krw), 0) from f),
    'expense_krw', (select coalesce(sum(expense_krw), 0) from f),
    'by_university', coalesce((select jsonb_object_agg(coalesce(uni, '—'), n) from (select uni, count(*) n from f group by 1) z), '{}'::jsonb),
    'list', coalesce((select jsonb_agg(jsonb_build_object('student', full_name, 'university', uni, 'krw', amount_krw, 'date', public.ai_tk_day(created_at)) order by created_at desc) from f), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.ai_learning_centers()
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'center', c.name, 'city', c.city, 'contact', c.contact_person, 'active', c.is_active,
           'assignee', public.ai_staff_name(c.assigned_to),
           'students', (select count(*) from learning_center_students s where s.center_id = c.id),
           'leads', (select count(*) from leads l where l.learning_center_id = c.id),
           'converted', (select count(*) from leads l where l.learning_center_id = c.id and (l.status = 'converted' or l.converted_to_student_id is not null)))
         order by c.name), '[]'::jsonb) into v
    from learning_centers c;
  return v;
end;
$$;

create or replace function public.ai_surveys()
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', s.title, 'active', s.is_active, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
           'questions', (select count(*) from survey_questions q where q.survey_id = s.id),
           'respondents', (select count(distinct r.user_id) from survey_responses r where r.survey_id = s.id),
           'created_by', public.ai_staff_name(s.created_by))
         order by s.created_at desc), '[]'::jsonb) into v
    from surveys s;
  return v;
end;
$$;

create or replace function public.ai_finance_summary(p_intake_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_intake uuid := coalesce(p_intake_id, public.ai_default_intake());
  v_month date := date_trunc('month', public.ai_tk_day(now()))::date;
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  if not (public.has_role(auth.uid(), 'owner'::public.app_role)
          or exists (select 1 from finance_access fa where fa.user_id = auth.uid())) then
    raise exception 'not authorized: finance is for owners and finance_access only';
  end if;
  with p as (select pm.* from payments pm join profiles pr on pr.user_id = pm.student_id
              where pm.intake_id = v_intake and pm.status <> 'refunded' and not pr.is_demo)
  select jsonb_build_object(
    'season', (select initcap(season) || ' ' || year from intakes where id = v_intake),
    'note', 'Har valyuta alohida. Qarz = amount - paid_amount.',
    'payments_by_currency', coalesce((select jsonb_object_agg(currency, jsonb_build_object(
        'total', total, 'paid', paid, 'outstanding', total - paid, 'students', students))
        from (select coalesce(currency, 'UZS') currency, sum(amount) total, sum(coalesce(paid_amount, 0)) paid,
                     count(distinct student_id) students from p group by 1) z), '{}'::jsonb),
    'by_status', coalesce((select jsonb_object_agg(coalesce(status, '—'), n) from (select status, count(*) n from p group by 1) z), '{}'::jsonb),
    'expenses_this_month', coalesce((select jsonb_object_agg(currency, s) from (
        select coalesce(currency, 'UZS') currency, sum(amount) s from expenses where expense_date >= v_month group by 1) z), '{}'::jsonb),
    'expenses_by_category_this_month', coalesce((select jsonb_object_agg(k, s) from (
        select coalesce(category, '—') || ' (' || coalesce(currency, 'UZS') || ')' k, sum(amount) s
          from expenses where expense_date >= v_month group by 1) z), '{}'::jsonb),
    'staff_bonuses', coalesce((select jsonb_object_agg(coalesce(status, '—'), jsonb_build_object('count', n, 'sum', s)) from (
        select status, count(*) n, sum(bonus_amount) s from staff_bonuses group by 1) z), '{}'::jsonb)
  ) into v;
  return v;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'ai_leads_overview(date, uuid)', 'ai_search_leads(text, integer)', 'ai_lead_card(uuid)',
    'ai_staff_activity(text, date, date)', 'ai_calls_summary(date, date)', 'ai_messages_queue()',
    'ai_university_selection(uuid)', 'ai_application_fees(uuid)', 'ai_learning_centers()',
    'ai_surveys()', 'ai_finance_summary(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
