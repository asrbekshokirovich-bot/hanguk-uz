-- Expose field_group on v_review_queue_dashboard so the review UI can render
-- the right structured form per extraction type (calendar / tuition /
-- requirements / scholarships / documents_required) instead of a raw JSON blob.
-- Appended as the last column (CREATE OR REPLACE VIEW only allows adding at end).
create or replace view public.v_review_queue_dashboard
with (security_invoker = true) as
select
  rq.id, rq.priority, rq.reason, rq.entity_type, rq.entity_id, rq.created_at,
  coalesce(i_ej.name_ko, i_ac.name_ko, i_gd.name_ko) as name_ko,
  coalesce(i_ej.name_en, i_ac.name_en, i_gd.name_en) as name_en,
  coalesce(gd_ej.source_url_ko, gd_ac.source_url_ko, gd_direct.source_url_ko) as source_url_ko,
  coalesce(gd_ej.storage_path, gd_ac.storage_path, gd_direct.storage_path) as storage_path,
  ej.parsed_output, ej.accuracy_self_score,
  coalesce(ej.guideline_document_id, ac.guideline_document_id, gd_direct.id) as guideline_document_id,
  ej.field_group
from public.review_queue rq
  left join public.extraction_jobs ej on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  left join public.guideline_documents gd_ej on gd_ej.id = ej.guideline_document_id
  left join public.institutions i_ej on i_ej.id = gd_ej.institution_id
  left join public.admission_cycles ac on ac.id = rq.entity_id and rq.entity_type = 'admission_cycles'
  left join public.institutions i_ac on i_ac.id = ac.institution_id
  left join public.guideline_documents gd_ac on gd_ac.id = ac.guideline_document_id
  left join public.guideline_documents gd_direct on gd_direct.id = rq.entity_id and rq.entity_type = 'guideline_documents'
  left join public.institutions i_gd on i_gd.id = gd_direct.institution_id
where rq.status = 'open'
order by rq.priority, rq.created_at;
