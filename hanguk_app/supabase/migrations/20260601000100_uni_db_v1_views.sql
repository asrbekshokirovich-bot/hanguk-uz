-- ============================================================================
--  uni_db v1 — read views consumed by the Flutter app
--  Plan §C.17 / §H.1
--
--  Every Flutter read goes through a view, never a raw table, so schema
--  churn doesn't leak into the app.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  v_institutions_for_map  — replaces direct `select * from universities`
-- ----------------------------------------------------------------------------
create or replace view public.v_institutions_for_map as
select
  i.id,
  i.name_ko,
  i.name_ko_short,
  coalesce(i.display_names ->> 'en', i.name_en)            as name_en,
  coalesce(i.display_names ->> 'uz', i.name_en, i.name_ko) as name_uz,
  i.city_ko,
  i.latitude,
  i.longitude,
  i.logo_url,
  i.tier,
  i.ieqas_status,
  i.is_partner,
  i.is_visible_on_map,
  i.last_verified_at,
  (
    select min(cd.starts_at)
    from public.cycle_dates cd
    join public.admission_cycles ac on ac.id = cd.cycle_id
    where ac.institution_id = i.id
      and ac.status         = 'verified'
      and cd.event_type     in ('apply_open','apply_close')
      and cd.starts_at      > now()
  ) as next_event_at
from public.institutions i
where i.is_visible_on_map = true;

comment on view public.v_institutions_for_map is
  'Map-tab read view. Stable contract for `universitiesProvider` after Phase 1 dual-read cutover.';

-- ----------------------------------------------------------------------------
--  v_recruitment_for_interview — powers the dead `university_specific`
--                                interview path (plan §H.4)
-- ----------------------------------------------------------------------------
create or replace view public.v_recruitment_for_interview as
select
  i.id                              as institution_id,
  i.name_ko,
  i.name_en,
  ru.id                             as recruitment_unit_id,
  ru.faculty_ko,
  ru.department_ko,
  ru.major_track_ko,
  ru.faculty_group,
  ac.id                             as cycle_id,
  ac.intake_year,
  ac.intake_term,
  ac.cycle_track,
  ac.applicant_category,
  (
    select jsonb_agg(jsonb_build_object(
      'event_type', cd.event_type,
      'starts_at',  cd.starts_at
    ) order by cd.starts_at)
    from public.cycle_dates cd
    where cd.cycle_id = ac.id
  ) as upcoming_events,
  (
    select jsonb_agg(jsonb_build_object(
      'name_ko',   s.name_ko,
      'name_en',   s.name_en,
      'award_type',s.award_type,
      'award_value', s.award_value
    ))
    from public.scholarships s
    where s.institution_id = i.id
    limit 3
  ) as top_scholarships,
  (
    select jsonb_build_object(
      'topik_min_level',   r.topik_min_level,
      'english_test',      r.english_test,
      'interview_required',r.interview_required,
      'prose_ko',          r.prose_ko
    )
    from public.requirements r
    where r.cycle_id = ac.id
    limit 1
  ) as requirements_summary
from public.institutions i
join public.admission_cycles ac on ac.institution_id = i.id and ac.status = 'verified'
join public.recruitment_units ru on ru.institution_id = i.id and ru.is_active = true;

comment on view public.v_recruitment_for_interview is
  'Read view for the interview-ai Edge Function — seeds `university_specific` prompts (plan §H.4).';

-- ----------------------------------------------------------------------------
--  v_user_upcoming_deadlines — home-screen "next deadline" banner (§N)
-- ----------------------------------------------------------------------------
create or replace view public.v_user_upcoming_deadlines as
select
  utu.user_id,
  i.id                  as institution_id,
  i.name_ko,
  i.name_en,
  ac.applicant_category,
  ac.cycle_track,
  cd.event_type,
  cd.starts_at,
  cd.notes_ko
from public.user_tracked_universities utu
join public.institutions i           on i.id  = utu.institution_id
join public.admission_cycles ac      on ac.institution_id = i.id and ac.status = 'verified'
join public.cycle_dates cd           on cd.cycle_id = ac.id
where cd.starts_at > now()
  and (utu.applicant_category is null or utu.applicant_category = ac.applicant_category)
order by cd.starts_at;

comment on view public.v_user_upcoming_deadlines is
  'Per-user upcoming deadline list. RLS enforced via user_tracked_universities owner policy.';

-- ----------------------------------------------------------------------------
--  v_review_queue_dashboard — HITL Phase 1 (plan §G.1)
-- ----------------------------------------------------------------------------
create or replace view public.v_review_queue_dashboard as
select
  rq.id,
  rq.priority,
  rq.reason,
  rq.entity_type,
  rq.entity_id,
  rq.created_at,
  i.name_ko,
  i.name_en,
  gd.source_url_ko,
  gd.storage_path,
  ej.parsed_output,
  ej.accuracy_self_score
from public.review_queue rq
left join public.admission_cycles ac
       on ac.id = rq.entity_id and rq.entity_type = 'admission_cycles'
left join public.institutions i      on i.id = ac.institution_id
left join public.guideline_documents gd
       on gd.id = ac.guideline_document_id
left join public.extraction_jobs ej
       on ej.guideline_document_id = gd.id
where rq.status = 'open'
order by rq.priority asc, rq.created_at asc;

comment on view public.v_review_queue_dashboard is
  'Plan §G.1 — Studio + SQL view based HITL console v1. Reviewers UPDATE source rows directly OR mark review_queue.status=approved.';
