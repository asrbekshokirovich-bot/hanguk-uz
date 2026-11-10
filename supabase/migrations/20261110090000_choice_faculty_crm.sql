-- Talaba qaysi universitetning qaysi fakultetiga topshiradi — xodim CRM'da
-- kiritadi (Asrbek, 2026-11-10: "manga ko'rinadigan qilib berish kerak";
-- tanlov: xodim kiritadi, jadvalda ham talaba kartochkasida ham ko'rinadi).
--
-- Avval bazada fakultet umuman saqlanmasdi (student_university_choices'da
-- faqat universitet). Ochiq #547 (talaba ilovada tanlaydi) bilan to'qnashmaydi:
-- ustun nomlari boshqa.
--
-- 1. student_university_choices: faculty_name, faculty_college, faculty_set_at,
--    faculty_set_by. fn_guard_confirmed_choice faqat universitet va holatni
--    qo'riqlaydi — tasdiqlangan tanlovda ham fakultet yozish mumkin.
-- 2. choice_faculty_options(institution): universitet yo'riqnomasidagi
--    fakultetlar (ilovadagi universitet sahifasi bilan bir manba —
--    university_guideline_faculties), faol mavsum, bo'lmasa oxirgi yil.

alter table public.student_university_choices
  add column if not exists faculty_name    text,
  add column if not exists faculty_college text,
  add column if not exists faculty_set_at  timestamptz,
  add column if not exists faculty_set_by  uuid references auth.users (id) on delete set null;

comment on column public.student_university_choices.faculty_name is
  'Faculty/department the student applies to at this university, entered by staff in CRM.';

create or replace function public.choice_faculty_options(p_institution uuid)
returns table (college text, faculty text, faculty_kr text, degree text, track text, intake_year int, semester text)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with g as (
    select g.*,
           (g.qabul_yili, g.semestr) = (select s.qabul_yili, s.semestr from public.ai_uni_season() s) as active
      from public.university_guidelines g
     where g.institution_id = p_institution
  ),
  pick as (
    select * from g
     where active
        or (not exists (select 1 from g where active)
            and qabul_yili = (select max(qabul_yili) from g))
  )
  select distinct f.kollej_en, coalesce(nullif(f.fakultet_en, ''), f.fakultet_kr), f.fakultet_kr,
         p.daraja, f.track, p.qabul_yili, p.semestr
    from pick p
    join public.university_guideline_faculties f on f.guideline_uuid = p.id
   where coalesce(nullif(f.fakultet_en, ''), f.fakultet_kr) is not null
   order by 4, 1 nulls last, 2;
$$;

revoke all on function public.choice_faculty_options(uuid) from public, anon;
grant execute on function public.choice_faculty_options(uuid) to authenticated;
