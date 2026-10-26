-- "Ilova faolligi" (CRM) numbers that match what the app actually sends
-- (22-Oct app report, K1–K5, K7). Same signature as before, so the page that
-- is live keeps working until the new one is deployed.
--
-- * K1 — the ♥ on the Universitetlar list and the university page is
--   `slot_set`; `university_save` came from a card stack no longer in the app.
--   "Picked" counts both.
-- * K2 — no current version sends `assessment_start`, so the funnel's fourth
--   step is "intent": a ♥, a started assessment (new versions), or the
--   university assessment page opened. Reports can be reached without it, so
--   the step no longer sits above the report as if it had to come first.
-- * K3 — signed-in people and their devices are counted apart; demo accounts
--   are counted so the page can say so.
-- * K5 — the last step is the consultant request (lead_submit with status ok).
-- * K7 — `sections`: the bottom-nav sections people were in. The shell routes
--   ('/' and '/guest') are not screens; '/guest' opens on the round button's
--   home and a signed-in '/' on Ariza, and every other section is a tab_open.
--   '/' is also what every launch passes through before the language and
--   auth checks redirect, so it is left out of `by_screen`.

create or replace function public.app_events_summary(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 7), 90));
  v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)));
  v_out  jsonb;
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with ev as (
    select * from public.app_events e where e.occurred_at >= v_from
  ),
  dev as (
    select install_id,
           bool_or(event = 'app_open') as opened,
           bool_or(event not in ('app_open', 'screen_view', 'language_set')) as active,
           bool_or(event = 'university_open') as uni,
           bool_or(event in ('slot_set', 'university_save', 'assessment_start')
                   or (event = 'screen_view' and screen in ('/university/:id/assess', '/assess'))) as intent,
           bool_or(event = 'report_view') as report,
           bool_or(event = 'screen_view' and screen = '/assess/lead') as lead_form,
           bool_or(event = 'lead_submit' and props ->> 'status' = 'ok') as lead_ok
      from ev
     group by install_id
  ),
  sec as (
    select case
             when event = 'tab_open' then coalesce(nullif(props ->> 'tab', ''), '?')
             when screen = '/guest' then 'home'
             else 'application'
           end as section,
           install_id
      from ev
     where event = 'tab_open'
        or (event = 'screen_view' and screen = '/guest')
        or (event = 'screen_view' and screen = '/' and user_id is not null)
  ),
  picked as (
    select props ->> 'institution_id' as iid, install_id
      from ev
     where event in ('slot_set', 'university_save') and props ? 'institution_id'
  )
  select jsonb_build_object(
    'days', v_days,
    'devices', (select count(*) from dev),
    'people', (select count(distinct user_id) from ev where user_id is not null),
    'demo_people', (select count(distinct ev.user_id) from ev join public.profiles p on p.user_id = ev.user_id where p.is_demo),
    'signed_in_devices', (select count(distinct install_id) from ev where user_id is not null),
    'new_devices', (select count(*) from public.app_installs i where i.first_seen_at >= v_from),
    'tracking_since', (select min(i.first_seen_at) from public.app_installs i),
    'events', (select count(*) from ev),
    'by_event', coalesce((
      select jsonb_agg(jsonb_build_object('event', event, 'n', n, 'devices', d) order by n desc)
        from (select event, count(*) n, count(distinct install_id) d from ev group by event) s
    ), '[]'::jsonb),
    'by_screen', coalesce((
      select jsonb_agg(jsonb_build_object('screen', screen, 'n', n, 'devices', d) order by n desc)
        from (select screen, count(*) n, count(distinct install_id) d
                from ev
               where event = 'screen_view' and screen is not null and screen not in ('/', '/guest')
               group by screen order by count(*) desc limit 20) s
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('section', section, 'n', n, 'devices', d) order by d desc, n desc)
        from (select section, count(*) n, count(distinct install_id) d from sec group by section) s
    ), '[]'::jsonb),
    -- Each step counts the devices that reached it at least once in the period.
    'funnel', jsonb_build_array(
      jsonb_build_object('event', 'app_open',        'devices', (select count(*) from dev where opened)),
      jsonb_build_object('event', 'active',          'devices', (select count(*) from dev where active)),
      jsonb_build_object('event', 'university_open', 'devices', (select count(*) from dev where uni)),
      jsonb_build_object('event', 'intent',          'devices', (select count(*) from dev where intent)),
      jsonb_build_object('event', 'report_view',     'devices', (select count(*) from dev where report)),
      jsonb_build_object('event', 'lead_form',       'devices', (select count(*) from dev where lead_form)),
      jsonb_build_object('event', 'lead_submit',     'devices', (select count(*) from dev where lead_ok))
    ),
    'top_picked', coalesce((
      select jsonb_agg(jsonb_build_object('institution_id', s.iid, 'name', coalesce(i.name_en, i.name_ko), 'devices', s.d)
                       order by s.d desc)
        from (select iid, count(distinct install_id) d from picked group by 1 order by 2 desc limit 10) s
        left join public.institutions i on i.id::text = s.iid
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', s.on_day, 'devices', s.d, 'new', coalesce(n.k, 0)) order by s.on_day)
        from (select (occurred_at at time zone 'Asia/Tashkent')::date as on_day, count(distinct install_id) as d
                from ev group by 1) s
        left join (select (i.first_seen_at at time zone 'Asia/Tashkent')::date as on_day, count(*) as k
                     from public.app_installs i where i.first_seen_at >= v_from group by 1) n
          on n.on_day = s.on_day
    ), '[]'::jsonb)
  ) into v_out;

  -- The page that was live before this migration reads `top_saved`.
  return v_out || jsonb_build_object('top_saved', v_out -> 'top_picked');
end;
$$;

revoke all on function public.app_events_summary(int) from public, anon;
grant execute on function public.app_events_summary(int) to authenticated;
