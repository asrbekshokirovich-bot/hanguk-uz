-- Viza holati (owner, 2026-10-19): staff mark the student's visa on the
-- final university's row (Onlayn ariza → Natijalar):
--
--   'process'  Viza jarayonlari          → applications.status 'visa_documents' (app step 8)
--   'waiting'  Viza natijasini kutyapti  → 'visa_issue' (step 9, "Viza berilishini kutish")
--   'received' Viza oldi                 → 'completed'
--
-- Only the final university carries a visa; clearing the final pick (or the
-- admission) clears it too (useUniversitySubmissions). A status the sync wrote
-- from a final pick — visa_issue / completed — is recomputed like the others
-- when staff change the visa back.
--
-- Applied to production on 2026-10-19 through the Supabase connector.

alter table public.student_university_submissions
  add column if not exists visa_status text
    check (visa_status in ('process', 'waiting', 'received')),
  add column if not exists visa_status_at timestamptz,
  add column if not exists visa_status_by uuid references auth.users (id) on delete set null;

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
    when s.final_at is not null and s.visa_status = 'received' then 'completed'
    when s.final_at is not null and s.visa_status = 'waiting' then 'visa_issue'
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
     and (public.application_status_step(status) <= 8
          or status = 'rejected'
          or (status in ('visa_issue', 'completed') and s.final_at is not null))
     and status is distinct from v_target;

  if not exists (select 1 from public.applications where student_id = p_student and institution_id = p_institution)
     and exists (select 1 from auth.users u where u.id = p_student) then
    insert into public.applications (student_id, institution_id, status, submitted_at)
    values (p_student, p_institution, v_target, s.online_submitted_at);
  end if;
end;
$$;

revoke all on function public.sync_application_from_submission(uuid, uuid) from public, anon, authenticated;

-- The final pick undone: a visa status it carried is no longer this
-- university's, so step it back into the range the sync recomputes.
create or replace function public.trg_submissions_sync_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.final_at is not null and new.final_at is null then
    update public.applications
       set status = 'visa_documents'
     where student_id = new.student_id and institution_id = new.institution_id
       and status in ('visa_issue', 'completed');
  end if;
  perform public.sync_application_from_submission(new.student_id, new.institution_id);
  return null;
end;
$$;

create or replace trigger student_university_submissions_sync_application
  after insert or update of online_submitted_at, offline_sent_at, interview_at, result, final_at, visa_status
  on public.student_university_submissions
  for each row execute function public.trg_submissions_sync_application();
