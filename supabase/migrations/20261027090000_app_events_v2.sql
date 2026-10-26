-- App analytics, stage 1: every action recorded once, by name, with time.
--
-- * app_events gains the v2 envelope: event_id (dedupe on retry), session_id
--   and seq (order within a visit), element (what was pressed), duration_ms
--   (time on a screen, a form, a test) and app_build (which build sent it).
-- * app_installs gains the device context and the test mark (S10): a staff
--   account, a demo account or a dev build marks a device automatically; a
--   person can mark one by the code the app shows (Sozlamalar → Test
--   qurilmalari). Test devices are hidden from the numbers by default.
-- * app_event_types is the registry: an event the registry does not know is
--   not stored but counted in app_events_rejected, with its build, so a
--   misspelt name in a release shows up on the quality page instead of
--   vanishing. Each event lists the props keys it may carry; any other key is
--   dropped (no free-form personal data can ride along by accident).
-- * app_events_log_v2 is the app's new way in; app_events_log (v1) stays for
--   the versions already on phones.
-- * app_sessions and app_device_days are rebuilt every 5 minutes from the raw
--   events (pg_cron), so the CRM reads small tables. Raw events are kept 13
--   months (D2); the daily table is kept.

-- 1. The v2 envelope -------------------------------------------------------
alter table public.app_events
  add column if not exists event_id    uuid,
  add column if not exists session_id  uuid,
  add column if not exists seq         int,
  add column if not exists element     text,
  add column if not exists duration_ms int,
  add column if not exists app_build   int;

