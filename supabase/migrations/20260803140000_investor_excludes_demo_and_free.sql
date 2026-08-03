-- The investor sees the season's real, revenue-generating intake.
--
-- Spring 2027 reported four signed students. One is the DEMO account created
-- for Google Play review, and two are free re-applications carried over from
-- Fall 2026 after visa refusals — already counted, and already paid for, in
-- the season they signed in. The one student the investor's stake actually
-- rests on is the fourth.
--
-- Until now the exclusion was a list of student names hardcoded in
-- useInvestor.ts. That only filtered the Applications screen — the funnel
-- count is computed in SQL and never saw it — and it breaks the moment a name
-- is edited or another demo account appears. Both exclusions become facts
-- about the row instead.

-- 1) Demo accounts. `office_location = 'Demo'` is the marker the account was
--    created with; promote it to something the schema states outright, so the
--    next demo account is flagged rather than name-matched.
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

comment on column public.profiles.is_demo is
  'Not a real student — a demo/test account (e.g. the Google Play review login). Excluded from investor-facing views. The CRM still shows them.';

update public.profiles
set is_demo = true
where is_demo = false
  and (office_location = 'Demo' or full_name ilike 'DEMO %');

-- The old blocklist held two names. One is a genuine test account and belongs
-- under the flag. The other, OMONOVA, is a real student who was being hidden
-- by name because there was no way to say what she actually is — a free
-- re-application. She is deliberately not flagged here; the rule below covers
-- her, and flagging her would misfile a paying customer as a test row.
update public.profiles
set is_demo = true
where is_demo = false
  and lower(regexp_replace(full_name, '[''’ʼ`]', '', 'g')) = 'arslanov xojamurod test';

-- 2) Funnel. "Signed" counts who committed to this season; a free
--    re-application committed to a previous one, and a demo account never did.
create or replace view public.v_investor_season_funnel as
with base as (
  select
    ik.id as intake_id,
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
        -- NOT EXISTS rather than a join: an application whose student has no
        -- profile or membership row should still be counted, not silently
        -- dropped by the exclusion.
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
  ('Signed', 1), ('Documents Ready', 2), ('Submitted', 3),
  ('Offer Received', 4), ('Visa Approved', 5), ('Departed', 6)
) s(stage, stage_order)
where investor_can_view_intake(b.intake_id);

-- 3) Applications list. Same two exclusions, so the screen and the funnel
--    agree — they disagreed before, one filtered in TypeScript and one not.
create or replace view public.v_investor_applications as
select
  a.id as application_id,
  a.intake_id,
  sp.full_name as student_name,
  sp.payment_plan as plan,
  coalesce(inst.name_en, inst.name_ko) as university,
  a.degree_level as program,
  a.status,
  a.submitted_at,
  a.updated_at,
  current_date - a.updated_at::date as days_since_movement
from applications a
left join profiles sp on sp.user_id = a.student_id
left join institutions inst on inst.id = a.institution_id
where investor_can_view_intake(a.intake_id)
  and not exists (
    select 1 from profiles p
    where p.user_id = a.student_id and p.is_demo
  )
  and not exists (
    select 1 from student_intakes si
    where si.student_id = a.student_id
      and si.intake_id = a.intake_id
      and si.is_free_reapplication
  );
