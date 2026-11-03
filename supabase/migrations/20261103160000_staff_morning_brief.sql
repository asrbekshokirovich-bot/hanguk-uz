-- Kunlik brifing har xodimga 09:00 (2026-11-03, Asrbek: "Har xodimga 09:00").
-- Xodim botining ertalabki xabari endi Telegram'ni ulagan HAR bir xodimga
-- boradi (oldin faqat vazifasi borlarga) va boshida qisqa brifing turadi:
--   - yangi lidlar (oxirgi 24 soat): jami va o'ziga biriktirilganlari
--   - muddati o'tgan vazifalari (o'ziniki)
--   - 7 kun ichidagi onlayn ariza muddatlari (faol talabalar, onlayn hali
--     topshirilmagan universitetlar bo'yicha; universitet, sana, talaba soni)
--   - tekshiruvni kutayotgan hujjatlar (documents.status = 'uploaded')
-- Raqamlar shu RPC'dan, AI emas: o'ylab topilgan son bo'lmaydi.

create or replace function public.bot_brief_targets()
returns table (user_id uuid, full_name text, dm_chat_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id, coalesce(p.full_name, ''), l.dm_chat_id
    from public.staff_telegram_links l
    left join public.profiles p on p.user_id = l.user_id
   where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id);
$$;

create or replace function public.bot_morning_brief(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_d0 timestamptz := (v_today::timestamp at time zone 'Asia/Tashkent');
  v jsonb;
begin
  with students as (
    select distinct si.student_id
      from student_intakes si
      join profiles p on p.user_id = si.student_id
     where si.intake_id = ai_default_intake() and si.contract_cancelled_at is null
       and not coalesce(p.is_demo, false)
  ),
  picks as (
    select st.student_id, u.institution_id,
           case
             when u.program ilike 'bachelor%' then 'bakalavr'
             when u.program ilike 'master%' then 'magistratura'
             when u.program ilike 'vocational%' then 'kasbiy'
           end as daraja
      from students st
      cross join lateral student_universities_of(st.student_id) u
     where u.institution_id is not null
       and not exists (select 1 from student_university_submissions s
                        where s.student_id = st.student_id and s.institution_id = u.institution_id
                          and s.online_submitted_at is not null)
  ),
  due as (
    select coalesce(i.name_en, i.name_ko) as university, r.tugash_sana as date,
           count(distinct p.student_id) as students
      from picks p
      join institutions i on i.id = p.institution_id
      join university_guidelines g on g.institution_id = p.institution_id
      join university_guideline_rounds r on r.guideline_uuid = g.id
      cross join ai_uni_season() s
     where g.qabul_yili = s.qabul_yili and g.semestr = s.semestr
       and (p.daraja is null or g.daraja = p.daraja)
       and r.etap_nomi = 'Online hujjat topshirish'
       and coalesce(r.holat, '') <> 'etap_yoq'
       and r.tugash_sana between v_today and v_today + 7
     group by 1, 2
  )
  select jsonb_build_object(
    'new_leads', (select count(*) from leads l where l.created_at >= now() - interval '24 hours'),
    'my_new_leads', (select count(*) from leads l where l.created_at >= now() - interval '24 hours'
                                                   and l.assigned_to = p_user),
    'my_overdue_tasks', (select count(*) from tasks t where t.assigned_to = p_user
                                                     and t.status in ('todo', 'in_progress')
                                                     and t.due_date < v_d0),
    'docs_waiting', (select count(*) from documents d where d.status = 'uploaded'),
    'deadlines', coalesce((select jsonb_agg(jsonb_build_object('university', university, 'date', date,
                                                             'days_left', date - v_today, 'students', students)
                                            order by date, university)
                             from (select * from due order by date, university limit 8) x), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.bot_brief_targets() from public, anon, authenticated;
revoke all on function public.bot_morning_brief(uuid) from public, anon, authenticated;
grant execute on function public.bot_brief_targets() to service_role;
grant execute on function public.bot_morning_brief(uuid) to service_role;
