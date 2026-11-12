-- Plan KG1 (Qirg'iziston): which country an installation is in.
--
-- The app sends, with every batch of events, the region of the phone's own
-- locale (device_region: "UZ" for uz_UZ / ru_UZ, "KG" for ky_KG / ru_KG) and
-- its UTC offset in minutes (tz_offset_min: Tashkent +300, Bishkek +360,
-- Seoul +540). From KG2 on it also sends the country the person chose in the
-- app (country). app_events_log_v2 keeps the last value it got for each; a
-- batch without them leaves what is stored.
--
-- Nothing else changes in app_events_log_v2: this is its definition from
-- 20261027090000_app_events_v2.sql (identical to production, md5 of the body
-- 03a8b5a61f6ac4bc3a2244d2c706d31f on 2026-11-11) with these three values
-- added. An app without the change sends none of them; the columns stay null.

alter table public.app_installs add column if not exists device_region text;
alter table public.app_installs add column if not exists tz_offset_min smallint;
alter table public.app_installs add column if not exists country text;

alter table public.app_installs drop constraint if exists app_installs_device_region_check;
alter table public.app_installs add constraint app_installs_device_region_check
  check (device_region is null or device_region ~ '^[A-Z]{2}$');
alter table public.app_installs drop constraint if exists app_installs_tz_offset_min_check;
alter table public.app_installs add constraint app_installs_tz_offset_min_check
  check (tz_offset_min is null or tz_offset_min between -720 and 840);
alter table public.app_installs drop constraint if exists app_installs_country_check;
alter table public.app_installs add constraint app_installs_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

comment on column public.app_installs.device_region is
  'Region of the phone''s own locale (ISO 3166-1 alpha-2), as the app last reported it. Plan KG1.';
comment on column public.app_installs.tz_offset_min is
  'The phone''s UTC offset in minutes (Tashkent 300, Bishkek 360), as the app last reported it. Plan KG1.';
comment on column public.app_installs.country is
  'The country the person chose in the app (ISO 3166-1 alpha-2: UZ, KG). Sent from plan KG2 on.';

create or replace function public.app_events_log_v2(
  p_install_id uuid,
  p_context    jsonb,
  p_events     jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_uid      uuid := auth.uid();
  v_ctx      jsonb := case when jsonb_typeof(p_context) = 'object' then p_context else '{}'::jsonb end;
  v_build    int;
  v_skew     interval := interval '0';
  v_sent     timestamptz;
  v_test     text;
  v_recent   int;
  v_x        jsonb;
  v_event    text;
  v_allowed  text[];
  v_props    jsonb;
  v_clean    jsonb;
  v_at       timestamptz;
  v_n        int;
  v_stored   int := 0;
  v_dup      int := 0;
  v_rej      int := 0;
  v_notes    jsonb := '{}'::jsonb;
  v_uuid_re  constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_day      date := (now() at time zone 'Asia/Tashkent')::date;
  v_region   text;
  v_tz       smallint;
  v_country  text;
begin
  v_build := case when (v_ctx ->> 'app_build') ~ '^\d{1,9}$' then (v_ctx ->> 'app_build')::int end;

  -- Where the phone is set up (plan KG1, Qirg'iziston): the region of the
  -- phone's own locale ("UZ", "KG"), its UTC offset in minutes (Tashkent
  -- +300, Bishkek +360) and, once the app asks for it (KG2), the country the
  -- person chose. Anything else is dropped; nothing here can fail the batch.
  v_region := upper(nullif(btrim(coalesce(v_ctx ->> 'device_region', '')), ''));
  if v_region !~ '^[A-Z]{2}$' then v_region := null; end if;
  v_tz := case when (v_ctx ->> 'tz_offset_min') ~ '^-?\d{1,4}$'
               then case when (v_ctx ->> 'tz_offset_min')::int between -720 and 840
                         then (v_ctx ->> 'tz_offset_min')::smallint end end;
  v_country := upper(nullif(btrim(coalesce(v_ctx ->> 'country', '')), ''));
  if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;

  if p_install_id is null or p_events is null or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) = 0 or jsonb_array_length(p_events) > 100 then
    return jsonb_build_object('stored', 0, 'duplicates', 0, 'rejected', 0, 'error', 'bad_batch');
  end if;

  select count(*) into v_recent
    from public.app_events e
   where e.install_id = p_install_id and e.received_at > now() - interval '1 hour';
  if v_recent >= 6000 then
    insert into public.app_events_rejected as r (day, reason, event, app_build, n)
    values (v_day, 'rate_limited', '', coalesce(v_build, 0), jsonb_array_length(p_events))
    on conflict (day, reason, event, app_build) do update set n = r.n + excluded.n, last_at = now();
    return jsonb_build_object('stored', 0, 'duplicates', 0, 'rejected', jsonb_array_length(p_events), 'error', 'rate_limited');
  end if;

  -- The phone's clock: if it is off by more than two minutes, shift every
  -- event by the difference between when the batch says it was sent and now.
  begin
    if (v_ctx ->> 'sent_at') ~ '^\d{4}-\d{2}-\d{2}T' then
      v_sent := (v_ctx ->> 'sent_at')::timestamptz;
      if abs(extract(epoch from now() - v_sent)) > 120 then
        v_skew := now() - v_sent;
      end if;
    end if;
  exception when others then
    v_skew := interval '0';
  end;

  -- Test devices mark themselves: a dev build, a staff account, a demo account.
  v_test := case
    when v_ctx ->> 'build_channel' = 'dev' then 'dev'
    when v_uid is not null and exists (select 1 from public.user_roles r where r.user_id = v_uid) then 'staff'
    when v_uid is not null and exists (select 1 from public.profiles p where p.user_id = v_uid and p.is_demo) then 'demo'
  end;

  insert into public.app_installs as i
    (install_id, user_id, platform, app_version, app_build, os, os_version, model, ui_lang, build_channel,
     test_reason, test_marked_at, device_region, tz_offset_min, country)
  values (
    p_install_id,
    v_uid,
    case when v_ctx ->> 'platform' in ('android', 'ios', 'web') then v_ctx ->> 'platform' else 'other' end,
    left(nullif(btrim(coalesce(v_ctx ->> 'app_version', '')), ''), 40),
    v_build,
    left(nullif(btrim(coalesce(v_ctx ->> 'os', '')), ''), 20),
    left(nullif(btrim(coalesce(v_ctx ->> 'os_version', '')), ''), 40),
    left(nullif(btrim(coalesce(v_ctx ->> 'model', '')), ''), 60),
    left(nullif(btrim(coalesce(v_ctx ->> 'ui_lang', '')), ''), 8),
    case when v_ctx ->> 'build_channel' in ('store', 'test', 'dev') then v_ctx ->> 'build_channel' end,
    v_test,
    case when v_test is not null then now() end,
    v_region,
    v_tz,
    v_country
  )
  on conflict (install_id) do update
     set user_id        = coalesce(excluded.user_id, i.user_id),
         platform       = excluded.platform,
         app_version    = coalesce(excluded.app_version, i.app_version),
         app_build      = coalesce(excluded.app_build, i.app_build),
         os             = coalesce(excluded.os, i.os),
         os_version     = coalesce(excluded.os_version, i.os_version),
         model          = coalesce(excluded.model, i.model),
         ui_lang        = coalesce(excluded.ui_lang, i.ui_lang),
         build_channel  = coalesce(excluded.build_channel, i.build_channel),
         device_region  = coalesce(excluded.device_region, i.device_region),
         tz_offset_min  = coalesce(excluded.tz_offset_min, i.tz_offset_min),
         country        = coalesce(excluded.country, i.country),
         -- A mark a person set stays; an automatic one only fills an empty mark.
         test_reason    = coalesce(i.test_reason, excluded.test_reason),
         test_marked_at = case when i.test_reason is null and excluded.test_reason is not null
                               then now() else i.test_marked_at end,
         last_seen_at   = now();

  for v_x in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(v_x) <> 'object' then
      v_rej := v_rej + 1;
      v_notes := jsonb_set(v_notes, array['bad_shape|'], to_jsonb(coalesce((v_notes ->> 'bad_shape|')::int, 0) + 1));
      continue;
    end if;

    v_event := coalesce(v_x ->> 'event', '');
    if v_event !~ '^[a-z][a-z0-9_]{1,47}$' then
      v_rej := v_rej + 1;
      v_notes := jsonb_set(v_notes, array['bad_name|'], to_jsonb(coalesce((v_notes ->> 'bad_name|')::int, 0) + 1));
      continue;
    end if;

    select t.props into v_allowed from public.app_event_types t where t.event = v_event;
    if not found then
      v_rej := v_rej + 1;
      v_notes := jsonb_set(v_notes, array['unknown_event|' || v_event],
                           to_jsonb(coalesce((v_notes ->> ('unknown_event|' || v_event))::int, 0) + 1));
      continue;
    end if;

    v_props := case when jsonb_typeof(v_x -> 'props') = 'object' then v_x -> 'props' else '{}'::jsonb end;
    if not ('*' = any (v_allowed)) then
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean
        from jsonb_each(v_props) as e(k, v)
       where k = any (v_allowed) and jsonb_typeof(v) <> 'null';
      if (select count(*) from jsonb_object_keys(v_props) k where not (k = any (v_allowed))) > 0 then
        v_notes := jsonb_set(v_notes, array['props_dropped|' || v_event],
                             to_jsonb(coalesce((v_notes ->> ('props_dropped|' || v_event))::int, 0) + 1));
      end if;
      v_props := v_clean;
    end if;
    if length(v_props::text) > 2000 then
      v_props := '{}'::jsonb;
      v_notes := jsonb_set(v_notes, array['props_too_big|' || v_event],
                           to_jsonb(coalesce((v_notes ->> ('props_too_big|' || v_event))::int, 0) + 1));
    end if;

    v_at := null;
    begin
      if (v_x ->> 'at') ~ '^\d{4}-\d{2}-\d{2}T' then
        v_at := (v_x ->> 'at')::timestamptz + v_skew;
      end if;
    exception when others then
      v_at := null;
    end;
    if v_at is null or v_at < now() - interval '30 days' or v_at > now() + interval '5 minutes' then
      v_notes := jsonb_set(v_notes, array['bad_time|' || v_event],
                           to_jsonb(coalesce((v_notes ->> ('bad_time|' || v_event))::int, 0) + 1));
      v_at := now();
    end if;

    begin
      insert into public.app_events
        (install_id, user_id, event, screen, props, occurred_at,
         event_id, session_id, seq, element, duration_ms, app_build)
      values (
        p_install_id,
        v_uid,
        v_event,
        left(nullif(btrim(coalesce(v_x ->> 'screen', '')), ''), 80),
        v_props,
        v_at,
        case when (v_x ->> 'id') ~ v_uuid_re then (v_x ->> 'id')::uuid end,
        case when (v_x ->> 'session') ~ v_uuid_re then (v_x ->> 'session')::uuid end,
        case when (v_x ->> 'seq') ~ '^\d{1,9}$' then (v_x ->> 'seq')::int end,
        left(nullif(btrim(coalesce(v_x ->> 'element', '')), ''), 80),
        case when (v_x ->> 'duration_ms') ~ '^\d{1,9}$' then least((v_x ->> 'duration_ms')::int, 86400000) end,
        v_build
      )
      on conflict (event_id) where event_id is not null do nothing;
      get diagnostics v_n = row_count;
      if v_n = 1 then v_stored := v_stored + 1; else v_dup := v_dup + 1; end if;
    exception when others then
      v_rej := v_rej + 1;
      v_notes := jsonb_set(v_notes, array['insert_error|' || v_event],
                           to_jsonb(coalesce((v_notes ->> ('insert_error|' || v_event))::int, 0) + 1));
    end;
  end loop;

  -- Retries the unique event id caught: not stored again, counted here so
  -- the quality page shows the app retrying (a bad network) — never stored twice.
  if v_dup > 0 then
    v_notes := v_notes || jsonb_build_object('duplicate|', v_dup);
  end if;

  if v_notes <> '{}'::jsonb then
    insert into public.app_events_rejected as r (day, reason, event, app_build, n)
    select v_day, split_part(k, '|', 1), split_part(k, '|', 2), coalesce(v_build, 0), v::int
      from jsonb_each_text(v_notes) as t(k, v)
    on conflict (day, reason, event, app_build) do update set n = r.n + excluded.n, last_at = now();
  end if;

  return jsonb_build_object('stored', v_stored, 'duplicates', v_dup, 'rejected', v_rej);
exception when others then
  return jsonb_build_object('stored', 0, 'duplicates', 0, 'rejected', 0, 'error', 'server');
end;
$$;

revoke all on function public.app_events_log_v2(uuid, jsonb, jsonb) from public;
grant execute on function public.app_events_log_v2(uuid, jsonb, jsonb) to anon, authenticated;
