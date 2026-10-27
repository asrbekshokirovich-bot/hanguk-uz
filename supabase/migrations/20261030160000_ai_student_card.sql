-- Hanguk AI reads the same facts the CRM shows (Asrbek, 2026-10-27).
--
-- The assistant answered from the legacy applications table, which staff
-- stopped using on 2026-10-15, so it could not see seasons, cancelled
-- contracts, the 8-document pack, online/offline submissions, results or visas.
--
--   ai_pack_slots(student)     - the 8 required pack documents and their state
--                                (src/lib/studentDocSlots.ts, newest upload wins)
--   ai_board_stage(student,..) - the Arizalar board column
--                                (src/lib/applicationPipeline.ts pipelineStage)
--   ai_student_card(student)   - everything about one student, for the chat tool
--   ai_season_pipeline(intake) - board columns with names, for season questions
--   ai.student_seasons, ai.university_submissions - for query_database
--
-- Helpers are internal (no EXECUTE for clients); the two RPCs are staff-only.

create or replace function public.ai_pack_slots(p_student uuid)
returns table (slot_id text, label text, state text)
language sql
stable
security definer
set search_path = public
as $$
  with slots(ord, slot_id, alias, label) as (values
    (1, 'applicant_id_card',    null::text,           'ID karta (pasport) nusxasi'),
    (2, 'foreign_passport',     'applicant_passport', 'Zagran pasport nusxasi'),
    (3, 'father_id_card',       'parent_passport',    'Otaning ID kartasi'),
    (4, 'mother_id_card',       null,                 'Onaning ID kartasi'),
    (5, 'birth_certificate',    null,                 'Tug''ilganlik guvohnomasi'),
    (6, 'language_certificate', null,                 'IELTS sertifikati'),
    (7, 'photo',                null,                 'Rasm 3.5x4.5'),
    (8, 'diploma',              null,                 'Diplom yoki attestat')
  )
  select s.slot_id, s.label,
         case when x.status = 'approved' then 'tasdiqlangan'
              when x.status is null then 'yuklanmagan'
              else 'tekshirilmoqda' end
    from slots s
    left join lateral (
      select d.status
        from documents d
       where d.student_id = p_student
         and exists (select 1 from unnest(array[s.slot_id, s.alias]) k(id)
                      where k.id is not null and (
                            position('[' || k.id || ']' in lower(coalesce(d.name, ''))) > 0
                         or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), k.id || '-')
                         or starts_with(lower(regexp_replace(coalesce(d.file_path, ''), '^.*/', '')), k.id || '.')))
       order by d.created_at desc
       limit 1) x on true
   order by s.ord;
$$;

create or replace function public.ai_board_stage(p_student uuid, p_docs_ready boolean)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from student_university_submissions where student_id = p_student)
  select case
    when exists (select 1 from s where final_at is not null and visa_status = 'received') then 'visa_received'
    when exists (select 1 from s where final_at is not null and visa_status = 'waiting')  then 'visa_waiting'
    when exists (select 1 from s where final_at is not null and visa_status = 'process')  then 'visa_process'
    when exists (select 1 from s where result is not null)          then 'result'
    when exists (select 1 from s where interview_at is not null)    then 'interview'
    when exists (select 1 from s where offline_sent_at is not null) then 'offline'
    when exists (select 1 from s where online_submitted_at is not null) then 'online'
    when coalesce(p_docs_ready, false)
      or (select count(*) from public.ai_pack_slots(p_student) where state = 'tasdiqlangan') = 8 then 'docs_ready'
    else 'new'
  end;
$$;

revoke all on function public.ai_pack_slots(uuid) from public, anon, authenticated;
revoke all on function public.ai_board_stage(uuid, boolean) from public, anon, authenticated;

