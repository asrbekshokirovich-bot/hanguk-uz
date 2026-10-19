-- Automatic certified translation of the diploma / attestat and the birth
-- certificate (CRM → AI Tarjima), filed as the document's translation for an
-- admin to approve.
--
-- The owner's rule (2026-10-19): names come from identity documents.
--   * diploma / attestat  needs the student's foreign passport
--   * birth certificate   needs the student's foreign passport and the
--                         father's and mother's passport (ID card or foreign)
--                         — parents' passports made optional the same day,
--                         see 20261019120000_auto_translation_parent_names.sql
-- The worker (supabase/functions/auto-translate-documents, rules.ts) checks
-- this; a job without them waits in 'waiting_documents' and this file's
-- trigger re-queues it the moment one of those documents is uploaded.
--
-- Job statuses added for auto jobs: queued -> processing -> completed, plus
-- waiting_documents, cancelled (the source was replaced or deleted) and failed
-- (after 3 attempts). Manual jobs from the CRM page keep pending/processing/
-- completed/failed and are never touched by the worker.

alter table public.translation_jobs
  add column if not exists attempts smallint not null default 0;

-- A student re-uploading a document deletes the old row first
-- (DocumentUpload.tsx). With a plain foreign key, any job that pointed at the
-- old row blocked that delete, and the new upload then hit
-- documents_student_doc_type_unique. Keep the job, drop the link.
alter table public.translation_jobs
  drop constraint if exists translation_jobs_source_document_id_fkey;
alter table public.translation_jobs
  add constraint translation_jobs_source_document_id_fkey
  foreign key (source_document_id) references public.documents (id) on delete set null;

create index if not exists translation_jobs_auto_queue
  on public.translation_jobs (created_at)
  where auto_triggered and status in ('queued', 'processing');

create index if not exists translation_jobs_student_waiting
  on public.translation_jobs (student_id)
  where auto_triggered and status = 'waiting_documents';

-- ---------------------------------------------------------------------------
-- Queue on upload. Source slots and their translation type mirror AUTO_SOURCES
-- in rules.ts; identity slots (with legacy aliases) mirror its requirements.
create or replace function public.trg_documents_auto_translation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag  text := lower(public.extract_doc_type_tag(new.name));
  v_type uuid;
begin
  if new.student_id is null or coalesce(new.file_path, '') = '' then
    return null;
  end if;

  if v_tag in ('diploma', 'birth_certificate') then
    select id into v_type from public.translation_document_types
     where code = v_tag and is_active;
    if v_type is null then
      return null;
    end if;

    -- A newer upload supersedes anything still waiting for the old one.
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
  end if;

  return null;
exception when others then
  -- Translation is a convenience; it must never block an upload.
  raise warning 'auto translation enqueue failed for document %: %', new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists documents_auto_translation on public.documents;
create trigger documents_auto_translation
  after insert or update of file_path on public.documents
  for each row execute function public.trg_documents_auto_translation();

-- ---------------------------------------------------------------------------
-- Claim the oldest queued auto job, or one stuck in 'processing' for 15
-- minutes (the worker died mid-run). A stuck job that has used every attempt
-- is failed here instead.
create or replace function public.claim_auto_translation_job(p_max_attempts int default 3)
returns setof public.translation_jobs
language plpgsql
security definer
set search_path = public
as $$
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
        and (status = 'queued'
             or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      order by created_at
      limit 1
      for update skip locked)
  returning j.*;
end;
$$;

revoke all on function public.claim_auto_translation_job(int) from public, anon, authenticated;
grant execute on function public.claim_auto_translation_job(int) to service_role;

-- ---------------------------------------------------------------------------
-- Every minute, but only call the worker when something is queued (or stuck),
-- so an idle queue costs no function invocations. Same wiring as
-- notify-student-stages.
select cron.schedule(
  'auto-translate-documents',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/auto-translate-documents',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
     where exists (
       select 1 from public.translation_jobs
        where auto_triggered
          and (status = 'queued'
               or (status = 'processing' and updated_at < now() - interval '15 minutes')))
  $cron$
);
