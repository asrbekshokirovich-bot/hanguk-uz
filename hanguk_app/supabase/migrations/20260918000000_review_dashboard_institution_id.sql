-- Review dashboard: expose the institution id so the queue can group by
-- university instead of by guideline document.
--
-- The triage rail keyed its cards on `guideline_document_id`, so a university
-- with three stored guidelines rendered as three separate cards — three
-- "KAIST / 한국과학기술원" entries side by side, distinguishable only by their
-- section counts. A reviewer could not tell which was which, and the same
-- institution's work was scattered across the rail.
--
-- The view already joins `institutions` three ways (via extraction_jobs,
-- admission_cycles, and a direct guideline_documents entity) but selected only
-- the names from them. This adds the id under the same COALESCE precedence, so
-- the UI gets a stable grouping key and does not have to match on name text.
--
-- Additive: every existing column keeps its name, type and position. The only
-- change is one more column at the end.
--
-- CREATE OR REPLACE, deliberately not DROP + CREATE. The live view carries
-- grants to anon, service_role and uni_db_ci alongside authenticated; a drop
-- would silently take those away and break the CI role's reads. Replacing in
-- place keeps every grant and the security_invoker option, and Postgres allows
-- it precisely because the new column is appended at the end.

create or replace view public.v_review_queue_dashboard
with (security_invoker = true)
as
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
    select min((elem.value ->> 'extractor_confidence')::numeric)
    from jsonb_array_elements(
      case
        when jsonb_typeof(ej.parsed_output -> 'rows') = 'array' then ej.parsed_output -> 'rows'
        when jsonb_typeof(ej.parsed_output -> 'events') = 'array' then ej.parsed_output -> 'events'
        else '[]'::jsonb
      end
    ) elem(value)
    where jsonb_typeof(elem.value -> 'extractor_confidence') = 'number'
  ) as min_row_confidence,
  rq.reviewer_notes,
  rq.needs_attention,
  rq.status,
  coalesce(gd_ej.academic_year, gd_ac.academic_year, gd_direct.academic_year) as doc_academic_year,
  coalesce(gd_ej.semester, gd_ac.semester, gd_direct.semester) as doc_semester,
  -- New: same COALESCE order as the names above, so the id always belongs to
  -- the institution whose name the row already shows.
  coalesce(i_ej.id, i_ac.id, i_gd.id) as institution_id
from review_queue rq
  left join extraction_jobs ej
    on ej.id = rq.entity_id and rq.entity_type = 'extraction_jobs'
  left join guideline_documents gd_ej on gd_ej.id = ej.guideline_document_id
  left join institutions i_ej on i_ej.id = gd_ej.institution_id
  left join admission_cycles ac
    on ac.id = rq.entity_id and rq.entity_type = 'admission_cycles'
  left join institutions i_ac on i_ac.id = ac.institution_id
  left join guideline_documents gd_ac on gd_ac.id = ac.guideline_document_id
  left join guideline_documents gd_direct
    on gd_direct.id = rq.entity_id and rq.entity_type = 'guideline_documents'
  left join institutions i_gd on i_gd.id = gd_direct.institution_id
where rq.status = 'open'
order by rq.priority, rq.created_at;

comment on view public.v_review_queue_dashboard is
  'Open review-queue rows joined to their institution and guideline document. '
  'institution_id is the grouping key for the triage rail: one card per '
  'university, with that university''s guideline documents nested inside.';
