-- App analytics: what the counts must not take for people (owner's audit of
-- «Ilova analitikasi», 2026-10-29).
--
-- 1. Emulators. Two Android emulators («Google sdk_gphone64_arm64»,
--    «Google sdk_gphone_arm64») ran the app's automated tests on 28 October
--    with a store build, so nothing marked them: one of them alone made 41 of
--    the 54 visits on «Oqim». An emulator or a simulator is a developer's
--    device whatever build it runs — it is marked 'dev' when it reports in,
--    unless a person has already decided about that device (test_marked_by).
--
-- 2. Guest test accounts. A guest who takes a university's Study Plan or
--    interview test gets a user of their own, "guest-<uuid>@hanguk.local",
--    marked guest in app_metadata (guest-test-session). It has no profile and
--    the app treats it as a guest — but its events carried that user id, so
--    the analytics took it for a signed-in client: «Talaba · Android» with no
--    name on «Odamlar», counted among «Kirgan mijozlar», «mijoz» in the cuts.
--    Such a user id is no longer stored with an event or a device, and the
--    ones stored so far are cleared (the device stays, as a guest).
--
-- 3. A funnel step that is a screen ('screen:/guest') also matches that
--    screen's tabs ('/guest#home'): from 1.1.2 the app writes the tab, so the
--    step missed every device on the new version.

-- 1. Emulators -------------------------------------------------------------------------
-- Android's emulator images report "sdk_gphone…" or "Android SDK built for…"
-- as the model; on an iOS simulator utsname.machine is the computer's
-- architecture, not "iPhone15,2".
create or replace function public.fn_app_is_emulator(p_platform text, p_model text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(
    (p_platform = 'android' and p_model ~* '(sdk_gphone|android sdk built for)')
    or (p_platform = 'ios' and p_model in ('x86_64', 'arm64', 'i386')),
    false);
$$;

create or replace function public.trg_app_install_emulator()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.test_reason is null and new.test_marked_by is null
     and public.fn_app_is_emulator(new.platform, new.model) then
    new.test_reason := 'dev';
    new.test_marked_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists app_install_emulator on public.app_installs;
create trigger app_install_emulator
  before insert or update of platform, model, test_reason on public.app_installs
  for each row execute function public.trg_app_install_emulator();

-- 2. Guest test accounts -----------------------------------------------------------------
create or replace function public.fn_is_guest_account(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select p_user is not null and exists (
    select 1 from auth.users u
     where u.id = p_user and coalesce(u.raw_app_meta_data ->> 'guest', '') = 'true');
$$;

revoke all on function public.fn_is_guest_account(uuid) from public, anon, authenticated;

-- For app_events and app_installs alike: a guest account's id is not kept.
create or replace function public.trg_app_guest_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.user_id is not null and public.fn_is_guest_account(new.user_id) then
    new.user_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists app_events_guest_user on public.app_events;
create trigger app_events_guest_user
  before insert or update of user_id on public.app_events
  for each row execute function public.trg_app_guest_user();

drop trigger if exists app_installs_guest_user on public.app_installs;
create trigger app_installs_guest_user
  before insert or update of user_id on public.app_installs
  for each row execute function public.trg_app_guest_user();

-- 3. The funnel's screen steps --------------------------------------------------------------
create or replace function public.analytics_funnel_custom(
  p_from date, p_to date, p_steps text[], p_include_test boolean default false, p_seg jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_t0  timestamptz := p_from::timestamp at time zone 'Asia/Tashkent';
  v_t1  timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Tashkent';
  v_n   int := coalesce(array_length(p_steps, 1), 0);
  v_out jsonb;
begin
  if not (public.app_events_staff_can_read() or auth.role() = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'bad period' using errcode = '22023';
  end if;
  if v_n < 2 or v_n > 8 or exists (select 1 from unnest(p_steps) x where coalesce(btrim(x), '') = '') then
    raise exception 'bad steps' using errcode = '22023';
  end if;
  with recursive dev as (
    select d.install_id from public.fn_app_devices(p_include_test, public.fn_app_segment(p_seg), v_t0, v_t1) d
  ),
  -- each event under every step it is: its name, or 'screen:' and the screen —
  -- the whole screen ('/guest#home') or the route without its tab ('/guest')
  ev as (
    select distinct e.install_id, e.occurred_at, s.k
      from public.app_events e
      join dev on dev.install_id = e.install_id
      cross join lateral (
        select x.k from unnest(p_steps) x(k)
         where x.k = e.event
            or (e.event = 'screen_view' and e.screen is not null
                and (x.k = 'screen:' || e.screen or x.k = 'screen:' || split_part(e.screen, '#', 1)))) s
     where e.occurred_at >= v_t0 and e.occurred_at < v_t1
       and (e.event = any (p_steps) or e.event = 'screen_view')
  ),
  reach (step, install_id, t) as (
    select 1, ev.install_id, min(ev.occurred_at) from ev where ev.k = p_steps[1] group by ev.install_id
    union all
    select r.step + 1, r.install_id, nx.t
      from reach r
      cross join lateral (select min(e2.occurred_at) as t
                            from ev e2
                           where e2.install_id = r.install_id and e2.k = p_steps[r.step + 1]
                             and e2.occurred_at > r.t) nx
     where r.step < v_n and nx.t is not null
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'steps', (select jsonb_agg(jsonb_build_object('key', p_steps[i], 'devices',
                                                  (select count(*) from reach r where r.step = i)) order by i)
                from generate_series(1, v_n) i))
    into v_out;
  return v_out;
end;
$$;

revoke all on function public.analytics_funnel_custom(date, date, text[], boolean, jsonb) from public, anon;
grant execute on function public.analytics_funnel_custom(date, date, text[], boolean, jsonb) to authenticated, service_role;

-- 4. What is stored so far -------------------------------------------------------------------
-- Emulators not decided about by a person: marked as test, with their visits
-- and days (as app_install_mark_test does).
with emu as (
  update public.app_installs i
     set test_reason = 'dev', test_marked_at = now()
   where i.test_reason is null and i.test_marked_by is null
     and public.fn_app_is_emulator(i.platform, i.model)
  returning i.install_id
),
s as (update public.app_sessions x set is_test = true from emu where x.install_id = emu.install_id returning 1)
update public.app_device_days d set is_test = true from emu where d.install_id = emu.install_id;

-- Guest accounts' ids off the events, the devices, their visits and days.
update public.app_events e set user_id = null
 where e.user_id in (select u.id from auth.users u where coalesce(u.raw_app_meta_data ->> 'guest', '') = 'true');
update public.app_installs i set user_id = null
 where i.user_id in (select u.id from auth.users u where coalesce(u.raw_app_meta_data ->> 'guest', '') = 'true');
update public.app_sessions s set user_id = null
 where s.user_id in (select u.id from auth.users u where coalesce(u.raw_app_meta_data ->> 'guest', '') = 'true');
update public.app_device_days d set user_id = null, is_client = false
 where d.user_id in (select u.id from auth.users u where coalesce(u.raw_app_meta_data ->> 'guest', '') = 'true');

-- Every person again: the guests become their devices, the emulators test
-- (the rows keyed by a guest account go with the refresh's own clean-up).
select public.app_person_profiles_refresh(true);
