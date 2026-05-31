-- Phase 8 (observability). One-row dashboard of pipeline health so the operator
-- can see, at a glance: how many sources/documents/cycles exist, extraction
-- success, where the review queue stands, and how much has reached the public
-- tables. security_invoker so it respects the caller's RLS (the underlying
-- tables stay protected; the service role / staff see the real numbers).
set local search_path = public, pg_catalog;

create or replace view public.v_uni_db_health
with (security_invoker = true) as
select
  (select count(*) from public.announcement_sources where status = 'live')                       as live_sources,
  (select count(*) from public.announcement_sources where notes like 'Promoted from proposed_sources%') as promoted_sources,
  (select count(*) from public.proposed_sources where status = 'pending_review')                  as proposed_pending,
  (select count(*) from public.guideline_documents)                                               as documents_total,
  (select count(*) from public.guideline_documents where parse_status = 'succeeded')              as documents_parsed,
  (select round(100.0 * count(*) filter (where status = 'succeeded') / nullif(count(*), 0), 1)
     from public.extraction_jobs where started_at > now() - interval '30 days')                   as extract_success_pct_30d,
  (select count(*) from public.review_queue where status = 'open')                                as review_open,
  (select count(*) from public.review_queue where status = 'promoted')                            as review_published,
  (select count(*) from public.review_queue where status = 'rejected')                            as review_rejected,
  (select count(*) from public.admission_cycles)                                                  as cycles,
  (select count(*) from public.requirements)                                                      as pub_requirements,
  (select count(*) from public.tuition)                                                           as pub_tuition,
  (select count(*) from public.scholarships)                                                      as pub_scholarships,
  (select count(*) from public.documents_required)                                                as pub_documents,
  (select count(*) from public.university_admission_periods)                                       as pub_periods,
  (select count(*) from public.translations)                                                      as translations,
  now()                                                                                           as as_of;

comment on view public.v_uni_db_health is
  'Phase 8 ops dashboard: pipeline counts (sources→documents→extraction→review→published→translated). One row.';
