-- Talabaga onlayn ariza muddati eslatmasi (2026-11-03, Asrbek: "7, 3 va 1 kun
-- oldin"). Har kuni 09:00 (Toshkent) student_deadline_reminders() o'zi
-- tanlagan universitetlarning joriy mavsum "Online hujjat topshirish"
-- tugash sanasiga 7, 3 yoki 1 kun qolgan bo'lsa outbox'ga yozadi;
-- notify-student-stages (har daqiqa) telefon tilida push qilib yuboradi.
--
--   - faqat joriy qabulda kontrakti faol talabalar (student_intakes)
--   - faqat onlayn arizasi hali topshirilmagan universitetlar
--   - daraja arizadagi degree_level bo'yicha (bachelor → bakalavr, ...),
--     noma'lum bo'lsa har qanday daraja
--   - ref_date = muddat sanasi: keyingi mavsumda o'sha universitet uchun
--     eslatma yana kelishi uchun noyoblik kalitiga qo'shildi

alter table public.student_stage_notifications add column if not exists ref_date date;

alter table public.student_stage_notifications
  drop constraint if exists student_stage_notifications_kind_check;
alter table public.student_stage_notifications
  add constraint student_stage_notifications_kind_check check (kind in (
    'documents_ready', 'university_offered', 'university_confirmed',
    'online_submitted', 'offline_sent', 'admission_accepted', 'final_university',
    'offer_reminder', 'deadline_7', 'deadline_3', 'deadline_1'));

drop index if exists public.student_stage_notifications_once;
create unique index if not exists student_stage_notifications_once
  on public.student_stage_notifications
  (student_id, kind, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(ref_date, date '1900-01-01'));

create or replace function public.student_deadline_reminders()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_n int;
begin
  with students as (
    select distinct si.student_id
      from student_intakes si
     where si.intake_id = ai_default_intake() and si.contract_cancelled_at is null
  ),
  picks as (
    select st.student_id, u.institution_id,
           case
             when u.program ilike 'bachelor%' then 'bakalavr'
             when u.program ilike 'master%' then 'magistratura'
             when u.program ilike 'vocational%' then 'kasbiy'
             else null
           end as daraja
      from students st
      cross join lateral student_universities_of(st.student_id) u
     where u.institution_id is not null
       and not exists (select 1 from student_university_submissions s
                        where s.student_id = st.student_id and s.institution_id = u.institution_id
                          and s.online_submitted_at is not null)
  ),
  due as (
    select distinct p.student_id, p.institution_id, r.tugash_sana, r.tugash_sana - v_today as days_left
      from picks p
      join university_guidelines g on g.institution_id = p.institution_id
      join university_guideline_rounds r on r.guideline_uuid = g.id
      cross join ai_uni_season() s
     where g.qabul_yili = s.qabul_yili and g.semestr = s.semestr
       and (p.daraja is null or g.daraja = p.daraja)
       and r.etap_nomi = 'Online hujjat topshirish'
       and coalesce(r.holat, '') <> 'etap_yoq'
       and r.tugash_sana - v_today in (7, 3, 1)
  )
  insert into student_stage_notifications (student_id, kind, institution_id, ref_date)
  select d.student_id, 'deadline_' || d.days_left, d.institution_id, d.tugash_sana from due d
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.student_deadline_reminders() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('student-deadline-reminders')
    where exists (select 1 from cron.job where jobname = 'student-deadline-reminders');
end $$;
-- 04:00 UTC = 09:00 Toshkent.
select cron.schedule('student-deadline-reminders', '0 4 * * *', 'select public.student_deadline_reminders()');
