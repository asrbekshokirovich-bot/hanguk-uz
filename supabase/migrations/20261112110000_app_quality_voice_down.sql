-- The voice interview stopped for everyone and nobody on our side knew.
--
-- On 2026-11-12 the call provider (Vapi) began refusing every call: "Your
-- Wallet Balance is -0.21". The last interview that connected was at 23:18
-- the evening before; at 07:44 a client tried seven times in three minutes,
-- each ending in under a second, and gave up. The app recorded only
-- `interview_connect` {result: start_failed, error: VapiStartCallException} —
-- no reason — and nothing told the staff.
--
-- 1. `interview_connect` may now carry why a call did not start: the
--    provider's HTTP status and message (`status`, `reason`) or the kind of
--    failure underneath (`cause`). The event registry drops props it does
--    not list, so they are listed here.
-- 2. A third quality alarm, `voice_down`: within the last 6 hours at least 3
--    calls failed to start and none has reached the greeting since the first
--    of them (interviews are few: a shorter window would miss three people
--    trying once each over a morning). Once a day, to the same people as the
--    other two (the watchdog recipients, hourly through app-quality-alerts).
--    The thresholds are guards against noise, as the others are.

update public.app_event_types
   set props = '{result,ms,error,status,reason,cause}'
 where event = 'interview_connect';

alter table public.app_quality_alerts drop constraint if exists app_quality_alerts_kind_check;
alter table public.app_quality_alerts
  add constraint app_quality_alerts_kind_check check (kind in ('version_zero', 'daily_volume', 'voice_down'));

-- The function as it is in 20261030130000_app_quality_alerts.sql (the same as
-- the live one, checked by md5 on 2026-11-12), with the voice rule added.
create or replace function public.fn_app_quality_scan(p_dry boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  -- guards against noise
  c_min_devices   constant int := 5;      -- a build counts once this many devices used it
  c_expected      constant numeric := 3;  -- the old build's rate must make this many expected
  c_low           constant numeric := 0.5;
  c_high          constant numeric := 2.0;
  c_min_daily     constant int := 100;
  c_voice_fails   constant int := 3;      -- this many calls failed to start…
  c_voice_window  constant interval := interval '6 hours'; -- …within this long, none greeted since
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_found jsonb;
begin
  with builds as (
    select e.app_build as build, min(e.received_at) as first_at, count(distinct e.install_id) as devices
      from public.app_events e
      join public.app_installs i on i.install_id = e.install_id
     where e.received_at >= now() - interval '14 days' and e.app_build is not null and i.test_reason is null
     group by e.app_build
  ),
  fresh as (
    select b.build, b.devices
      from builds b
     where b.first_at between now() - interval '48 hours' and now() - interval '6 hours'
       and b.devices >= c_min_devices
  ),
  pairs as (
    select f.build as new_build, f.devices as new_devices,
           (select max(b.build) from builds b where b.build < f.build and b.devices >= c_min_devices) as old_build
      from fresh f
  ),
  old_rates as (
    select p.new_build, p.new_devices, p.old_build, ob.devices as old_devices, e.event,
           count(distinct e.install_id) as event_devices
      from pairs p
      join builds ob on ob.build = p.old_build
      join public.app_events e on e.app_build = p.old_build and e.received_at >= now() - interval '14 days'
      join public.app_installs i on i.install_id = e.install_id and i.test_reason is null
      join public.app_event_types t on t.event = e.event and t.status = 'active'
     group by p.new_build, p.new_devices, p.old_build, ob.devices, e.event
  ),
  version_zero as (
    select 'version_zero'::text as kind, o.new_build::text || ':' || o.event as key, v_today as day,
           jsonb_build_object('event', o.event, 'new_build', o.new_build, 'new_devices', o.new_devices,
                              'old_build', o.old_build, 'old_devices', o.old_devices,
                              'old_event_devices', o.event_devices,
                              'expected', round(o.event_devices::numeric / o.old_devices * o.new_devices, 1)) as detail
      from old_rates o
     where o.event_devices::numeric / o.old_devices * o.new_devices >= c_expected
       and not exists (select 1 from public.app_events e
                        where e.app_build = o.new_build and e.event = o.event
                          and e.received_at >= now() - interval '14 days')
  ),
  daily as (
    select (e.received_at at time zone 'Asia/Tashkent')::date as day, count(*) as n
      from public.app_events e
      join public.app_installs i on i.install_id = e.install_id
     where e.received_at >= ((v_today - 8)::timestamp at time zone 'Asia/Tashkent')
       and e.received_at < (v_today::timestamp at time zone 'Asia/Tashkent')
       and i.test_reason is null
     group by 1
  ),
  volume as (
    select 'daily_volume'::text as kind, 'events'::text as key, v_today - 1 as day,
           jsonb_build_object('day', v_today - 1, 'events', y.n, 'average', round(a.avg_n)) as detail
      from (select coalesce((select d.n from daily d where d.day = v_today - 1), 0) as n) y
      cross join (select coalesce(sum(d.n), 0) / 7.0 as avg_n from daily d where d.day between v_today - 8 and v_today - 2) a
     where a.avg_n >= c_min_daily and (y.n < a.avg_n * c_low or y.n > a.avg_n * c_high)
  ),
  voice_tries as (
    select e.install_id, e.received_at, e.props ->> 'result' as result,
           nullif(e.props ->> 'status', '') as status, nullif(e.props ->> 'reason', '') as reason
      from public.app_events e
     where e.event = 'interview_connect' and e.received_at >= now() - c_voice_window
  ),
  voice_fails as (
    select count(*) as fails, count(distinct t.install_id) as devices, min(t.received_at) as first_at,
           (array_agg(t.status order by t.received_at desc) filter (where t.status is not null))[1] as status,
           (array_agg(t.reason order by t.received_at desc) filter (where t.reason is not null))[1] as reason
      from voice_tries t
     where t.result = 'start_failed'
  ),
  voice as (
    select 'voice_down'::text as kind, 'interview'::text as key, v_today as day,
           jsonb_strip_nulls(jsonb_build_object(
             'fails', f.fails, 'devices', f.devices,
             'hours', round(extract(epoch from c_voice_window) / 3600),
             'status', f.status, 'reason', f.reason)) as detail
      from voice_fails f
     where f.fails >= c_voice_fails
       and not exists (select 1 from voice_tries g where g.result = 'greeted' and g.received_at > f.first_at)
  ),
  found as (
    select * from version_zero union all select * from volume union all select * from voice
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'key', f.key, 'day', f.day, 'detail', f.detail)), '[]'::jsonb)
    into v_found
    from found f;

  if p_dry then
    return v_found;
  end if;

  insert into public.app_quality_alerts (kind, key, day, detail)
  select x ->> 'kind', x ->> 'key', (x ->> 'day')::date, x -> 'detail'
    from jsonb_array_elements(v_found) x
  on conflict (kind, key, day) do nothing;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'key', a.key, 'day', a.day, 'detail', a.detail)
                     order by a.created_at)
      from public.app_quality_alerts a
     where a.sent_at is null and a.created_at >= now() - interval '3 days'), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_app_quality_scan(boolean) from public, anon, authenticated;
grant execute on function public.fn_app_quality_scan(boolean) to service_role;
