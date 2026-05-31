-- Surface the LOWEST per-row extractor confidence on v_review_queue_dashboard
-- so the reviewer site can badge the weakest row instead of the flat
-- job-level accuracy_self_score (which historically rendered as a constant
-- "85%"). Extends the 20260523130000 view; appends one computed column at
-- the end (CREATE OR REPLACE VIEW only allows adding at the end).
--
-- Source-link contract for the website (no schema change needed — both
-- already present): `source_url_ko` is the human-readable source PAGE;
-- `storage_path` is the stored PDF object — the site mints a signed URL by
-- calling the `get-pdf-url` edge function with that path. "View source
-- page" → source_url_ko; "Open source PDF" → signed(storage_path), and the
-- PDF button is hidden when storage_path is null (no PDF resolved yet).
--
-- min_row_confidence is NULL when no row carries a numeric
-- extractor_confidence; the site then falls back to accuracy_self_score.
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
  ej.field_group,
  (
    select min((elem->>'extractor_confidence')::numeric)
    from jsonb_array_elements(
           case
             when jsonb_typeof(ej.parsed_output->'rows')   = 'array' then ej.parsed_output->'rows'
             when jsonb_typeof(ej.parsed_output->'events') = 'array' then ej.parsed_output->'events'
             else '[]'::jsonb
           end
         ) as elem
    where jsonb_typeof(elem->'extractor_confidence') = 'number'
  ) as min_row_confidence
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
