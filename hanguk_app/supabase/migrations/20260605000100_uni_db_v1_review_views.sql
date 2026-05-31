-- ============================================================================
--  uni_db v1 — additional HITL views for Phase 1 review console
--  Plan §G — reviewers work in Supabase Studio against these views.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  v_review_queue_by_archetype — load distribution per archetype
-- ----------------------------------------------------------------------------
create or replace view public.v_review_queue_by_archetype as
select
  ej.archetype,
  count(*) filter (where rq.status = 'open')        as open_count,
  count(*) filter (where rq.status = 'in_review')   as in_review_count,
  count(*) filter (where rq.status = 'approved')    as approved_count,
  count(*) filter (where rq.status = 'rejected')    as rejected_count,
  avg(ej.accuracy_self_score) filter (where rq.status = 'open') as avg_open_confidence
from public.review_queue rq
left join public.extraction_jobs ej
  on rq.entity_type = 'extraction_jobs'
 and rq.entity_id   = ej.id
group by ej.archetype;

comment on view public.v_review_queue_by_archetype is
  'HITL ops view: reviewer load and avg confidence per archetype.';

-- ----------------------------------------------------------------------------
--  v_review_queue_by_field_group — same broken down by field_group
-- ----------------------------------------------------------------------------
create or replace view public.v_review_queue_by_field_group as
select
  ej.field_group,
  count(*) filter (where rq.status = 'open')      as open_count,
  count(*) filter (where rq.status = 'in_review') as in_review_count,
  avg(ej.accuracy_self_score) filter (where rq.status = 'open') as avg_open_confidence
from public.review_queue rq
left join public.extraction_jobs ej
  on rq.entity_type = 'extraction_jobs'
 and rq.entity_id   = ej.id
group by ej.field_group;

-- ----------------------------------------------------------------------------
--  v_review_queue_overdue — open items aged beyond their priority budget
--  Priority 1: 4h, P2: 12h, P3: 24h, P4: 48h, P5: 96h.
-- ----------------------------------------------------------------------------
create or replace view public.v_review_queue_overdue as
select
  rq.id,
  rq.priority,
  rq.reason,
  rq.entity_type,
  rq.entity_id,
  rq.created_at,
  age(now(), rq.created_at)                                as age,
  case rq.priority
    when 1 then interval '4 hours'
    when 2 then interval '12 hours'
    when 3 then interval '24 hours'
    when 4 then interval '48 hours'
    else        interval '96 hours'
  end                                                       as budget,
  i.name_ko,
  i.name_en
from public.review_queue rq
left join public.extraction_jobs ej
  on rq.entity_type = 'extraction_jobs' and rq.entity_id = ej.id
left join public.guideline_documents gd
  on gd.id = ej.guideline_document_id
left join public.institutions i
  on i.id = gd.institution_id
where rq.status = 'open'
  and now() - rq.created_at > case rq.priority
    when 1 then interval '4 hours'
    when 2 then interval '12 hours'
    when 3 then interval '24 hours'
    when 4 then interval '48 hours'
    else        interval '96 hours'
  end
order by rq.priority, rq.created_at;

comment on view public.v_review_queue_overdue is
  'HITL escalation view — items past their priority-budget age.';

-- ----------------------------------------------------------------------------
--  v_extraction_accuracy_by_archetype — Phase-1 KPI tracker (plan §M)
-- ----------------------------------------------------------------------------
create or replace view public.v_extraction_accuracy_by_archetype as
with decisions as (
  select
    rd.review_queue_id,
    rd.decision,
    ej.archetype
  from public.review_decisions rd
  join public.review_queue rq on rq.id = rd.review_queue_id
  join public.extraction_jobs ej
    on rq.entity_type = 'extraction_jobs' and rq.entity_id = ej.id
)
select
  archetype,
  count(*)                                                    as total_decided,
  count(*) filter (where decision = 'approved_as_is')         as approved_as_is,
  count(*) filter (where decision = 'approved_with_edits')    as approved_with_edits,
  count(*) filter (where decision = 'rejected')               as rejected,
  round(
    100.0 * count(*) filter (where decision = 'approved_as_is')
    / nullif(count(*), 0),
    1
  )                                                           as approved_as_is_pct
from decisions
group by archetype;

comment on view public.v_extraction_accuracy_by_archetype is
  'Plan §M Phase-1 target: >= 70% approved_as_is. Tracked per archetype.';
