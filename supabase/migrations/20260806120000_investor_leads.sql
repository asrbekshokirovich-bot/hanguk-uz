-- Leads, for the investor.
--
-- Until now the investor portal started at "Signed" — the point where a
-- student has already committed. Everything before that (who enquired, where
-- they came from, how many were lost) was staff-only, so the one number an
-- investor actually asks about — how many people are in the top of the funnel
-- and what share of them convert — was unreachable.
--
-- What is exposed here is counts only. A lead row carries a name, a phone, an
-- email and, on this schema, a plaintext `password` column; none of that is an
-- investor's business and none of it appears below. The three views return
-- aggregates per season, per source and per month, and nothing that identifies
-- a person.
--
-- security_invoker is left unset (default false) so the views run with owner
-- rights and can aggregate `leads`, which the investor cannot read directly
-- (the table's RLS grants SELECT to staff roles only, and that stays true).
-- The investor_can_view_intake() self-gate is what limits her to her own
-- seasons, exactly as in the other v_investor_* views.

-- 1) Season totals. One row per intake she may see.
create or replace view public.v_investor_season_leads as
select
  ik.id as intake_id,
  count(l.id) as total_leads,
  count(*) filter (where l.status = 'new') as new_leads,
  count(*) filter (where l.status = 'contacted') as contacted_leads,
  count(*) filter (where l.status = 'qualified') as qualified_leads,
  count(*) filter (where l.status = 'converted') as converted_leads,
  count(*) filter (where l.status = 'lost') as lost_leads,
  count(*) filter (where l.created_at >= now() - interval '30 days') as leads_last_30_days,
  -- Null rather than 0 when the season has no leads at all: "0% convert" and
  -- "nobody has enquired yet" are different facts and the UI says so.
  case when count(l.id) = 0 then null
       else round((count(*) filter (where l.status = 'converted')) * 100.0 / count(l.id), 1)
  end as conversion_pct
from public.intakes ik
left join public.leads l on l.intake_id = ik.id
where investor_can_view_intake(ik.id)
group by ik.id;

comment on view public.v_investor_season_leads is
  'Investor-facing lead counts per season. Aggregates only — no lead names, phones or emails.';

-- 2) Where the leads came from. `source` is a channel label (instagram,
--    telegram, call, manual, Public Registration), not a person.
create or replace view public.v_investor_lead_sources as
select
  l.intake_id,
  l.source,
  count(*) as lead_count,
  count(*) filter (where l.status = 'converted') as converted_count,
  round((count(*) filter (where l.status = 'converted')) * 100.0 / count(*), 1) as converted_pct
from public.leads l
where l.intake_id is not null
  and investor_can_view_intake(l.intake_id)
group by l.intake_id, l.source;

comment on view public.v_investor_lead_sources is
  'Investor-facing lead counts by acquisition channel per season. Aggregates only.';

-- 3) Intake volume by month, so the Overview can draw a trend the same way it
--    draws revenue. Bucketed on created_at — when the lead reached the CRM.
create or replace view public.v_investor_lead_monthly as
select
  l.intake_id,
  date_trunc('month', l.created_at)::date as month,
  count(*) as lead_count,
  count(*) filter (where l.status = 'converted') as converted_count
from public.leads l
where l.intake_id is not null
  and investor_can_view_intake(l.intake_id)
group by l.intake_id, date_trunc('month', l.created_at)::date;

comment on view public.v_investor_lead_monthly is
  'Investor-facing monthly lead volume per season. Aggregates only.';

grant select on public.v_investor_season_leads to authenticated;
grant select on public.v_investor_lead_sources to authenticated;
grant select on public.v_investor_lead_monthly to authenticated;

-- 4) The funnel gains its real first stage.
--
--    Stage 0, not a renumbering of the existing six: the stage_order values
--    1..6 are what the UI keys its tones and its "only Signed is recorded"
--    caption off, and shifting them would silently re-colour every stage.
--
--    Everything below stage 0 is carried over verbatim from
--    20260803140000_investor_excludes_demo_and_free.sql — the demo-account and
--    free-re-application exclusions still apply to Signed and Submitted. Leads
--    have no profile row, so neither exclusion is expressible on them; a lead
--    that converted into a demo account is a handful of rows out of hundreds
--    and filtering it would mean joining a name, which is what this migration
--    is avoiding.
create or replace view public.v_investor_season_funnel as
with base as (
  select
    ik.id as intake_id,
    (
      select count(*)
      from leads l
      where l.intake_id = ik.id
    ) as leads,
    (
      select count(*)
      from student_intakes si
      join profiles p on p.user_id = si.student_id
      where si.intake_id = ik.id
        and not p.is_demo
        and not si.is_free_reapplication
    ) as signed,
    (
      select count(*)
      from applications a
      where a.intake_id = ik.id
        and a.submitted_at is not null
        and not exists (
          select 1 from profiles p
          where p.user_id = a.student_id and p.is_demo
        )
        and not exists (
          select 1 from student_intakes si
          where si.student_id = a.student_id
            and si.intake_id = a.intake_id
            and si.is_free_reapplication
        )
    ) as submitted
  from intakes ik
)
select
  b.intake_id,
  s.stage,
  s.stage_order,
  case s.stage_order
    when 0 then b.leads
    when 1 then b.signed
    when 2 then 0::bigint
    when 3 then b.submitted
    when 4 then 0::bigint
    when 5 then 0::bigint
    when 6 then 0::bigint
    else null::bigint
  end as student_count
from base b
cross join (values
  ('Leads', 0),
  ('Signed', 1), ('Documents Ready', 2), ('Submitted', 3),
  ('Offer Received', 4), ('Visa Approved', 5), ('Departed', 6)
) s(stage, stage_order)
where investor_can_view_intake(b.intake_id);
