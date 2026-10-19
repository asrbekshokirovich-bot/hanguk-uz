-- Queue an automatic translation for every diploma / attestat and birth
-- certificate uploaded before automatic translation existed (owner,
-- 2026-10-19: "if it has not been translated, add it").
--
-- Only the newest upload of each student's slot, and only when it has not been
-- translated: nothing in the `<slot>_translation` slot, no completed job (a
-- manual one from the AI Tarjima page included) and no automatic job already
-- in flight. Jobs whose student has no foreign passport yet go to
-- 'waiting_documents' on their first run, as for any new upload.
--
-- Applied to production on 2026-10-19 through the Supabase connector:
-- 67 diplomas and 71 birth certificates queued.

with src as (
  select distinct on (d.student_id, lower(public.extract_doc_type_tag(d.name)))
         d.id, d.student_id, d.file_path, lower(public.extract_doc_type_tag(d.name)) as tag, d.created_at
    from public.documents d
   where lower(public.extract_doc_type_tag(d.name)) in ('diploma', 'birth_certificate')
   order by d.student_id, lower(public.extract_doc_type_tag(d.name)), d.created_at desc
)
insert into public.translation_jobs
  (student_id, document_type_id, source_document_id, source_file_path, auto_triggered, status, created_at)
select s.student_id, t.id, s.id, s.file_path, true, 'queued', s.created_at
  from src s
  join public.translation_document_types t on t.code = s.tag and t.is_active
 where not exists (
         select 1 from public.documents x
          where x.student_id = s.student_id
            and lower(public.extract_doc_type_tag(x.name)) = s.tag || '_translation')
   and not exists (
         select 1 from public.translation_jobs j
          where j.source_document_id = s.id
            and (j.status = 'completed'
                 or (j.auto_triggered and j.status in ('queued', 'processing', 'waiting_documents'))));
