-- ============================================================================
-- uni_db_audit.sql — read-only health/issue detectors for the university-data
-- extraction + review pipeline (v_review_queue_dashboard / extraction_jobs /
-- guideline_documents / review_queue).
--
-- All statements are SELECT-only. Run individually against the project DB
-- (read replica is fine). Nothing here mutates data. The optional view at the
-- bottom (commented out) can be created if you want a standing dashboard.
--
-- Built from the 2026-05 audit. Each query maps to a known failure mode so the
-- whole system can be re-scanned after fixes. Thresholds are conservative.
-- ============================================================================

-- 1. JOB OUTCOME SUMMARY ------------------------------------------------------
-- "succeeded" only means the LLM call returned; it does NOT mean anything was
-- extracted. This splits succeeded into has-content vs empty.
with j as (
  select status,
    (coalesce(jsonb_array_length(parsed_output->'rows'),0)
   + coalesce(jsonb_array_length(parsed_output->'events'),0)) as n_items
  from extraction_jobs
)
select status,
       (n_items > 0)                as has_content,
       count(*)                     as jobs
from j
group by status, (n_items > 0)
order by status, has_content;

-- 2. EMPTY-BUT-SUCCEEDED JOBS (queue noise) ----------------------------------
-- These return {"rows": []} yet may still be surfaced as review cards.
select field_group, count(*) as empty_succeeded
from extraction_jobs
where status = 'succeeded'
  and (coalesce(jsonb_array_length(parsed_output->'rows'),0)
     + coalesce(jsonb_array_length(parsed_output->'events'),0)) = 0
group by field_group
order by empty_succeeded desc;

-- 3. FAILED JOBS — surface the buried Anthropic error -------------------------
-- Failures are stored inside raw_output->>'_extraction_failed', NOT error_text.
-- Most are truncated-JSON ("Expecting ',' delimiter") = max_tokens cutoffs that
-- discarded real extracted data.
select field_group,
       count(*) as failed,
       count(*) filter (where raw_output::text like '%_extraction_failed%') as has_buried_error,
       count(*) filter (where error_text is not null)                       as has_error_text,
       count(*) filter (where raw_output::text like '%not valid JSON%')     as truncated_json
from extraction_jobs
where status = 'failed'
group by field_group
order by failed desc;

-- 3b. The actual failure messages (truncated for readability).
select id, field_group, left(raw_output->>'_extraction_failed', 160) as failure
from extraction_jobs
where status = 'failed'
order by created_at desc nulls last
limit 50;

-- 4. COVERAGE BY FIELD GROUP --------------------------------------------------
-- Fraction of jobs per field group that produced ANY content. tuition has been
-- 0% — confirm whether it's a source gap or an extractor bug.
with j as (
  select field_group,
    (coalesce(jsonb_array_length(parsed_output->'rows'),0)
   + coalesce(jsonb_array_length(parsed_output->'events'),0)) as n
  from extraction_jobs where status = 'succeeded'
)
select field_group,
       count(*) as jobs,
       count(*) filter (where n > 0) as with_content,
       round(100.0 * count(*) filter (where n > 0) / nullif(count(*),0), 1) as pct_with_content
from j group by field_group order by pct_with_content;

-- 5. COVERAGE BY INSTITUTION (matrix) ----------------------------------------
with j as (
  select ej.field_group, gd.institution_id,
    (coalesce(jsonb_array_length(ej.parsed_output->'rows'),0)
   + coalesce(jsonb_array_length(ej.parsed_output->'events'),0)) as n
  from extraction_jobs ej
  join guideline_documents gd on gd.id = ej.guideline_document_id
)
select i.name_en,
       count(*) filter (where j.field_group='requirements'        and j.n>0) as req,
       count(*) filter (where j.field_group='calendar'            and j.n>0) as cal,
       count(*) filter (where j.field_group='tuition'             and j.n>0) as tui,
       count(*) filter (where j.field_group='scholarships'        and j.n>0) as sch,
       count(*) filter (where j.field_group='documents_required'  and j.n>0) as doc
from j join institutions i on i.id = j.institution_id
group by i.name_en order by i.name_en;

-- 6. CONFIDENCE INTEGRITY -----------------------------------------------------
-- If empty and content jobs share the same avg self-score, the score is
-- decoupled from reality and useless for triage.
with j as (
  select (coalesce(jsonb_array_length(parsed_output->'rows'),0)
        + coalesce(jsonb_array_length(parsed_output->'events'),0)) as n,
         accuracy_self_score s
  from extraction_jobs where status='succeeded'
)
select (n>0) as has_content, count(*),
       round(avg(s),3) as avg_self_score,
       round(min(s),3) as min_s, round(max(s),3) as max_s