do $$ begin
  alter table public.app_events add constraint app_events_element_check
    check (element is null or length(element) <= 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.app_events add constraint app_events_duration_check
    check (duration_ms is null or duration_ms between 0 and 86400000);
exception when duplicate_object then null; end $$;

create unique index if not exists app_events_event_id_key on public.app_events (event_id) where event_id is not null;
create index if not exists app_events_session_idx on public.app_events (session_id, seq) where session_id is not null;
create index if not exists app_events_received_at_idx on public.app_events (received_at);
create index if not exists app_events_occurred_at_idx on public.app_events (occurred_at);

alter table public.app_installs
  add column if not exists app_build      int,
  add column if not exists os             text,
  add column if not exists os_version     text,
  add column if not exists model          text,
  add column if not exists ui_lang        text,
  add column if not exists build_channel  text,
  add column if not exists test_reason    text,
  add column if not exists test_marked_by uuid references auth.users (id) on delete set null,
  add column if not exists test_marked_at timestamptz;

do $$ begin
  alter table public.app_installs add constraint app_installs_test_reason_check
    check (test_reason is null or test_reason in ('staff', 'demo', 'dev', 'manual'));
exception when duplicate_object then null; end $$;

-- 2. The registry ------------------------------------------------------------
create table if not exists public.app_event_types (
  event          text primary key check (event ~ '^[a-z][a-z0-9_]{1,47}$'),
  family         text not null,
  description_uz text not null,
  -- The props keys the event may carry; '*' allows any.
  props          text[] not null default '{}',
  status         text not null default 'active' check (status in ('active', 'deprecated')),
  added_in       text,
  created_at     timestamptz not null default now()
);

insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  -- life cycle
  ('app_open',          'lifecycle', 'Ilovani ochdi',                          '{signed_in,cold}', 'active', '1.1.0'),
  ('app_ready',         'lifecycle', 'Ilova tayyor bo''ldi (ochilish vaqti)', '{cold_ms}', 'active', '1.1.2'),
  ('session_start',     'lifecycle', 'Yangi tashrif boshlandi',                '{reason}', 'active', '1.1.2'),
  ('app_background',    'lifecycle', 'Ilova fonga o''tdi',                     '{}', 'active', '1.1.2'),
  ('app_resume',        'lifecycle', 'Ilovaga qaytdi',                         '{away_s}', 'active', '1.1.2'),
  -- screens
  ('screen_view',       'screen',    'Ekranni ochdi',                          '{from}', 'active', '1.1.0'),
  ('screen_leave',      'screen',    'Ekrandan chiqdi (vaqti bilan)',          '{scroll_pct}', 'active', '1.1.2'),
  ('tab_open',          'screen',    'Bo''limga o''tdi',                       '{tab}', 'active', '1.1.0'),
  ('sheet_open',        'screen',    'Oyna ochdi',                             '{name}', 'active', '1.1.2'),
  ('sheet_close',       'screen',    'Oynani yopdi',                           '{name}', 'active', '1.1.2'),
  ('page_tour',         'screen',    'Ekran yo''riqnomasi',                    '{page,action,step}', 'active', '1.1.0'),
  ('board_tour',        'screen',    'Filtr yo''riqnomasi (eski)',             '{action,step}', 'deprecated', '1.0.33'),
  -- taps
  ('tap',               'tap',       'Bosdi',                                  '{x,y,institution_id,value,index,tab,kind,step,target,on,list,position}', 'active', '1.1.2'),
  ('long_press',        'tap',       'Bosib turdi',                            '{x,y,institution_id,value,index}', 'active', '1.1.2'),
  ('rage_tap',          'tap',       'Bir joyni tez-tez bosdi',                '{x,y,count}', 'active', '1.1.2'),
  -- what was seen
  ('card_view',         'view',      'Universitet kartasini ko''rdi',          '{institution_id,position,list}', 'active', '1.1.2'),
  -- universities
  ('university_open',   'university','Universitet sahifasini ochdi',           '{institution_id,from,position}', 'active', '1.1.0'),
  ('slot_set',          'university','♥ bilan tanladi',                        '{institution_id,slot,from}', 'active', '1.1.0'),
  ('slot_remove',       'university','♥ ni olib tashladi',                     '{institution_id}', 'active', '1.1.0'),
  ('university_save',   'university','Saqladi (eski)',                         '{institution_id}', 'deprecated', '1.0.33'),
  ('university_unsave', 'university','Saqlashni bekor qildi (eski)',           '{institution_id}', 'deprecated', '1.0.33'),
  ('university_skip',   'university','O''tkazib yubordi (eski)',               '{institution_id}', 'deprecated', '1.0.33'),
  ('duel_pick',         'university','Bu yoki bu: tanladi',                    '{institution_id,other_id}', 'active', '1.1.0'),
  ('filter_apply',      'university','Filtr qo''lladi',                        '{field,regions,degree,topik,type,ielts,grant,max_price,one_percent,results}', 'active', '1.1.0'),
  ('search',            'university','Qidirdi',                                '{chars,q,results}', 'active', '1.1.0'),
  -- assessment
  ('assessment_start',  'assessment','Baholashni boshladi',                    '{kind,institution_id,universities}', 'active', '1.0.33'),
  ('question_answer',   'assessment','Savolga javob berdi',                    '{form,q,band}', 'active', '1.1.2'),
  ('assessment_result', 'assessment','Baholash natijasi',                      '{kind,institution_id,band,score_bucket}', 'active', '1.1.2'),
  ('report_view',       'assessment','Hisobotni ko''rdi',                      '{universities}', 'active', '1.1.0'),
  ('study_plan_test_open','assessment','Study Plan testini ochdi',            '{institution_id}', 'active', '1.1.0'),
  -- forms
  ('form_open',         'form',      'Formani ochdi',                          '{form}', 'active', '1.1.2'),
  ('field_focus',       'form',      'Maydonga yozishni boshladi',             '{form,field}', 'active', '1.1.2'),
  ('field_error',       'form',      'Maydonda xato',                          '{form,field,code}', 'active', '1.1.2'),
  ('form_submit',       'form',      'Formani yubordi',                        '{form,result}', 'active', '1.1.2'),
  ('lead_submit',       'form',      'Konsultantga so''rov yubordi',           '{status}', 'active', '1.0.33'),
  -- account and contact
  ('sign_in',           'account',   'Mijoz kodi bilan kirdi',                 '{result,method}', 'active', '1.1.0'),
  ('sign_out',          'account',   'Hisobdan chiqdi',                        '{}', 'active', '1.1.2'),
  ('account_delete',    'account',   'Hisobni o''chirdi',                      '{}', 'active', '1.1.2'),
  ('qr_scan',           'account',   'QR skaner',                              '{result}', 'active', '1.1.0'),
  ('language_set',      'account',   'Til tanladi',                            '{language,source,device_default}', 'active', '1.1.0'),
  ('contact_tap',       'contact',   'Konsultant bilan bog''lanish tugmasi',   '{channel,coded}', 'active', '1.1.0'),
  ('share',             'contact',   'Ulashdi',                                '{what}', 'active', '1.1.2'),
  ('device_code_view',  'account',   'Qurilma kodini ochdi',                   '{}', 'active', '1.1.2'),
  -- preparation
  ('interview_start',   'prepare',   'Suhbat mashqini boshladi',               '{language}', 'active', '1.1.0'),
  ('interview_end',     'prepare',   'Suhbat mashqini tugatdi',                '{seconds,by_ai}', 'active', '1.1.0'),
  ('interview_leave',   'prepare',   'Suhbatdan chiqib ketdi',                 '{seconds}', 'active', '1.1.0'),
  ('study_plan_feedback','prepare',  'Study Plan qismiga fikr so''radi',       '{step}', 'active', '1.1.0'),
  ('dictation_start',   'prepare',   'Ovoz bilan yozdi',                       '{step,locale}', 'active', '1.1.0'),
  -- client
  ('document_upload',   'client',    'Hujjat yukladi',                         '{type}', 'active', '1.1.0'),
  -- notifications
  ('push_received',     'push',      'Bildirishnoma keldi (ilova ochiq)',      '{type,campaign}', 'active', '1.1.2'),
  ('push_opened',       'push',      'Bildirishnomani bosdi',                  '{type,campaign}', 'active', '1.1.2'),
  ('push_permission',   'push',      'Bildirishnoma ruxsati',                  '{result,source}', 'active', '1.1.2'),
  -- quality
  ('app_error',         'quality',   'Ilovada xato',                           '{type,lib,fatal}', 'active', '1.1.2'),
  ('rpc_error',         'quality',   'Server so''rovi xato bilan qaytdi',      '{name,status}', 'active', '1.1.2'),
  ('rpc_slow',          'quality',   'Server so''rovi sekin',                  '{name,ms}', 'active', '1.1.2')
on conflict (event) do update
   set family = excluded.family, description_uz = excluded.description_uz,
       props = excluded.props, status = excluded.status, added_in = excluded.added_in;

-- 3. What was turned away ------------------------------------------------------
create table if not exists public.app_events_rejected (
  day       date not null,
  reason    text not null,
  event     text not null default '',
  app_build int  not null default 0,
  n         int  not null default 0,
  last_at   timestamptz not null default now(),
  primary key (day, reason, event, app_build)
);

-- 4. Sessions and device-days ----------------------------------------------------
create table if not exists public.app_sessions (
  session_key       text primary key,
  install_id        uuid not null references public.app_installs (install_id) on delete cascade,
  user_id           uuid,
  client_session_id uuid,
  started_at        timestamptz not null,
  ended_at          timestamptz not null,
  duration_s        int not null,
  events            int not null,
  screens           int not null,
  taps              int not null,
  entry_screen      text,
  exit_screen       text,
  exit_event        text,
  app_build         int,
  is_test           boolean not null default false,
  updated_at        timestamptz not null default now()
);
create index if not exists app_sessions_started_idx on public.app_sessions (started_at);
create index if not exists app_sessions_install_idx on public.app_sessions (install_id, started_at desc);

-- One row per device per Tashkent day: what it reached that day. Every funnel
-- step is "reached at least once" (S2), so a range is count(distinct install_id).
create table if not exists public.app_device_days (
  day        date not null,
  install_id uuid not null references public.app_installs (install_id) on delete cascade,
  user_id    uuid,
  platform   text,
  app_build  int,
  is_test    boolean not null default false,
  is_client  boolean not null default false,
  events     int not null default 0,
  sessions   int not null default 0,
  active_s   int not null default 0,
  milestones text[] not null default '{}',
  primary key (day, install_id)
);
create index if not exists app_device_days_install_idx on public.app_device_days (install_id, day);

create table if not exists public.app_analytics_state (
  key text primary key,
  at  timestamptz not null
);

-- 5. Who reads --------------------------------------------------------------------
alter table public.app_event_types enable row level security;
alter table public.app_events_rejected enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_device_days enable row level security;
alter table public.app_analytics_state enable row level security;

drop policy if exists "app_event_types_staff_read" on public.app_event_types;
create policy "app_event_types_staff_read" on public.app_event_types
  for select to authenticated using (public.app_events_staff_can_read());
drop policy if exists "app_events_rejected_staff_read" on public.app_events_rejected;
create policy "app_events_rejected_staff_read" on public.app_events_rejected
  for select to authenticated using (public.app_events_staff_can_read());
drop policy if exists "app_sessions_staff_read" on public.app_sessions;
create policy "app_sessions_staff_read" on public.app_sessions
  for select to authenticated using (public.app_events_staff_can_read());
drop policy if exists "app_device_days_staff_read" on public.app_device_days;
create policy "app_device_days_staff_read" on public.app_device_days
  for select to authenticated using (public.app_events_staff_can_read());

revoke all on public.app_event_types, public.app_events_rejected, public.app_sessions,
              public.app_device_days, public.app_analytics_state from anon, authenticated;
grant select on public.app_event_types, public.app_events_rejected, public.app_sessions,
                public.app_device_days to authenticated;

-- 6. The app's way in (v2) -------------------------------------------------------
-- p_context: {platform, app_version, app_build, os, os_version, model, ui_lang,
--             build_channel ('store' | 'test' | 'dev'), sent_at}
-- p_events:  [{id, event, screen?, element?, props?, at, session?, seq?, duration_ms?}, ...]
-- Returns {stored, duplicates, rejected[, error]}. Never raises: telemetry must
-- not fail the app. One bad event cannot cost the good ones next to it.
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
begin
  v_build := case when (v_ctx ->> 'app_build') ~ '^\d{1,9}$' then (v_ctx ->> 'app_build')::int end;

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
     test_reason, test_marked_at)
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
    case when v_test is not null then now() end
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

