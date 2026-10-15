-- Keeps applications.status — what the student app's journey tracker reads
-- (hanguk_app ProcessTracker.stepFor) — in step with the sections that now do
-- the work. Arizalar became read-only (2026-10-15), so nobody moves the
-- status by hand any more; without this the app's tracker would freeze.
--
--   documents pack fully approved      → 'documents'          (step 1)
--   "Onlayn topshirildi"               → 'application_submitted' (step 2)
--   paper documents posted             → 'originals_sent'     (step 3)
--   result: not admitted               → 'rejected'
--   picked as the final university     → 'visa_documents'     (step 8)
--
-- Per (student, university). The status is recomputed from the submission row
-- each time, so undoing a step in the CRM moves it back too — but a status
-- past visa preparation (or a legacy 'completed' / 'accepted') is never
-- touched. A submission for a university with no application row yet creates
-- one, as "Arizaga o'tkazish" does.
--
-- Applied to production on 2026-10-15 through the Supabase connector; kept
-- here so the repo matches.

-- Mirror of ProcessTracker.stepFor (hanguk_app/lib/features/applications/
-- presentation/widgets/process_tracker.dart).
create or replace function public.application_status_step(p_status text)
returns int
language sql
immutable
as $$
  select case
    when p_status in ('completed', 'accepted', 'enrolled', 'rejected', 'visa_issue') then 9
    when p_status in ('visa_documents', 'visa') then 8
    when p_status = 'university_response' then 7
    when p_status = 'tuition_payment' then 6
    when p_status = 'waiting_invoice' then 5
    when p_status = 'interview' then 4
    when p_status in ('offline_application', 'originals_sent') then 3
    when p_status in ('application_submitted', 'submitted', 'online_ariza', 'in_review', 'review', 'online_application') then 2
    when p_status in ('documents_collection', 'documents_translation', 'apostille', 'documents') then 1
    else 0
  end;
$$;

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
    when s.offline_sent_at is not null then 'originals_sent'
    when s.online_submitted_at is not null then 'application_submitted'
    else null
  end;

  if v_target is null then
    -- Every step undone: back to document preparation if the row was ours.
    update public.applications
       set status = 'documents'
     where student_id = p_student and institution_id = p_institution
       and status in ('application_submitted', 'originals_sent', 'rejected', 'visa_documents');
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

create or replace function public.trg_submissions_sync_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_application_from_submission(new.student_id, new.institution_id);
  return null;
end;
$$;

create or replace trigger student_university_submissions_sync_application
  after insert or update of online_submitted_at, offline_sent_at, result, final_at
  on public.student_university_submissions
  for each row execute function public.trg_submissions_sync_application();

-- Documents pack complete → applications still at "not started" move to
-- document preparation. Added to the existing documents trigger function.
create or replace function public.trg_documents_stage_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and new.student_id is not null
     and public.student_documents_complete(new.student_id)
  then
    perform public.enqueue_stage_notification(new.student_id, 'documents_ready');
    update public.applications
       set status = 'documents'
     where student_id = new.student_id
       and public.application_status_step(status) = 0;
  end if;
  return null;
end;
$$;
