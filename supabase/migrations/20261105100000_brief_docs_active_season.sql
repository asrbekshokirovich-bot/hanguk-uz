-- Brifingdagi "Tekshiruvni kutayotgan hujjatlar" va o'tgan mavsum AI tarjimalari
-- (Asrbek, 2026-11-05: "2 lasini ham qil").
--
-- Muammo (prod, 05.11): brifing documents.status='uploaded' ni HAMMASINI sanardi
-- — 91 tadan 84 tasi Kuz 2026 (o'tgan mavsum) talabalari uchun AI yaratgan
-- tarjima qoralamalari edi. Avtomatik tarjima navbati eng eskisidan ishlagani
-- uchun fevral–aprel so'rovlari 19.10 dan beri bajarilib, faol mavsumning 38 ta
-- so'rovini orqada qoldirgan.
--
-- 1. fn_student_in_active_season(): talaba faol mavsumda (ai_default_intake),
--    shartnomasi bekor qilinmagan.
-- 2. Avtomatik tarjima faqat faol mavsum talabalari uchun: trigger yangi so'rov
--    ochmaydi, claim_auto_translation_job boshqasini olmaydi.
-- 3. O'tgan mavsumning navbatdagi so'rovlari bekor qilinadi.
-- 4. O'tgan mavsum talabalarining tekshirilmagan AI qoralamalari 'archived'
--    holatiga o'tkaziladi (o'chirilmaydi; qaytarish: status='uploaded').
-- 5. bot_morning_brief: hujjatlar faqat faol mavsum, talaba yuklagani va AI
--    tarjimasi alohida.

create or replace function public.fn_student_in_active_season(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.student_intakes si
     where si.student_id = p_student
       and si.intake_id = public.ai_default_intake()
       and si.contract_cancelled_at is null);
$$;

revoke all on function public.fn_student_in_active_season(uuid) from public, anon, authenticated;

-- 2a. Trigger: o'tgan mavsum talabasiga yangi tarjima so'rovi ochilmaydi.
create or replace function public.trg_documents_auto_translation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tag  text := lower(public.extract_doc_type_tag(new.name));
  v_type uuid;
  v_role text;
  v_src  record;
begin
  if new.student_id is null or coalesce(new.file_path, '') = '' then
    return null;
  end if;

  -- Faqat faol mavsum talabalari (2026-11-05).
  if not public.fn_student_in_active_season(new.student_id) then
    return null;
  end if;

  if v_tag in ('diploma', 'birth_certificate') then
    select id into v_type from public.translation_document_types
     where code = v_tag and is_active;
    if v_type is null then
      return null;
    end if;

    update public.translation_jobs
       set status = 'cancelled', error_message = 'Yangiroq hujjat yuklangan'
     where student_id = new.student_id
       and document_type_id = v_type
       and auto_triggered
       and status in ('queued', 'waiting_documents');

    insert into public.translation_jobs
      (student_id, document_type_id, source_document_id, source_file_path, auto_triggered, status)
    values
      (new.student_id, v_type, new.id, new.file_path, true, 'queued');

  elsif v_tag in ('foreign_passport', 'applicant_passport',
                  'father_id_card', 'parent_passport', 'father_foreign_passport',
                  'mother_id_card', 'mother_foreign_passport') then
    update public.translation_jobs
       set status = 'queued', error_message = null
     where student_id = new.student_id
       and auto_triggered
       and status = 'waiting_documents';

    if v_tag <> 'foreign_passport' and v_tag <> 'applicant_passport' then
      v_role := case when v_tag like 'mother%' then 'mother_id' else 'father_id' end;

      select d.id, d.file_path into v_src
        from public.documents d
       where d.student_id = new.student_id
         and lower(public.extract_doc_type_tag(d.name)) = 'birth_certificate'
       order by d.created_at desc
       limit 1;

      if found
         and not exists (
           select 1 from public.translation_jobs j
            where j.source_document_id = v_src.id and j.auto_triggered
              and j.status in ('queued', 'processing', 'waiting_documents'))
         and not exists (
           select 1 from public.documents t
            where t.student_id = new.student_id
              and lower(public.extract_doc_type_tag(t.name)) = 'birth_certificate_translation'
              and t.status = 'approved')
         and exists (
           select 1 from (
             select j.supporting_documents
               from public.translation_jobs j
              where j.source_document_id = v_src.id and j.auto_triggered and j.status = 'completed'
              order by j.completed_at desc nulls last
              limit 1) last
            where not exists (
              select 1 from jsonb_array_elements(coalesce(last.supporting_documents, '[]'::jsonb)) e
               where e->>'role' = v_role))
      then
        insert into public.translation_jobs
          (student_id, document_type_id, source_document_id, source_file_path, auto_triggered, status)
        select new.student_id, t.id, v_src.id, v_src.file_path, true, 'queued'
          from public.translation_document_types t
         where t.code = 'birth_certificate' and t.is_active;
      end if;
    end if;
  end if;

  return null;