-- 7. Test devices (S10) -------------------------------------------------------------
-- The code the app shows (the first 8 characters of its install id) marks a
-- device as a test one; sessions and device-days follow at once.
create or replace function public.app_install_mark_test(p_code text, p_reason text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_code text := lower(regexp_replace(coalesce(p_code, ''), '[^0-9a-fA-F]', '', 'g'));
  v_ids  uuid[];
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(v_code) < 8 then
    return jsonb_build_object('status', 'short_code');
  end if;
  if coalesce(p_reason, 'manual') not in ('staff', 'demo', 'dev', 'manual') then
    return jsonb_build_object('status', 'bad_reason');
  end if;
  select array_agg(i.install_id) into v_ids
    from public.app_installs i
   where replace(i.install_id::text, '-', '') like v_code || '%';
  if v_ids is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('status', 'ambiguous', 'count', array_length(v_ids, 1));
  end if;
  update public.app_installs
     set test_reason = coalesce(p_reason, 'manual'), test_marked_by = auth.uid(), test_marked_at = now()
   where install_id = v_ids[1];
  update public.app_sessions set is_test = true where install_id = v_ids[1];
  update public.app_device_days set is_test = true where install_id = v_ids[1];
  return jsonb_build_object('status', 'ok', 'install_id', v_ids[1]);
end;
$$;

create or replace function public.app_install_unmark_test(p_install_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.app_installs
     set test_reason = null, test_marked_by = auth.uid(), test_marked_at = now()
   where install_id = p_install_id;
  update public.app_sessions set is_test = false where install_id = p_install_id;
  update public.app_device_days set is_test = false where install_id = p_install_id;
  return found;
end;
$$;

revoke all on function public.app_install_mark_test(text, text) from public, anon;
revoke all on function public.app_install_unmark_test(uuid) from public, anon;
grant execute on function public.app_install_mark_test(text, text) to authenticated;
grant execute on function public.app_install_unmark_test(uuid) to authenticated;

-- 8. Rebuilding sessions and device-days -----------------------------------------------
-- A visit ends after 30 minutes without an event, or when the app starts a new
-- session id. Events can arrive up to 30 days late (an offline phone), so the
-- last 35 days of a device are rebuilt whenever it sends something.
create or replace function public.app_sessions_rebuild(p_install uuid)
returns int
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_from timestamptz := now() - interval '35 days';
  v_n    int;
begin
  select least(v_from, coalesce(min(s.started_at), v_from)) into v_from
    from public.app_sessions s
   where s.install_id = p_install and s.ended_at >= now() - interval '35 days';

  delete from public.app_sessions s where s.install_id = p_install and s.started_at >= v_from;

  insert into public.app_sessions
    (session_key, install_id, user_id, client_session_id, started_at, ended_at, duration_s, events,
     screens, taps, entry_screen, exit_screen, exit_event, app_build, is_test, updated_at)
  with ev as (
    select e.id, e.user_id, e.session_id, e.event, e.screen, e.occurred_at, e.seq, e.app_build,
           lag(e.occurred_at) over w as prev_at,
           lag(e.session_id) over w as prev_sid
      from public.app_events e
     where e.install_id = p_install and e.occurred_at >= v_from
    window w as (order by e.occurred_at, e.seq nulls last, e.id)
  ),
  g as (
    select ev.*,
           sum(case when prev_at is null
                      or occurred_at - prev_at > interval '30 minutes'
                      or (session_id is not null and prev_sid is not null and session_id <> prev_sid)
                    then 1 else 0 end)
             over (order by occurred_at, seq nulls last, id) as grp
      from ev
  )
  select p_install::text || ':' || floor(extract(epoch from min(g.occurred_at)))::bigint,
         p_install,
         (array_agg(g.user_id order by g.occurred_at desc) filter (where g.user_id is not null))[1],
         (array_agg(g.session_id order by g.occurred_at) filter (where g.session_id is not null))[1],
         min(g.occurred_at),
         max(g.occurred_at),
         floor(extract(epoch from max(g.occurred_at) - min(g.occurred_at)))::int,
         count(*)::int,
         (count(*) filter (where g.event = 'screen_view'))::int,
         (count(*) filter (where g.event in ('tap', 'long_press')))::int,
         coalesce((array_agg(g.screen order by g.occurred_at, g.seq nulls last, g.id)
                     filter (where g.event = 'screen_view' and g.screen is not null))[1],
                  (array_agg(g.screen order by g.occurred_at, g.seq nulls last, g.id)
                     filter (where g.screen is not null))[1]),
         (array_agg(g.screen order by g.occurred_at desc, g.seq desc nulls last, g.id desc)
            filter (where g.screen is not null))[1],
         (array_agg(g.event order by g.occurred_at desc, g.seq desc nulls last, g.id desc))[1],
         (array_agg(g.app_build order by g.occurred_at desc) filter (where g.app_build is not null))[1],
         coalesce((select i.test_reason is not null from public.app_installs i where i.install_id = p_install), false),
         now()
    from g
   group by g.grp
  on conflict (session_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- The milestones a device reached in a day; the funnel (S2) and the CRM's
-- segments read these instead of the raw events.
create or replace function public.app_device_days_rebuild(p_from timestamptz, p_to timestamptz)
returns int
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_n int;
begin
  with touched as (
    select distinct e.install_id, (e.occurred_at at time zone 'Asia/Tashkent')::date as day
      from public.app_events e
     where e.received_at > p_from and e.received_at <= p_to
  ),
  agg as (
    select t.day, t.install_id,
           (array_agg(e.user_id order by e.occurred_at desc) filter (where e.user_id is not null))[1] as user_id,
           (array_agg(e.app_build order by e.occurred_at desc) filter (where e.app_build is not null))[1] as app_build,
           count(*)::int as events,
           array_remove(array[
             case when bool_or(e.event = 'app_open') then 'open' end,
             case when bool_or(e.event not in ('app_open', 'app_ready', 'screen_view', 'screen_leave', 'language_set',
                                               'session_start', 'app_background', 'app_resume', 'app_error',
                                               'rpc_error', 'rpc_slow', 'card_view', 'push_received')) then 'active' end,
             case when bool_or(e.event = 'university_open') then 'uni_open' end,
             case when bool_or(e.event in ('slot_set', 'university_save')) then 'heart' end,
             case when bool_or(e.event in ('assessment_start', 'question_answer')
                               or (e.event = 'screen_view' and e.screen in ('/university/:id/assess', '/assess'))) then 'assess' end,
             case when bool_or(e.event = 'report_view') then 'report' end,
             case when bool_or((e.event = 'screen_view' and e.screen = '/assess/lead')
                               or (e.event = 'form_open' and e.props ->> 'form' = 'lead')) then 'lead_form' end,
             case when bool_or(e.event = 'lead_submit' and e.props ->> 'status' = 'ok') then 'request' end,
             case when bool_or(e.event = 'contact_tap') then 'contact' end,
             case when bool_or(e.event = 'sign_in' and e.props ->> 'result' = 'ok') then 'sign_in' end,
             case when bool_or((e.event = 'tab_open' and e.props ->> 'tab' = 'prepare')
                               or e.screen like '%#prepare') then 'prepare' end,
             case when bool_or(e.screen in ('study_plan', 'study_plan_test')
                               or e.event in ('study_plan_feedback', 'study_plan_test_open', 'dictation_start')) then 'study_plan' end,
             case when bool_or(e.event in ('interview_start', 'interview_end', 'interview_leave')
                               or e.screen in ('interview', 'interview_test')) then 'interview' end,
             case when bool_or(e.screen = 'ai_chat') then 'ai_chat' end,
             case when bool_or((e.event = 'tab_open' and e.props ->> 'tab' = 'documents') or e.screen like '%#documents') then 'documents' end,
             case when bool_or((e.event = 'tab_open' and e.props ->> 'tab' = 'application') or e.screen like '%#application') then 'application' end,
             case when bool_or(e.event = 'document_upload') then 'upload' end,
             case when bool_or(e.event = 'search') then 'search' end,
             case when bool_or(e.event = 'filter_apply') then 'filter' end,
             case when bool_or(e.event = 'push_opened') then 'push_open' end
           ], null) as milestones
      from touched t
      join public.app_events e
        on e.install_id = t.install_id
       and e.occurred_at >= (t.day::timestamp at time zone 'Asia/Tashkent')
       and e.occurred_at < ((t.day + 1)::timestamp at time zone 'Asia/Tashkent')
     group by t.day, t.install_id
  ),
  sess as (
    select a.day, a.install_id,
           count(s.*)::int as sessions,
           coalesce(sum(s.duration_s), 0)::int as active_s
      from agg a
      left join public.app_sessions s
        on s.install_id = a.install_id
       and s.started_at >= (a.day::timestamp at time zone 'Asia/Tashkent')
       and s.started_at < ((a.day + 1)::timestamp at time zone 'Asia/Tashkent')
     group by a.day, a.install_id
  )
  insert into public.app_device_days
    (day, install_id, user_id, platform, app_build, is_test, is_client, events, sessions, active_s, milestones)
  select a.day, a.install_id, coalesce(a.user_id, i.user_id), i.platform, a.app_build,
         i.test_reason is not null, coalesce(a.user_id, i.user_id) is not null,
         a.events, coalesce(s.sessions, 0), coalesce(s.active_s, 0), a.milestones
    from agg a
    join public.app_installs i on i.install_id = a.install_id
    left join sess s on s.day = a.day and s.install_id = a.install_id
  on conflict (day, install_id) do update
     set user_id = excluded.user_id, platform = excluded.platform, app_build = excluded.app_build,
         is_test = excluded.is_test, is_client = excluded.is_client, events = excluded.events,
         sessions = excluded.sessions, active_s = excluded.active_s, milestones = excluded.milestones;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- What pg_cron runs every 5 minutes: devices that sent something since the last
-- run get their sessions and days rebuilt. A minute of overlap covers events
-- whose transaction committed just after the previous run's snapshot.
create or replace function public.app_analytics_refresh()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_since    timestamptz;
  v_now      timestamptz := clock_timestamp();
  v_installs uuid[];
  v_install  uuid;
  v_sessions int := 0;
  v_days     int := 0;
begin
  select s.at into v_since from public.app_analytics_state s where s.key = 'refresh';
  v_since := coalesce(v_since, now() - interval '400 days') - interval '1 minute';

  select array_agg(distinct e.install_id) into v_installs
    from public.app_events e
   where e.received_at > v_since and e.received_at <= v_now;

  if v_installs is not null then
    foreach v_install in array v_installs loop
      v_sessions := v_sessions + public.app_sessions_rebuild(v_install);
    end loop;
    v_days := public.app_device_days_rebuild(v_since, v_now);
  end if;

  insert into public.app_analytics_state (key, at) values ('refresh', v_now)
  on conflict (key) do update set at = excluded.at;

  return jsonb_build_object('installs', coalesce(array_length(v_installs, 1), 0),
                            'sessions', v_sessions, 'days', v_days);
end;
$$;

-- Raw events 13 months (D2); what was turned away the same; sessions too.
create or replace function public.app_analytics_retention()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_events int;
  v_cut timestamptz := now() - interval '13 months';
begin
  delete from public.app_events where occurred_at < v_cut;
  get diagnostics v_events = row_count;
  delete from public.app_events_rejected where day < (v_cut at time zone 'Asia/Tashkent')::date;
  delete from public.app_sessions where started_at < v_cut;
  return jsonb_build_object('events_deleted', v_events);
end;
$$;

revoke all on function public.app_sessions_rebuild(uuid) from public, anon, authenticated;
revoke all on function public.app_device_days_rebuild(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.app_analytics_refresh() from public, anon, authenticated;
revoke all on function public.app_analytics_retention() from public, anon, authenticated;

do $$ begin perform cron.unschedule('app-analytics-refresh'); exception when others then null; end $$;
select cron.schedule('app-analytics-refresh', '*/5 * * * *', 'select public.app_analytics_refresh();');
do $$ begin perform cron.unschedule('app-analytics-retention'); exception when others then null; end $$;
select cron.schedule('app-analytics-retention', '20 22 * * *', 'select public.app_analytics_retention();');

-- 9. The quality page ------------------------------------------------------------------
-- Is everything arriving? Events per hour, which build sends which event (a
-- build that stopped sending something the previous build sent is flagged —
-- the K15 case), what was turned away, the share of test devices and how late
-- events arrive.
create or replace function public.analytics_quality(p_days int default 7)
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
    select e.*, coalesce(e.app_build, i.app_build) as build
      from public.app_events e
      join public.app_installs i on i.install_id = e.install_id
     where e.occurred_at >= v_from
  ),
  builds as (
    select build, count(distinct install_id) as devices, count(*) as events, max(occurred_at) as last_at
      from ev where build is not null group by build
  ),
  per as (
    select build, event, count(*) as n, count(distinct install_id) as d
      from ev where build is not null group by build, event
  ),
  ordered as (
    select b.build, lag(b.build) over (order by b.build) as prev_build from builds b
  ),
  missing as (
    -- an event the previous build sent on at least 3 devices that this build
    -- (on at least 3 devices itself) never sent
    select o.build, p.event, p.d as prev_devices
      from ordered o
      join per p on p.build = o.prev_build and p.d >= 3
      join builds b on b.build = o.build and b.devices >= 3
     where not exists (select 1 from per q where q.build = o.build and q.event = p.event)
  )
  select jsonb_build_object(
    'days', v_days,
    'hourly', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'events', n, 'devices', d) order by h)
        from (select date_trunc('hour', e.received_at) as h, count(*) as n, count(distinct e.install_id) as d
                from public.app_events e
               where e.received_at >= now() - interval '48 hours'
               group by 1) s
    ), '[]'::jsonb),
    'builds', coalesce((
      select jsonb_agg(jsonb_build_object('build', build, 'devices', devices, 'events', events, 'last_at', last_at)
                       order by build desc)
        from builds
    ), '[]'::jsonb),
    'matrix', coalesce((
      select jsonb_agg(jsonb_build_object('build', build, 'event', event, 'n', n, 'devices', d))
        from per
    ), '[]'::jsonb),
    'missing', coalesce((
      select jsonb_agg(jsonb_build_object('build', build, 'event', event, 'prev_devices', prev_devices))
        from missing
    ), '[]'::jsonb),
    'rejected', coalesce((
      select jsonb_agg(jsonb_build_object('reason', reason, 'event', event, 'build', app_build, 'n', n, 'last_at', last_at)
                       order by last_at desc)
        from (select reason, event, app_build, sum(n) as n, max(last_at) as last_at
                from public.app_events_rejected
               where day >= (v_from at time zone 'Asia/Tashkent')::date
               group by 1, 2, 3) r
    ), '[]'::jsonb),
    'devices', (select count(distinct install_id) from ev),
    'test_devices', (select count(distinct ev.install_id) from ev join public.app_installs i using (install_id)
                      where i.test_reason is not null),
    'test_by_reason', coalesce((
      select jsonb_object_agg(test_reason, n)
        from (select i.test_reason, count(*) as n from public.app_installs i
               where i.test_reason is not null group by 1) t
    ), '{}'::jsonb),
    'delay_s', (
      select jsonb_build_object(
        'p50', percentile_cont(0.5) within group (order by extract(epoch from received_at - occurred_at)),
        'p90', percentile_cont(0.9) within group (order by extract(epoch from received_at - occurred_at)),
        'p99', percentile_cont(0.99) within group (order by extract(epoch from received_at - occurred_at)))
        from ev
    ),
    'registry', coalesce((
      select jsonb_agg(jsonb_build_object('event', t.event, 'family', t.family, 'description', t.description_uz,
                                          'status', t.status, 'n', coalesce(c.n, 0), 'devices', coalesce(c.d, 0))
                       order by t.family, t.event)
        from public.app_event_types t
        left join (select event, count(*) as n, count(distinct install_id) as d from ev group by event) c
          on c.event = t.event
    ), '[]'::jsonb),
    'last_refresh', (select s.at from public.app_analytics_state s where s.key = 'refresh')
  ) into v_out;
  return v_out;
