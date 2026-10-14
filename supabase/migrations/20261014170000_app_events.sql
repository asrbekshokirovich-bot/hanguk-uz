-- App usage events: which screens a person opens and which buttons they press
-- in the student app, so the CRM can show a lead's or a student's path through
-- the app and a summary of how the app is used.
--
-- * app_installs: one row per app installation (a random id the app makes on
--   first launch). It is tied to the signed-in student (auth.uid() when the
--   app sends events) and to the lead the guest created, once the app proves
--   it with that lead's link code (app_install_link_lead).
-- * app_events: the events themselves. What is recorded is only *what was
--   done* (screen, action, university id, a choice made). Typed text,
--   passwords, client codes, phone numbers and the assessment's figures are
--   never sent.
--
-- The app writes only through app_events_log (validated, at most 50 events
-- per call, at most 2000 per installation per hour). Staff who work with
-- leads and students read; nobody else does, the app included.

create table if not exists public.app_installs (
  install_id    uuid primary key,
  user_id       uuid references auth.users (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,
  platform      text,
  app_version   text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists app_installs_user_idx on public.app_installs (user_id) where user_id is not null;
create index if not exists app_installs_lead_idx on public.app_installs (lead_id) where lead_id is not null;

create table if not exists public.app_events (
  id          bigint generated always as identity primary key,
  install_id  uuid not null references public.app_installs (install_id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  event       text not null check (event ~ '^[a-z][a-z0-9_]{1,47}$'),
  screen      text check (screen is null or length(screen) <= 80),
  props       jsonb not null default '{}'::jsonb
                check (jsonb_typeof(props) = 'object' and length(props::text) <= 2000),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists app_events_install_idx on public.app_events (install_id, occurred_at desc);
create index if not exists app_events_user_idx on public.app_events (user_id, occurred_at desc) where user_id is not null;
create index if not exists app_events_event_idx on public.app_events (event, occurred_at desc);
create index if not exists app_events_received_idx on public.app_events (install_id, received_at desc);

alter table public.app_installs enable row level security;
alter table public.app_events enable row level security;

drop policy if exists "app_installs_staff_read" on public.app_installs;
create policy "app_installs_staff_read" on public.app_installs
  for select to authenticated
  using (
    not public.is_investor() and exists (
      select 1 from public.user_roles r
       where r.user_id = (select auth.uid())
         and r.role = any (array['owner', 'admin', 'call_operator', 'document_handler']::public.app_role[])
    )
  );

drop policy if exists "app_events_staff_read" on public.app_events;
create policy "app_events_staff_read" on public.app_events
  for select to authenticated
  using (
    not public.is_investor() and exists (
      select 1 from public.user_roles r
       where r.user_id = (select auth.uid())
         and r.role = any (array['owner', 'admin', 'call_operator', 'document_handler']::public.app_role[])
    )
  );

revoke all on public.app_installs from anon, authenticated;
revoke all on public.app_events from anon, authenticated;
grant select on public.app_installs to authenticated;
grant select on public.app_events to authenticated;

-- The app's only way in. p_events: [{event, screen?, props?, at?}, ...].
-- Invalid entries are skipped, not failed: a bad event must never cost the
-- good ones next to it. Returns how many were stored.
create or replace function public.app_events_log(
  p_install_id  uuid,
  p_platform    text,
  p_app_version text,
  p_events      jsonb
) returns int
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_recent int;
  v_count  int;
begin
  if p_install_id is null or p_events is null or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) = 0 or jsonb_array_length(p_events) > 50 then
    return 0;
  end if;

  select count(*) into v_recent
    from public.app_events e
   where e.install_id = p_install_id and e.received_at > now() - interval '1 hour';
  if v_recent >= 2000 then
    return 0;
  end if;

  insert into public.app_installs as i (install_id, user_id, platform, app_version)
  values (
    p_install_id,
    v_uid,
    case when p_platform in ('android', 'ios', 'web') then p_platform else 'other' end,
    left(nullif(btrim(coalesce(p_app_version, '')), ''), 40)
  )
  on conflict (install_id) do update
     set user_id = coalesce(excluded.user_id, i.user_id),
         platform = excluded.platform,
         app_version = coalesce(excluded.app_version, i.app_version),
         last_seen_at = now();

  insert into public.app_events (install_id, user_id, event, screen, props, occurred_at)
  select p_install_id,
         v_uid,
         x ->> 'event',
         left(nullif(btrim(coalesce(x ->> 'screen', '')), ''), 80),
         case when jsonb_typeof(x -> 'props') = 'object' and length((x -> 'props')::text) <= 2000
              then x -> 'props' else '{}'::jsonb end,
         case when (x ->> 'at') ~ '^\d{4}-\d{2}-\d{2}T'
                   and (x ->> 'at')::timestamptz between now() - interval '30 days' and now() + interval '5 minutes'
              then (x ->> 'at')::timestamptz else now() end
    from jsonb_array_elements(p_events) as x
   where jsonb_typeof(x) = 'object'
     and coalesce(x ->> 'event', '') ~ '^[a-z][a-z0-9_]{1,47}$';
  get diagnostics v_count = row_count;
  return v_count;
exception when others then
  -- Telemetry never fails the app: a bad timestamp or the like drops the batch.
  return 0;
end;
$$;

revoke all on function public.app_events_log(uuid, text, text, jsonb) from public;
grant execute on function public.app_events_log(uuid, text, text, jsonb) to anon, authenticated;

-- Ties an installation to the lead its guest created: the app sends the link
-- code app_quiz_submit returned, which only that guest has.
create or replace function public.app_install_link_lead(
  p_install_id uuid,
  p_link_code  text
) returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_lead uuid;
begin
  if p_install_id is null or coalesce(btrim(p_link_code), '') = '' then
    return false;
  end if;
  select l.id into v_lead from public.leads l where l.link_code = lower(btrim(p_link_code)) limit 1;
  if v_lead is null then
    return false;
  end if;
  insert into public.app_installs as i (install_id, lead_id)
  values (p_install_id, v_lead)
  on conflict (install_id) do update set lead_id = excluded.lead_id, last_seen_at = now();
  return true;
end;
$$;

revoke all on function public.app_install_link_lead(uuid, text) from public;
grant execute on function public.app_install_link_lead(uuid, text) to anon, authenticated;

-- The CRM's summary of the last p_days days. Staff only.
create or replace function public.app_events_summary(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)));
  v_out  jsonb;
begin
  if public.is_investor() or not exists (
    select 1 from public.user_roles r
     where r.user_id = auth.uid()
       and r.role = any (array['owner', 'admin', 'call_operator', 'document_handler']::public.app_role[])
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with ev as (
    select * from public.app_events e where e.occurred_at >= v_from
  )
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 7), 90)),
    'devices', (select count(distinct install_id) from ev),
    'signed_in_devices', (select count(distinct install_id) from ev where user_id is not null),
    'new_devices', (select count(*) from public.app_installs i where i.first_seen_at >= v_from),
    'events', (select count(*) from ev),
    'by_event', coalesce((
      select jsonb_agg(jsonb_build_object('event', event, 'n', n, 'devices', d) order by n desc)
        from (select event, count(*) n, count(distinct install_id) d from ev group by event) s
    ), '[]'::jsonb),
    'by_screen', coalesce((
      select jsonb_agg(jsonb_build_object('screen', screen, 'n', n, 'devices', d) order by n desc)
        from (select screen, count(*) n, count(distinct install_id) d
                from ev where event = 'screen_view' and screen is not null
               group by screen order by count(*) desc limit 20) s
    ), '[]'::jsonb),
    'funnel', (
      select jsonb_agg(jsonb_build_object('event', f.event, 'devices',
               (select count(distinct install_id) from ev where ev.event = f.event)) order by f.ord)
        from (values (1, 'app_open'), (2, 'university_open'), (3, 'university_save'),
                     (4, 'assessment_start'), (5, 'report_view'), (6, 'lead_submit')) as f(ord, event)
    ),
    'top_saved', coalesce((
      select jsonb_agg(jsonb_build_object('institution_id', s.iid, 'name', coalesce(i.name_en, i.name_ko), 'devices', s.d)
                       order by s.d desc)
        from (select props ->> 'institution_id' iid, count(distinct install_id) d
                from ev where event = 'university_save' and props ? 'institution_id'
               group by 1 order by 2 desc limit 10) s
        left join public.institutions i on i.id::text = s.iid
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'devices', d) order by day)
        from (select (occurred_at at time zone 'Asia/Tashkent')::date day, count(distinct install_id) d
                from ev group by 1) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

revoke all on function public.app_events_summary(int) from public;
grant execute on function public.app_events_summary(int) to authenticated;
