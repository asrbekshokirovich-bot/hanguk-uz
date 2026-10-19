-- Suhbat vaqti (owner, 2026-10-19): staff enter the university interview's
-- date and time per (student, university) on the Onlayn ariza page.
--
--   interview_at set  → applications.status 'interview' (app step 4)
--
-- It ranks after the final pick and a rejection and before the paper
-- documents and the online submission, as the journey does. Clearing it moves
-- the status back to whatever the other columns say. Visa stages are not
-- touched here.
--
-- Applied to production on 2026-10-19 through the Supabase connector.

alter table public.student_university_submissions
  add column if not exists interview_at timestamptz,
  add column if not exists interview_by uuid references auth.users (id) on delete set null;

create or replace function public.sync_application_from_submission(p_student uuid, p_institution uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.student_university_submissions%rowtype;
  v_target text;
begin
  select * into s from public.student_university_submissions
   where student_id = p_student and institution_id = p_institution;
  if not found then return; end if;

  v_target := case
    when s.final_at is not null then 'visa_documents'
    when s.result = 'rejected' then 'rejected'
    when s.interview_at is not null then 'interview'
    when s.offline_sent_at is not null then 'originals_sent'
    when s.online_submitted_at is not null then 'application_submitted'
    else null
  end;

  if v_target is null then
    -- Every step undone: back to document preparation if the row was ours.
    update public.applications
       set status = 'documents'
     where student_id = p_student and institution_id = p_institution
       and status in ('application_submitted', 'originals_sent', 'interview', 'rejected', 'visa_documents');
    return;
  end if;

  update public.applications
     set status = v_target,
         submitted_at = coalesce(submitted_at, s.online_submitted_at),
         decision = case when s.result is not null then s.result else decision end,
         decision_at = case when s.result is not null then coalesce(s.result_at, now()) else decision_at end
   where student_id = p_student and institution_id = p_institution
     and (public.application_status_step(status) <= 8 or status = 'rejected')
     and status is distinct from v_target;

  if not exists (select 1 from public.applications where student_id = p_student and institution_id = p_institution)
     and exists (select 1 from auth.users u where u.id = p_student) then
    insert into public.applications (student_id, institution_id, status, submitted_at)
    values (p_student, p_institution, v_target, s.online_submitted_at);
  end if;
end;
$$;

revoke all on function public.sync_application_from_submission(uuid, uuid) from public, anon, authenticated;

create or replace trigger student_university_submissions_sync_application
  after insert or update of online_submitted_at, offline_sent_at, interview_at, result, final_at
  on public.student_university_submissions
  for each row execute function public.trg_submissions_sync_application();