-- Uzbek board labels, same as PIPELINE_LABELS.
create or replace function public.ai_stage_label(p_stage text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_stage
    when 'new' then 'Yangi' when 'docs_ready' then 'Hujjat tayyor'
    when 'online' then 'Onlayn ariza' when 'offline' then 'Oflayn ariza'
    when 'interview' then 'Suhbat' when 'result' then 'Natija'
    when 'visa_process' then 'Viza jarayonlari' when 'visa_waiting' then 'Viza natijasini kutyapti'
    when 'visa_received' then 'Viza oldi' else p_stage end;
$$;

create or replace function public.ai_student_card(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;

  select jsonb_build_object(
    'student', jsonb_build_object(
      'full_name', p.full_name, 'phone', p.phone, 'additional_phone', p.additional_phone,
      'city', p.city, 'tariff', p.payment_plan, 'language_track', p.language_track,
      'topik_level', p.topik_level, 'ielts_score', p.ielts_score, 'contract_date', p.contract_date,
      'is_demo', p.is_demo),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'season', initcap(ik.season) || ' ' || ik.year,
               'signed_at', si.created_at::date,
               'contract_status', case when si.contract_cancelled_at is null then 'faol' else 'bekor qilingan' end,
               'cancelled_at', si.contract_cancelled_at::date,
               'cancel_note', si.contract_cancel_note,
               'free_reapplication', si.is_free_reapplication,
               'board_stage', public.ai_stage_label(public.ai_board_stage(si.student_id, si.docs_ready)),
               'docs_ready_flag', si.docs_ready,
               'visa_approved_at', si.visa_approved_at,
               'departed_at', si.departed_at)
             order by ik.year desc, ik.season)
        from student_intakes si join intakes ik on ik.id = si.intake_id
       where si.student_id = p.user_id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'season', x.season, 'currency', x.currency,
               'total', x.total, 'paid', x.paid, 'remaining', x.total - x.paid,
               'text', x.paid || ' ' || x.currency || ' / ' || x.total || ' ' || x.currency
                       || ' to''langan, ' || (x.total - x.paid) || ' ' || x.currency || ' qoldi'))
        from (select coalesce(initcap(ik.season) || ' ' || ik.year, '—') as season, pm.currency,
                     sum(pm.amount) as total, sum(coalesce(pm.paid_amount, 0)) as paid
                from payments pm left join intakes ik on ik.id = pm.intake_id
               where pm.student_id = p.user_id and pm.status <> 'refunded'
               group by 1, 2) x), '[]'::jsonb),
    'document_pack', jsonb_build_object(
      'approved', (select count(*) from public.ai_pack_slots(p.user_id) where state = 'tasdiqlangan'),
      'required', 8,
      'slots', (select jsonb_agg(jsonb_build_object('document', label, 'state', state))
                  from public.ai_pack_slots(p.user_id))),
    'universities', coalesce((
      select jsonb_agg(jsonb_build_object(
               'university', coalesce(i.name_en, i.name_ko),
               'online_submitted_at', s.online_submitted_at::date,
               'offline_sent_at', s.offline_sent_at::date,
               'interview_at', s.interview_at,
               'result', case s.result when 'accepted' then 'qabul qilindi' when 'rejected' then 'rad etildi' end,
               'result_at', s.result_at::date,
               'final_choice', s.final_at is not null,
               'visa_status', case s.visa_status when 'process' then 'viza jarayonida'
                                when 'waiting' then 'viza natijasini kutyapti' when 'received' then 'viza oldi' end))
        from student_university_submissions s left join institutions i on i.id = s.institution_id
       where s.student_id = p.user_id), '[]'::jsonb),
    'open_tasks', coalesce((
      select jsonb_agg(jsonb_build_object('title', t.title, 'priority', t.priority, 'due_date', t.due_date::date))
        from tasks t where t.student_id = p.user_id and t.status not in ('completed', 'cancelled')), '[]'::jsonb),
    'recent_calls', coalesce((
      select jsonb_agg(c) from (
        select jsonb_build_object('date', ca.created_at::date, 'summary', coalesce(ca.summary_uz, ca.summary_en),
                                  'follow_up_needed', ca.follow_up_needed) as c
          from call_analyses ca where ca.student_id = p.user_id
         order by ca.created_at desc limit 3) z), '[]'::jsonb),
    'telegram', jsonb_build_object(
      'messages', (select count(*) from messages m where m.student_id = p.user_id),
      'last_message_at', (select max(m.created_at)::date from messages m where m.student_id = p.user_id))
  ) into v
  from profiles p
  where p.user_id = p_student_id;

  return coalesce(v, jsonb_build_object('error', 'student not found'));
end;
$$;

create or replace function public.ai_season_pipeline(p_intake_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_intake uuid := coalesce(p_intake_id, (select id from intakes where is_default order by year desc limit 1));
  v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then
    raise exception 'not authorized: staff only';
  end if;

  with m as (
    select si.student_id, p.full_name, si.contract_cancelled_at,
           public.ai_board_stage(si.student_id, si.docs_ready) as stage
      from student_intakes si join profiles p on p.user_id = si.student_id
     where si.intake_id = v_intake and not p.is_demo
       and not exists (select 1 from user_roles ur where ur.user_id = si.student_id)
  )
  select jsonb_build_object(
    'season', (select initcap(season) || ' ' || year from intakes where id = v_intake),
    'active_students', (select count(*) from m where contract_cancelled_at is null),
    'cancelled_contracts', (select jsonb_build_object('count', count(*), 'names', coalesce(jsonb_agg(full_name order by full_name), '[]'::jsonb))
                              from m where contract_cancelled_at is not null),
    'stages', coalesce((
      select jsonb_agg(jsonb_build_object('stage', public.ai_stage_label(stage), 'count', n, 'students', names) order by ord)
        from (select stage, count(*) n, jsonb_agg(full_name order by full_name) names,
                     array_position(array['new','docs_ready','online','offline','interview','result','visa_process','visa_waiting','visa_received'], stage) ord
                from m where contract_cancelled_at is null group by stage) g), '[]'::jsonb),
    'note', 'Same columns as the CRM Arizalar board; cancelled contracts and demo accounts are excluded.'
  ) into v;
  return v;
end;
$$;

revoke all on function public.ai_student_card(uuid) from public, anon;
revoke all on function public.ai_season_pipeline(uuid) from public, anon;
grant execute on function public.ai_student_card(uuid) to authenticated;
grant execute on function public.ai_season_pipeline(uuid) to authenticated;

-- query_database views (the ai schema is read as postgres by the edge function).
create or replace view ai.student_seasons as
  select si.student_id,
         si.intake_id,
         initcap(ik.season) || ' ' || ik.year as season,
         si.created_at as signed_at,
         (si.contract_cancelled_at is null) as contract_active,
         si.contract_cancelled_at,
         si.is_free_reapplication,
         si.docs_ready as docs_ready_flag,
         public.ai_board_stage(si.student_id, si.docs_ready) as board_stage,
         si.visa_approved_at,
         si.departed_at,
         p.is_demo
    from public.student_intakes si
    join public.intakes ik on ik.id = si.intake_id
    join public.profiles p on p.user_id = si.student_id;

create or replace view ai.university_submissions as
  select s.student_id,
         s.institution_id,
         coalesce(i.name_en, i.name_ko) as university_name,
         s.online_submitted_at,
         s.offline_sent_at,
         s.interview_at,
         s.result,
         s.result_at,
         s.final_at,
         s.visa_status
    from public.student_university_submissions s
    left join public.institutions i on i.id = s.institution_id;

revoke all on ai.student_seasons, ai.university_submissions from public, anon, authenticated;
