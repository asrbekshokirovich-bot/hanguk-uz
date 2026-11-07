-- Ilova "Arizam" muhrlari CRM Arizalar taxtasi bilan bir xil + har bosqichda push
-- (Asrbek, 2026-11-07: "har bir bosqichdan keyin talabaga xabar borsin, bu bo'lim
-- crm bilan bir xil ishlasin").
--
-- Push allaqachon bor edi: onlayn, oflayn, qabul, yakuniy universitet. Qo'shiladi:
--   interview_scheduled   suhbat sanasi kiritildi
--   admission_rejected    universitet rad javobi berdi
--   visa_process / visa_waiting / visa_received   viza holati
-- my_application_journey: docs_complete = paket tasdiqlangan YOKI xodim
-- "hujjat tayyor" belgilagan (CRM taxtasidagi kabi).

alter table public.student_stage_notifications
  drop constraint student_stage_notifications_kind_check;
alter table public.student_stage_notifications
  add constraint student_stage_notifications_kind_check check (kind in (
    'documents_ready', 'university_offered', 'university_confirmed',
    'online_submitted', 'offline_sent', 'interview_scheduled',
    'admission_accepted', 'admission_rejected', 'final_university',
    'visa_process', 'visa_waiting', 'visa_received',
    'offer_reminder', 'deadline_7', 'deadline_3', 'deadline_1'));

create or replace function public.trg_submissions_stage_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.online_submitted_at is not null
     and (tg_op = 'INSERT' or old.online_submitted_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'online_submitted', new.institution_id);
  elsif new.online_submitted_at is null and tg_op = 'UPDATE' and old.online_submitted_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'online_submitted', new.institution_id);
  end if;

  if new.offline_sent_at is not null
     and (tg_op = 'INSERT' or old.offline_sent_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'offline_sent', new.institution_id);
  elsif new.offline_sent_at is null and tg_op = 'UPDATE' and old.offline_sent_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'offline_sent', new.institution_id);
  end if;

  if new.interview_at is not null
     and (tg_op = 'INSERT' or old.interview_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'interview_scheduled', new.institution_id);
  elsif new.interview_at is null and tg_op = 'UPDATE' and old.interview_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'interview_scheduled', new.institution_id);
  end if;

  if new.result = 'accepted'
     and (tg_op = 'INSERT' or old.result is distinct from 'accepted') then
    perform public.enqueue_stage_notification(new.student_id, 'admission_accepted', new.institution_id);
  elsif new.result is distinct from 'accepted' and tg_op = 'UPDATE' and old.result = 'accepted' then
    perform public.withdraw_stage_notification(new.student_id, 'admission_accepted', new.institution_id);
  end if;

  if new.result = 'rejected'
     and (tg_op = 'INSERT' or old.result is distinct from 'rejected') then
    perform public.enqueue_stage_notification(new.student_id, 'admission_rejected', new.institution_id);
  elsif new.result is distinct from 'rejected' and tg_op = 'UPDATE' and old.result = 'rejected' then
    perform public.withdraw_stage_notification(new.student_id, 'admission_rejected', new.institution_id);
  end if;

  if new.final_at is not null
     and (tg_op = 'INSERT' or old.final_at is null) then
    perform public.enqueue_stage_notification(new.student_id, 'final_university', new.institution_id);
  elsif new.final_at is null and tg_op = 'UPDATE' and old.final_at is not null then
    perform public.withdraw_stage_notification(new.student_id, 'final_university', new.institution_id);
  end if;

  if new.visa_status in ('process', 'waiting', 'received')
     and (tg_op = 'INSERT' or old.visa_status is distinct from new.visa_status) then
    perform public.enqueue_stage_notification(new.student_id, 'visa_' || new.visa_status, new.institution_id);
  end if;
  if tg_op = 'UPDATE' and old.visa_status in ('process', 'waiting', 'received')
     and old.visa_status is distinct from new.visa_status then
    perform public.withdraw_stage_notification(new.student_id, 'visa_' || old.visa_status, new.institution_id);
  end if;
  return null;
end;
$function$;

drop trigger if exists student_university_submissions_stage_notification on public.student_university_submissions;
create trigger student_university_submissions_stage_notification
  after insert or update of online_submitted_at, offline_sent_at, interview_at, result, final_at, visa_status
  on public.student_university_submissions
  for each row execute function public.trg_submissions_stage_notification();

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
    -- As the CRM board: the pack verified OR staff marked it ready (2026-11-07).
    'docs_complete', coalesce((select complete from packs where kind = 'pack'), false)
                     or exists (select 1 from public.student_intakes si
                                 where si.student_id = v_uid and si.docs_ready
                                   and si.contract_cancelled_at is null),
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

