-- Ushlab qolish rejasi P01 (U0.1): classic day-N return, guest and student
-- apart — the numbers the retention plan was written from (2026-11-06).
--
-- * A visit day: a day (Tashkent) on which the device opened the app and
--   looked at something — app_open, session_start, app_resume, screen_view,
--   tap or tab_open. Background-only days (a push received, an error) do
--   not count.
-- * Day 0 = the device's first visit day. N-day return = a visit on day 0 + N
--   exactly (the Adjust definition); "within 7" = a visit on any of days 1–7.
-- * A cohort is counted for day N only once day 0 + N is over, so a young
--   cohort never shows a falsely low share.
-- * Audience: 'talaba' = a device that signed in with a student account
--   (app_installs.user_id), 'mehmon' = the rest. Test devices left out unless
--   asked for.
--
-- analytics_retention_v2(from, to, include_test) → one row per cohort week
-- (Monday) and audience, plus 'jami' rows over the whole range.

create or replace function public.analytics_retention_v2(
  p_from date default null, p_to date default null, p_include_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_from  date := coalesce(p_from, v_today - 56);
  v_to    date := least(coalesce(p_to, v_today), v_today);
  v_out   jsonb;
begin
  if not (public.app_events_staff_can_read() or auth.role() = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with inst as (
    select i.install_id, case when i.user_id is not null then 'talaba' else 'mehmon' end as aud
      from public.app_installs i
     where p_include_test or i.test_reason is null
  ),
  v as (
    select distinct e.install_id, (e.occurred_at at time zone 'Asia/Tashkent')::date as d
      from public.app_events e
      join inst using (install_id)
     where e.event in ('app_open', 'session_start', 'app_resume', 'screen_view', 'tap', 'tab_open')
       and e.occurred_at >= (v_from::timestamp at time zone 'Asia/Tashkent')
  ),
  first_day as (
    -- the first visit ever, not the first in the range: a device that came
    -- before v_from is not a new device
    select e.install_id, min((e.occurred_at at time zone 'Asia/Tashkent')::date) as d0
      from public.app_events e
      join inst using (install_id)
     where e.event in ('app_open', 'session_start', 'app_resume', 'screen_view', 'tap', 'tab_open')
     group by e.install_id
  ),
  x as (
    select f.install_id, f.d0, i.aud,
           bool_or(v.d = f.d0 + 1)  as d1,
           bool_or(v.d = f.d0 + 3)  as d3,
           bool_or(v.d = f.d0 + 7)  as d7,
           bool_or(v.d = f.d0 + 14) as d14,
           bool_or(v.d = f.d0 + 30) as d30,
           bool_or(v.d between f.d0 + 1 and f.d0 + 7) as w7
      from first_day f
      join inst i using (install_id)
      left join v using (install_id)
     where f.d0 between v_from and v_to
     group by f.install_id, f.d0, i.aud
  ),
  rows_ as (
    select date_trunc('week', d0::timestamp)::date as week, aud, d0, d1, d3, d7, d14, d30, w7 from x
    union all
    select null, aud, d0, d1, d3, d7, d14, d30, w7 from x
  ),
  agg as (
    select week, aud,
           count(*) as devices,
           count(*) filter (where d0 + 1 < v_today)  as d1_base,  count(*) filter (where d0 + 1 < v_today and d1)   as d1,
           count(*) filter (where d0 + 3 < v_today)  as d3_base,  count(*) filter (where d0 + 3 < v_today and d3)   as d3,
           count(*) filter (where d0 + 7 < v_today)  as d7_base,  count(*) filter (where d0 + 7 < v_today and d7)   as d7,
           count(*) filter (where d0 + 7 < v_today and w7) as w7,
           count(*) filter (where d0 + 14 < v_today) as d14_base, count(*) filter (where d0 + 14 < v_today and d14) as d14,
           count(*) filter (where d0 + 30 < v_today) as d30_base, count(*) filter (where d0 + 30 < v_today and d30) as d30
      from rows_
     group by week, aud
  )
  select jsonb_build_object(
           'from', v_from, 'to', v_to,
           'rows', coalesce(jsonb_agg(jsonb_build_object(
             'week', a.week, 'audience', a.aud, 'devices', a.devices,
             'd1', a.d1, 'd1_base', a.d1_base, 'd3', a.d3, 'd3_base', a.d3_base,
             'd7', a.d7, 'd7_base', a.d7_base, 'w7', a.w7,
             'd14', a.d14, 'd14_base', a.d14_base, 'd30', a.d30, 'd30_base', a.d30_base)
             order by a.week nulls last, a.aud), '[]'::jsonb),
           -- the reference line the CRM draws: Adjust, education apps, Q1 2023
           -- (https://www.adjust.com/blog/educational-app-trends-insights-strategies/)
           'benchmark', jsonb_build_object('source', 'Adjust, ta''lim ilovalari, 2023 1-chorak',
                                           'd1', 18, 'd3', 11, 'd7', 8, 'd30', 4))
    into v_out
    from agg a;
  return v_out;
end;
$$;

revoke all on function public.analytics_retention_v2(date, date, boolean) from public, anon;
grant execute on function public.analytics_retention_v2(date, date, boolean) to authenticated, service_role;
