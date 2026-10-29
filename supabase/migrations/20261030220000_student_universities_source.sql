-- The student app and web portal read the legacy applications table
-- (Asrbek, 2026-10-27): a confirmed university only appeared once staff
-- pressed the (now removed) "Arizaga o'tkazish", and a stale hand-set status
-- ("apostille") moved the app's journey ahead of reality.
--
-- Universities now come from the same facts as the CRM's Arizalar board:
--   confirmed choices (student_university_choices, status 'confirmed')
--   ∪ submissions (student_university_submissions)
--   ∪ the student's own requests still waiting for staff (applications,
--     status 'pending_approval').
-- `status` is derived from the submission, in the codes the app already
-- understands (hanguk_app ProcessTracker.stepFor):
--   pending_approval  the student's request, not yet approved
--   documents         chosen, nothing sent yet
--   application_submitted / originals_sent / interview
--   university_response (accepted or final) / rejected
--   visa_documents (visa documents) / visa_issue (waiting for the visa) /
--   completed (visa received)
--
--   student_university_step_code(...)  the mapping above (internal)
--   my_universities()                  the signed-in student's universities
--   my_application_journey()           same universities, rest unchanged

create or replace function public.student_university_step_code(
  p_has_submission boolean,
  p_online timestamptz,
  p_offline timestamptz,
  p_interview timestamptz,
  p_result text,
  p_final timestamptz,
  p_visa text
) returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_final is not null and p_visa = 'received' then 'completed'
    when p_final is not null and p_visa = 'waiting' then 'visa_issue'
    when p_final is not null and p_visa = 'process' then 'visa_documents'
    when p_final is not null then 'university_response'
    when p_result = 'accepted' then 'university_response'
    when p_result = 'rejected' then 'rejected'
    when p_interview is not null then 'interview'
    when p_offline is not null then 'originals_sent'
    when p_online is not null then 'application_submitted'
    else 'documents'
  end
$$;

revoke all on function public.student_university_step_code(boolean, timestamptz, timestamptz, timestamptz, text, timestamptz, text) from public, anon, authenticated;

