-- Cycle gating (correction plan, Phase 1a).
--
-- Every stored guideline document gets an explicit admission-cycle tag so the
-- pipeline (and the review UI) can tell WHICH cycle a blob actually describes,
-- instead of trusting that the crawler found the target cycle. Filled by:
--   * the guideline finder on ingest (from the Gate-0 identity verdict), and
--   * scripts/backfill_document_cycle.py for the 83 existing blobs.
--
-- academic_year is the Korean 학년도 (e.g. 2027학년도 → 2027); semester is the
-- intake term inside that 학년도: 'spring' (전기/1학기/3월 입학) or 'fall'
-- (후기/2학기/9월 입학). Both nullable — 'unknown' stays NULL rather than a
-- guessed value.

alter table public.guideline_documents
  add column if not exists academic_year smallint,
  add column if not exists semester text
    check (semester is null or semester in ('spring', 'fall'));

comment on column public.guideline_documents.academic_year is
  'Admission 학년도 the document actually describes (e.g. 2027), from the '
  'identity gate or the cycle backfill. NULL = not yet classified.';
comment on column public.guideline_documents.semester is
  'Intake term within academic_year: spring (전기/3월) or fall (후기/9월). '
  'NULL = full-year guideline or not yet classified.';

create index if not exists guideline_documents_cycle_idx
  on public.guideline_documents (academic_year, semester);

-- Expose the document cycle on the review dashboard so each queue card can
-- carry a cycle badge. Same definition as 20260901000000 plus the two
-- doc-cycle columns (view recreated wholesale; column order appended-only for
-- PostgREST compatibility).
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
  rq.reviewer_notes,
  rq.needs_attention,
  rq.status,
  -- NEW: the source document's classified admission cycle, for the UI badge.
  coalesce(gd_ej.academic_year, gd_ac.academic_year, gd_direct.academic_year) as doc_academic_year,
  coalesce(gd_ej.semester, gd_ac.semester, gd_direct.semester) as doc_semester
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
