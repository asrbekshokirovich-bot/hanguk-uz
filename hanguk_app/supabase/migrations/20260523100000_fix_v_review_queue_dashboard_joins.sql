-- ============================================================================
--  Fix: v_review_queue_dashboard joined the wrong entity type
--
--  The dashboard view joined review_queue → admission_cycles on
--  rq.entity_type = 'admission_cycles', then chained to institutions /
--  guideline_documents / extraction_jobs. But the parse worker enqueues
--  review items with entity_type = 'extraction_jobs' (entity_id = the
--  extraction_jobs row), and the degree-split flag uses
--  entity_type = 'guideline_documents'. So the join never matched and EVERY
--  column sourced from the joins (name_ko, name_en, source_url_ko,
--  storage_path, parsed_output, accuracy_self_score) came back NULL — the
--  web/app review screen showed "Unknown institution" and an empty payload
--  for every item, including the valid ones.
--
--  Fix: resolve the joins per entity_type:
--    - extraction_jobs    → extraction_jobs → guideline_documents → institutions
--    - admission_cycles   → admission_cycles → institutions / guideline_documents
--    - guideline_documents→ guideline_documents → institutions   (degree-split flag)
--  and COALESCE the institution / source columns across those paths.
--
--  Kept security_invoker so the reviewer RLS policies (fn_can_review_uni_db)
--  continue to gate who can read the underlying rows.
-- ============================================================================

set local search_path = public, pg_catalog;

create or replace view public.v_review_queue_dashboard
with (security_invoker = true) as
select
  rq.id,
  rq.priority,
  rq.reason,
  rq.entity_type,
  rq.entity_id,
  rq.created_at,
  coalesce(i_ej.name_ko, i_ac.name_ko, i_gd.name_ko) as name_ko,
  coalesce(i_ej.name_en, i_ac.name_en, i_gd.name_en) as name_en,
  coalesce(gd_ej.source_url_ko, gd_ac.source_url_ko, gd_direct.source_url_ko) as source_url_ko,
  coalesce(gd_ej.storage_path, gd_ac.storage_path, gd_direct.storage_path) as storage_path,
  ej.parsed_output,
  ej.accuracy_self_score
from public.review_queue rq
  -- extraction_jobs path (what the parse worker enqueues)
  left join public.extraction_jobs ej
    on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  left join public.guideline_documents gd_ej on gd_ej.id = ej.guideline_document_id
  left join public.institutions i_ej on i_ej.id = gd_ej.institution_id
  -- admission_cycles path (forward-compat)
  left join public.admission_cycles ac
    on ac.id = rq.entity_id and rq.entity_type = 'admission_cycles'
  left join public.institutions i_ac on i_ac.id = ac.institution_id
  left join public.guideline_documents gd_ac on gd_ac.id = ac.guideline_document_id
  -- guideline_documents path (degree-split flag)
  left join public.guideline_documents gd_direct
    on gd_direct.id = rq.entity_id and rq.entity_type = 'guideline_documents'
  left join public.institutions i_gd on i_gd.id = gd_direct.institution_id
where rq.status = 'open'
order by rq.priority, rq.created_at;