-- One row per university of a student: choices, submissions, own requests.
create or replace function public.student_universities_of(p_student uuid)
returns table (
  id uuid,
  institution_id uuid,
  status text,
  program text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with pairs as (
    select c.institution_id, min(c.created_at) as created_at
      from student_university_choices c
     where c.student_id = p_student and c.status = 'confirmed'
     group by c.institution_id
    union
    select s.institution_id, coalesce(s.online_submitted_at, s.offline_sent_at, s.updated_at)
      from student_university_submissions s
     where s.student_id = p_student
  ), unis as (
    select institution_id, min(created_at) as created_at from pairs group by institution_id
  ), degree as (
    select a.degree_level from applications a
     where a.student_id = p_student and a.degree_level is not null
     order by a.updated_at desc limit 1
  )
  select coalesce(s.id, u.institution_id) as id,
         u.institution_id,
         public.student_university_step_code(s.id is not null, s.online_submitted_at, s.offline_sent_at,
                                             s.interview_at, s.result, s.final_at, s.visa_status) as status,
         (select degree_level from degree) as program,
         u.created_at
    from unis u
    left join student_university_submissions s
           on s.student_id = p_student and s.institution_id = u.institution_id
  union all
  select a.id, a.institution_id, a.status, a.degree_level, a.created_at
    from applications a
   where a.student_id = p_student and a.status = 'pending_approval'
     and not exists (select 1 from unis u where u.institution_id = a.institution_id)
$$;

revoke all on function public.student_universities_of(uuid) from public, anon, authenticated;

create or replace function public.my_universities()
returns table (
  id uuid,
  institution_id uuid,
  status text,
  program text,
  created_at timestamptz,
  name_en text,
  name_ko text,
  city_ko text,
  is_partner boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.institution_id, u.status, u.program, u.created_at,
         i.name_en, i.name_ko, i.city_ko, coalesce(i.is_partner, false)
    from public.student_universities_of(auth.uid()) u
    join institutions i on i.id = u.institution_id
   where auth.uid() is not null
   order by u.created_at desc nulls last
$$;

revoke all on function public.my_universities() from public, anon;
grant execute on function public.my_universities() to authenticated;

-- Same function as live, only `unis` changed: universities come from
-- student_universities_of() instead of applications.
create or replace function public.my_application_journey()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  with docs as (
    select d.name, d.file_path, d.status, coalesce(d.reviewed_at, d.updated_at, d.created_at) as at, d.created_at
      from public.documents d
     where d.student_id = v_uid
  ),
  slots(slot_id, ids, kind) as (
    values
      ('applicant_id_card',             array['applicant_id_card'], 'pack'),
      ('foreign_passport',              array['foreign_passport', 'applicant_passport'], 'pack'),
      ('father_id_card',                array['father_id_card', 'parent_passport'], 'pack'),
      ('mother_id_card',                array['mother_id_card'], 'pack'),
      ('birth_certificate',             array['birth_certificate'], 'pack'),
      ('language_certificate',          array['language_certificate'], 'pack'),
      ('photo',                         array['photo'], 'pack'),
      ('diploma',                       array['diploma'], 'pack'),
      ('birth_certificate_translation', array['birth_certificate_translation'], 'translation'),
      ('diploma_translation',           array['diploma_translation'], 'translation')
  ),
  newest as (
    select s.kind, n.status, n.at
      from slots s
      left join lateral (
        select d.status, d.at
          from docs d
         where exists (
           select 1 from unnest(s.ids) as i(id)
            where strpos(lower(coalesce(d.name, '')), '[' || i.id || ']') > 0
               or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), i.id || '-')
               or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), i.id || '.'))
         order by d.created_at desc
         limit 1
      ) n on true
  ),
  packs as (
    select kind,
           bool_and(coalesce(status = 'approved', false)) as complete,
           max(at) as at
      from newest
     group by kind
  ),
  unis as (
    select a.institution_id,
           a.status,
           i.name_en, i.name_ko, i.name_ko_short, i.city_ko,
           g.id as guideline_id, g.qabul_yili, g.semestr, g.daraja, g.shahar,
           s.online_submitted_at, s.offline_sent_at, s.interview_at, s.result, s.result_at, s.final_at,
           s.visa_status, s.visa_status_at
      from public.student_universities_of(v_uid) a
      join public.institutions i on i.id = a.institution_id
      left join public.student_university_submissions s
             on s.student_id = v_uid and s.institution_id = a.institution_id
      left join lateral (
        select * from public.university_guidelines g1
         where g1.institution_id = i.id
         order by g1.qabul_yili desc nulls last, (g1.semestr = 'kuz') desc, g1.updated_at desc
         limit 1
      ) g on true
  )
  select jsonb_build_object(
    'contract_date', (select p.contract_date from public.profiles p where p.user_id = v_uid),
    'docs_complete', coalesce((select complete from packs where kind = 'pack'), false),
    'docs_at', (select at from packs where kind = 'pack' and complete),
    'translations_complete', coalesce((select complete from packs where kind = 'translation'), false),
    'translations_at', (select at from packs where kind = 'translation' and complete),
    'study_plan_ready', exists (
      select 1 from public.study_plan_sessions sp
       where sp.student_id = v_uid and sp.document_type = 'study_plan'
         and (sp.status = 'completed'
              or exists (select 1 from public.study_plan_analyses an where an.session_id = sp.id))),
    'universities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institution_id', u.institution_id,
        'status', u.status,
        'name_en', u.name_en,
        'name_ko', u.name_ko,
        'name_ko_short', u.name_ko_short,
        'city', coalesce(u.shahar, u.city_ko),
        'intake_year', u.qabul_yili,
        'semester', u.semestr,
        'degree', u.daraja,
        'online_submitted_at', u.online_submitted_at,
        'offline_sent_at', u.offline_sent_at,
        'interview_at', u.interview_at,
        'result', u.result,
        'result_at', u.result_at,
        'final_at', u.final_at,
        'visa_status', u.visa_status,
        'visa_status_at', u.visa_status_at,
        'online_deadline', (
          select min(r.tugash_sana) from public.university_guideline_rounds r
           where r.guideline_uuid = u.guideline_id and r.etap_nomi = 'Online hujjat topshirish'),
        'interview_round', (
          select min(coalesce(r.boshlanish_sana, r.tugash_sana)) from public.university_guideline_rounds r
           where r.guideline_uuid = u.guideline_id and r.etap_nomi = 'Intervyu'),
        'result_round', (
          select min(coalesce(r.boshlanish_sana, r.tugash_sana)) from public.university_guideline_rounds r
           where r.guideline_uuid = u.guideline_id and r.etap_nomi = 'Natija e''lon qilinishi'),
        'admission_letter_round', (
          select min(coalesce(r.boshlanish_sana, r.tugash_sana)) from public.university_guideline_rounds r
           where r.guideline_uuid = u.guideline_id and r.etap_nomi = 'Certificate of Admission berilishi'),
        'visa_round', (
          select min(coalesce(r.boshlanish_sana, r.tugash_sana)) from public.university_guideline_rounds r
           where r.guideline_uuid = u.guideline_id and r.etap_nomi = 'Vizaga hujjat topshirish')
      ))
      from unis u), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;
