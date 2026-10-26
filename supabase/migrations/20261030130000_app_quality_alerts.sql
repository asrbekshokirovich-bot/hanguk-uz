-- The app's quality alarms (plan v2, section 11 «Versiya nazorati» and
-- stage 6 db/anomaly-alerts): two things that mean the numbers can no
-- longer be trusted, sent to the boss on Telegram by app-quality-alerts
-- (hourly):
--   * version_zero — a new build, in its first two days, sends none of an
--     event the build before it sent (the K15 case: the filter stopped
--     reporting and nobody noticed). Only events the registry has as active,
--     and only when the old build's rate makes at least 3 expected on the
--     new one — so a rare event on a few devices is not an alarm.
--   * daily_volume — yesterday's events (test devices aside) are under half
--     or over twice the 7 days before it, when those averaged 100 or more.
-- One alarm per kind, subject and day. The thresholds are guards against
-- noise, not business numbers; they are named below.

create table if not exists public.app_quality_alerts (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('version_zero', 'daily_volume')),
  key        text not null,
  day        date not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (kind, key, day)
);

alter table public.app_quality_alerts enable row level security;
drop policy if exists app_quality_alerts_staff_read on public.app_quality_alerts;
create policy app_quality_alerts_staff_read on public.app_quality_alerts for select to authenticated
  using (public.app_events_staff_can_read());

-- Finds the alarms of the last hours, keeps the new ones and hands back
-- everything not sent yet. p_dry: what it would find, nothing kept.
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
  found as (
    select * from version_zero union all select * from volume
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

-- Hourly at :07, with the project's secret key (as weekly-app-report).
select cron.schedule(
  'app-quality-alerts-hourly',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/app-quality-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000)
  $cron$
);