exception when others then
  raise warning 'auto translation enqueue failed for document %: %', new.id, sqlerrm;
  return null;
end;
$function$;

-- 2b. Ishchi faqat faol mavsum talabalarining so'rovini oladi.
create or replace function public.claim_auto_translation_job(p_max_attempts integer default 3)
returns setof public.translation_jobs
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.translation_jobs
     set status = 'failed',
         error_message = coalesce(error_message, 'Tarjima vaqtida to''xtab qoldi')
   where auto_triggered
     and status = 'processing'
     and updated_at < now() - interval '15 minutes'
     and attempts >= p_max_attempts;

  return query
  update public.translation_jobs j
     set status = 'processing', attempts = j.attempts + 1
   where j.id = (
     select id from public.translation_jobs
      where auto_triggered
        and public.fn_student_in_active_season(student_id)
        and ((status = 'queued'
              and (error_message is null or updated_at < now() - interval '5 minutes')
              and public.auto_translation_slots_left() > 0)
             or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      order by created_at
      limit 1
      for update skip locked)
  returning j.*;
end;
$function$;

-- 3. O'tgan mavsumning kutayotgan so'rovlari.
update public.translation_jobs
   set status = 'cancelled', error_message = 'O''tgan mavsum — avtomatik tarjima to''xtatildi (2026-11-05)'
 where auto_triggered
   and status in ('queued', 'pending', 'waiting_documents')
   and not public.fn_student_in_active_season(student_id);

-- 4. O'tgan mavsum talabalarining tekshirilmagan AI qoralamalari.
update public.documents d
   set status = 'archived',
       notes = concat_ws(E'\n', nullif(d.notes, ''), 'Arxiv: o''tgan mavsum AI tarjima qoralamasi (2026-11-05)'),
       updated_at = now()
 where d.status = 'uploaded'
   and d.file_path like '%-auto.docx'
   and not public.fn_student_in_active_season(d.student_id);

-- 5. Brifing: faqat faol mavsum hujjatlari, ikkiga bo'lingan.
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
  ),
  docs as (
    select (d.file_path like '%-auto.docx') as ai
      from documents d
      join students st on st.student_id = d.student_id
     where d.status = 'uploaded'
  )
  select jsonb_build_object(
    'new_leads', (select count(*) from leads l where l.created_at >= now() - interval '24 hours'),
    'my_new_leads', (select count(*) from leads l where l.created_at >= now() - interval '24 hours'
                                                   and l.assigned_to = p_user),
    'my_overdue_tasks', (select count(*) from tasks t where t.assigned_to = p_user
                                                     and t.status in ('todo', 'in_progress')
                                                     and t.due_date < v_d0),
    'docs_waiting', (select count(*) from docs),
    'docs_waiting_student', (select count(*) from docs where not ai),
    'docs_waiting_ai', (select count(*) from docs where ai),
    'deadlines', coalesce((select jsonb_agg(jsonb_build_object('university', university, 'date', date,
                                                             'days_left', date - v_today, 'students', students)
                                            order by date, university)
                             from (select * from due order by date, university limit 8) x), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.bot_morning_brief(uuid) from public, anon, authenticated;
grant execute on function public.bot_morning_brief(uuid) to service_role;
