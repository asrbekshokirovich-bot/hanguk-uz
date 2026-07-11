-- ============================================================================
-- Review dashboard: surface the reliability report + fix the entity-type joins
--
-- Two problems this fixes on public.v_review_queue_dashboard:
--
-- 1. The June-1 rewrite (20260601000100_uni_db_v1_views.sql) REGRESSED the view
--    to join only the `admission_cycles` path. The parse worker enqueues review
--    items with entity_type='extraction_jobs' (and the degree-split flag uses
--    'guideline_documents'), so every one of those rows came back with NULL
--    institution / source / payload — i.e. "Unknown institution" + empty data
--    for exactly the human-approval items this feature creates. We restore the
--    multi-entity COALESCE joins from 20260523100000/150000.
--
-- 2. The reliability gauntlet stores its green/amber/red verdict in
--    review_queue.reviewer_notes (prefixed "[RED]/[AMBER]/[GREEN] …") and flags
--    red items with needs_attention. Neither column was ever projected by this
--    view, so the approval UI could not show the verdict. We append
--    reviewer_notes, needs_attention, and status.
--
-- security_invoker=true is restored so the reviewer RLS policies
-- (fn_can_review_uni_db) continue to gate which underlying rows are visible.
-- DROP+CREATE (not CREATE OR REPLACE) so the column set is deterministic
-- regardless of whichever historical definition is currently live.
-- ============================================================================

set local search_path = public, pg_catalog;

drop view if exists public.v_review_queue_dashboard;

create view public.v_review_queue_dashboard
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
  ej.accuracy_self_score,
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
  ) as min_row_confidence,
  -- NEW: the reliability gauntlet's verdict + flag, for the approval UI.
  rq.reviewer_notes,
  rq.needs_attention,
  rq.status
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

grant select on public.v_review_queue_dashboard to authenticated;
