-- Birth certificate: a parent's passport is no longer required (owner,
-- 2026-10-19). For a parent without one (e.g. deceased) the worker takes the
-- name as written on the certificate; see rules.ts.
--
-- If that parent's passport is uploaded later, the certificate's spelling is
-- no longer the best source, so the upload queues a fresh translation of the
-- newest birth certificate — only when the last automatic translation ran
-- without that parent's document, nothing is already in flight for it, and
-- no translation has been approved yet. The worker then replaces its own
-- earlier, unapproved translation.
--
-- Applied to production on 2026-10-19 through the Supabase connector.

create or replace function public.trg_documents_auto_translation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag  text := lower(public.extract_doc_type_tag(new.name));
  v_type uuid;
  v_role text;
  v_src  record;
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
  -- Translation is a convenience; it must never block an upload.
  raise warning 'auto translation enqueue failed for document %: %', new.id, sqlerrm;
  return null;
end;
$$;

-- Birth-certificate jobs that were waiting only for a parent can run now.
update public.translation_jobs j
   set status = 'queued', error_message = null
  from public.translation_document_types t
 where t.id = j.document_type_id and t.code = 'birth_certificate'
   and j.auto_triggered and j.status = 'waiting_documents';