from j group by (n>0);

-- 7. CALENDAR event_type VOCABULARY vs UI MAPPING -----------------------------
-- Any event_type NOT in the UI's mapped set renders as "Not specified".
-- Keep the second array in sync with reviewLogic CALENDAR_SLOTS.
with mapped(t) as (
  select unnest(array[
    'apply_open','apply_close','documents_deadline','document_submission_close',
    'first_stage_results','interview','final_results',
    'registration_open','registration_close','orientation'
  ])
)
select x->>'event_type' as event_type,
       count(*) as n,
       bool_or((x->>'event_type') in (select t from mapped)) as ui_maps_it
from extraction_jobs ej,
     jsonb_array_elements(coalesce(parsed_output->'events','[]'::jsonb)) x
where field_group='calendar'
group by x->>'event_type'
order by n desc;

-- 8. KOREAN / OVERSEAS-KOREAN TRACK NOISE ------------------------------------
-- Foreign-applicant service: 외국인전형 is relevant; the rest is noise.
with r as (
  select coalesce(x->>'applicant_category','') || ' '
       || coalesce(x->>'prose_ko','') || ' '
       || coalesce(x->>'source_text_ko','') as hay
  from extraction_jobs ej,
       jsonb_array_elements(coalesce(parsed_output->'rows','[]'::jsonb)) x
  where field_group='requirements'
)
select count(*) as track_rows,
       count(*) filter (where hay ~ '외국인')                                              as foreign_relevant,
       count(*) filter (where hay ~ '재외국민|북한이탈|국외 전 교육|전교육과정|전 교육과정|귀화'
                          and hay !~ '외국인')                                              as korean_noise
from r;

-- 9. STALE CYCLES -------------------------------------------------------------
-- Calendar events bucketed by year; anything before the current year is a
-- past cycle the reviewer should be warned about.
select left(x->>'starts_at',4) as year, count(*)
from extraction_jobs ej,
     jsonb_array_elements(coalesce(parsed_output->'events','[]'::jsonb)) x
where field_group='calendar' and x->>'starts_at' ~ '^\d{4}'
group by 1 order by 1;

-- 10. TRUNCATED source_text_ko -----------------------------------------------
-- e.g. "English Proficiency T" — extraction cut off mid-phrase.
select ej.field_group, x->>'source_text_ko' as source_text
from extraction_jobs ej,
     jsonb_array_elements(coalesce(parsed_output->'rows','[]'::jsonb)) x
where x->>'source_text_ko' is not null
  and length(x->>'source_text_ko') < 25
order by length(x->>'source_text_ko');

-- 11. OPEN QUEUE POLLUTION ----------------------------------------------------
-- Open review items whose extraction is empty (should never have been queued).
select rq.id, ej.field_group
from review_queue rq
join extraction_jobs ej on ej.id = rq.entity_id and rq.entity_type='extraction_jobs'
where rq.status='open'
  and (coalesce(jsonb_array_length(ej.parsed_output->'rows'),0)
     + coalesce(jsonb_array_length(ej.parsed_output->'events'),0)) = 0;

-- 12. DOCUMENTS STUCK IN PARSE ------------------------------------------------
select id, source_url_ko, parse_status, fetched_at
from guideline_documents
where parse_status is distinct from 'succeeded'
order by fetched_at nulls first;

-- 13. INSTITUTIONS WITH ZERO DOCUMENTS (coverage gap) ------------------------
select i.id, i.name_en
from institutions i
where not exists (select 1 from guideline_documents g where g.institution_id = i.id)
order by i.name_en;

-- 14. COUNTRY-SPECIFIC DOC RULES (must be surfaced in UI, esp. UZ) -----------
select ej.id, x->>'document_type' as document_type, x->'country_specific' as country_specific
from extraction_jobs ej,
     jsonb_array_elements(coalesce(parsed_output->'rows','[]'::jsonb)) x
where field_group='documents_required'
  and x->'country_specific' is not null
  and x->'country_specific' <> '{}'::jsonb;

-- ============================================================================
-- OPTIONAL standing view (uncomment to create). Per-job health flags.
-- ============================================================================
-- create or replace view public.v_extraction_health as
-- select ej.id, gd.institution_id, ej.field_group, ej.status,
--        (coalesce(jsonb_array_length(ej.parsed_output->'rows'),0)
--       + coalesce(jsonb_array_length(ej.parsed_output->'events'),0)) as item_count,
--        ej.accuracy_self_score,
--        (ej.raw_output::text like '%_extraction_failed%')            as has_buried_error,
--        (ej.raw_output::text like '%not valid JSON%')                as truncated_json
-- from extraction_jobs ej
-- left join guideline_documents gd on gd.id = ej.guideline_document_id;