end;
$$;

revoke all on function public.analytics_quality(int) from public, anon;
grant execute on function public.analytics_quality(int) to authenticated;

-- 10. The overview hides test devices unless asked (S10) ----------------------------------
drop function if exists public.app_events_summary(int);
create or replace function public.app_events_summary(p_days int default 7, p_include_test boolean default false)
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
    select e.* from public.app_events e
      join public.app_installs i on i.install_id = e.install_id
     where e.occurred_at >= v_from
       and (p_include_test or i.test_reason is null)
  ),
  dev as (
    select install_id,
           bool_or(event = 'app_open') as opened,
           -- Did something: anything but opening, looking and what the app does by
           -- itself; a tap on nothing (no element) is not doing something.
           bool_or(event not in ('app_open', 'app_ready', 'screen_view', 'screen_leave', 'language_set',
                                 'session_start', 'app_background', 'app_resume', 'app_error',
                                 'rpc_error', 'rpc_slow', 'card_view', 'push_received', 'push_permission',
                                 'rage_tap', 'sheet_close')
                   and not (event = 'tap' and element is null)) as active,
           bool_or(event = 'university_open') as uni,
           bool_or(event in ('slot_set', 'university_save', 'assessment_start', 'question_answer')
                   or (event = 'screen_view' and screen in ('/university/:id/assess', '/assess'))) as intent,
           bool_or(event = 'report_view') as report,
           bool_or((event = 'screen_view' and screen = '/assess/lead')
                   or (event = 'form_open' and props ->> 'form' = 'lead')) as lead_form,
           bool_or(event = 'lead_submit' and props ->> 'status' = 'ok') as lead_ok
      from ev
     group by install_id
  ),
  -- The five places of the bottom nav. Apps from 1.1.2 (events with an id)
  -- name the place in the screen ("/guest#home"): every visit, the first
  -- one included. Older apps sent tab_open on a switch only, and the
  -- landing place as the bare shell route.
  sec as (
    select split_part(screen, '#', 2) as section, install_id
      from ev
     where event_id is not null and event = 'screen_view' and screen like '%#%'
    union all
    select case
             when event = 'tab_open' then coalesce(nullif(props ->> 'tab', ''), '?')
             when screen = '/guest' then 'home'
             else 'application'
           end,
           install_id
      from ev
     where event_id is null
       and (event = 'tab_open'
            or (event = 'screen_view' and screen = '/guest')
            or (event = 'screen_view' and screen = '/' and user_id is not null))
  ),
  picked as (
    select props ->> 'institution_id' as iid, install_id
      from ev
     where event in ('slot_set', 'university_save') and props ? 'institution_id'
  )
  select jsonb_build_object(
    'days', v_days,
    'include_test', p_include_test,
    'test_devices', (select count(distinct e.install_id) from public.app_events e
                       join public.app_installs i on i.install_id = e.install_id
                      where e.occurred_at >= v_from and i.test_reason is not null),
    'devices', (select count(*) from dev),
    'people', (select count(distinct user_id) from ev where user_id is not null),
    'demo_people', (select count(distinct ev.user_id) from ev join public.profiles p on p.user_id = ev.user_id where p.is_demo),
    'signed_in_devices', (select count(distinct install_id) from ev where user_id is not null),
    'new_devices', (select count(*) from public.app_installs i
                     where i.first_seen_at >= v_from and (p_include_test or i.test_reason is null)),
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
                 and screen not like '%#%'
               group by screen order by count(*) desc limit 20) s
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('section', section, 'n', n, 'devices', d) order by d desc, n desc)
        from (select section, count(*) n, count(distinct install_id) d from sec group by section) s
    ), '[]'::jsonb),
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
                     from public.app_installs i
                    where i.first_seen_at >= v_from and (p_include_test or i.test_reason is null)
                    group by 1) n
          on n.on_day = s.on_day
    ), '[]'::jsonb)
  ) into v_out;

  return v_out || jsonb_build_object('top_saved', v_out -> 'top_picked');
end;
$$;

revoke all on function public.app_events_summary(int, boolean) from public, anon;
grant execute on function public.app_events_summary(int, boolean) to authenticated;
