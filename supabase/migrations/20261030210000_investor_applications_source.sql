-- Investor "Applications" read the legacy applications table (Asrbek,
-- 2026-10-27): staff stopped using it on 2026-10-15, so rows without a
-- submission kept stale, hand-set statuses ("apostille" for a student the
-- Arizalar board has in "Yangi").
--
-- v_investor_applications now lists, per student and university, the same
-- facts the board uses: confirmed choices (Universitet tanlash) and
-- submissions (Onlayn / Oflayn ariza, interview, result, final, visa).
-- Same columns; `status` is one university's step:
--   chosen, online, offline, interview, accepted, rejected, final,
--   visa_process, visa_waiting, visa_received
-- (src/lib/studentPipeline.ts submissionStep). program stays the student's
-- degree, which is still only kept on applications.degree_level.
--
-- A submission has no season: it belongs to the student's latest active
-- contract (student_intakes), demo accounts and cancelled contracts excluded.

create or replace view public.v_investor_applications as
with members as (
  select distinct on (si.student_id) si.student_id, si.intake_id
    from public.student_intakes si
    join public.profiles p on p.user_id = si.student_id
   where si.contract_cancelled_at is null
     and not coalesce(p.is_demo, false)
   order by si.student_id, si.created_at desc
), pairs as (
  select c.id, c.student_id, c.institution_id, c.created_at as chosen_at
    from public.student_university_choices c
   where c.status = 'confirmed'
  union
  select s.id, s.student_id, s.institution_id, null::timestamptz
    from public.student_university_submissions s
   where not exists (
     select 1 from public.student_university_choices c
      where c.student_id = s.student_id and c.institution_id = s.institution_id and c.status = 'confirmed')
)
select pr.id as application_id,
       m.intake_id,
       sp.full_name as student_name,
       sp.payment_plan as plan,
       coalesce(inst.name_en, inst.name_ko) as university,
       (select a.degree_level from public.applications a
         where a.student_id = pr.student_id and a.degree_level is not null
         order by a.updated_at desc limit 1) as program,
       case
         when s.final_at is not null and s.visa_status = 'received' then 'visa_received'
         when s.final_at is not null and s.visa_status = 'waiting' then 'visa_waiting'
         when s.final_at is not null and s.visa_status = 'process' then 'visa_process'
         when s.final_at is not null then 'final'
         when s.result = 'accepted' then 'accepted'
         when s.result = 'rejected' then 'rejected'
         when s.interview_at is not null then 'interview'
         when s.offline_sent_at is not null then 'offline'
         when s.online_submitted_at is not null then 'online'
         else 'chosen'
       end as status,
       least(s.online_submitted_at, s.offline_sent_at) as submitted_at,
       greatest(pr.chosen_at, s.updated_at, s.online_submitted_at, s.offline_sent_at,
                s.result_at, s.final_at, s.visa_status_at) as updated_at,
       (current_date - greatest(pr.chosen_at, s.updated_at, s.online_submitted_at, s.offline_sent_at,
                                s.result_at, s.final_at, s.visa_status_at)::date)::integer as days_since_movement,
       pr.student_id
  from pairs pr
  join members m on m.student_id = pr.student_id
  left join public.student_university_submissions s
         on s.student_id = pr.student_id and s.institution_id = pr.institution_id
  left join public.profiles sp on sp.user_id = pr.student_id
  left join public.institutions inst on inst.id = pr.institution_id
 where public.investor_can_view_intake(m.intake_id);
