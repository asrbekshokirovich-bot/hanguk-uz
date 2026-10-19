-- Ariza tab, new design (owner, 2026-10-19): what the student app needs to
-- draw the eight "passport stamps" for each university, in one call.
--
-- student_university_submissions is staff-only, so the student reads it here
-- (own rows only), together with:
--   * the contract date (Shartnoma stamp);
--   * whether the documents pack and its translations are approved, and when
--     (Hujjatlar yig'ish, Tarjima va apostil stamps) — the same slots and
--     matching as student_documents_complete();
--   * whether the Study Plan is written: a study_plan session that reached
--     the AI analysis, the builder's last step ("Imzolash" asks for it);
--   * per university, the dates in its admission guideline: online deadline,
--     interview, result announcement, admission letter, visa documents. They
--     date the stamps that are still ahead.
--   * the visa status staff set on the final university (20261019185000).
--
-- Applied to production on 2026-10-19 through the Supabase connector.

create or replace function public.my_application_journey()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      from public.applications a
      join public.institutions i on i.id = a.institution_id
      left join public.student_university_submissions s
             on s.student_id = a.student_id and s.institution_id = a.institution_id
      left join lateral (
        select * from public.university_guidelines g1
         where g1.institution_id = i.id
         order by g1.qabul_yili desc nulls last, (g1.semestr = 'kuz') desc, g1.updated_at desc
         limit 1
      ) g on true
     where a.student_id = v_uid
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
$$;

revoke all on function public.my_application_journey() from public, anon;
grant execute on function public.my_application_journey() to authenticated;
