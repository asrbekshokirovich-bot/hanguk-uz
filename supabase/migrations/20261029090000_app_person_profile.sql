-- App analytics, stage 3: what the operators see about a person, and the
-- app's signals — the marketing plan's «Ilovada» block and «Bugun ilovada»
-- list (2026-10-22), decisions S6, S7, D5, Q92 and the owner's answers of
-- 2026-10-26.
--
-- * app_event_types: assessment_result (visa) also carries low, topik, income
--   and tariff — the old «Viza imkoniyatim» quiz's weak point and tariff
--   (app/assessment-hints).
-- * app_person_profile: one row per person — a student (by account), a lead,
--   or a device nobody is tied to yet — over all their devices: the ♥ picks as
--   they stand, «Viza testi» (band, weak point, TOPIK, documented income) and
--   «Mos tarif», the report and how often it was seen, the request, visits and
--   active days, how far they got, an app score 0–100, and the AI summary
--   (edge function app-journey-summary). Rebuilt every 5 minutes for every
--   person whose devices sent something.
-- * analytics_access_log: every time a staff member opens a person's profile
--   or path. All staff see everything (S6), investors nothing — and every
--   opening is on record.
-- * app_signal_rules + app_signals: the plan's four signals, checked every
--   minute:
--     1. a new request from the app — the lead form, or a Telegram chat that
--        carried the app's code — HOZIR, 10 minutes: on working days (Monday
--        to Saturday, as the lead SLA) 09:00–18:00 all operators, 18:00–22:00
--        the boss; otherwise the next working morning (Sunday waits for
--        Monday, Q92);
--     2. a lead back in the app two or more days after the last visit — BUGUN,
--        the lead's owner (D5), or all operators when it has none;
--     3. a lead saw the report or filled three ♥ (once per lead) — BUGUN, the
--        same;
--     4. a student has not answered a university offer for 48 hours — BUGUN,
--        the documents staff.
--   One app task per lead per day. A lead's task closes when someone writes,
--   calls or notes after it (a request also when it is answered or the lead
--   moves on); a BUGUN task lapses at the end of its day; an offer task closes
--   when no offer has waited 48 hours.
-- * app_signal_alerts(dry): the HOZIR tasks lead-sla-check sends to Telegram —
--   the ones the lead SLA does not already send (the evening, a lead with no
--   phone, an earlier lead asking again).
-- * analytics_person, analytics_person_journey (both logged), analytics_people,
--   analytics_today_in_app: the CRM's reads.

-- 0. The registry -------------------------------------------------------------------
insert into public.app_event_types (event, family, description_uz, props, status, added_in) values
  ('assessment_result', 'assessment', 'Baholash natijasi',
   '{kind,institution_id,band,score_bucket,low,topik,income,tariff}', 'active', '1.1.2')
on conflict (event) do update set props = excluded.props;

-- 1. Who opened whose path ------------------------------------------------------------
create table if not exists public.analytics_access_log (
  id          bigint generated always as identity primary key,
  viewer      uuid not null,
  person_key  text not null,
  lead_id     uuid,
  user_id     uuid,
  what        text not null check (what in ('profile', 'journey')),
  at          timestamptz not null default now()
);

create index if not exists analytics_access_log_person_idx on public.analytics_access_log (person_key, at desc);
create index if not exists analytics_access_log_viewer_idx on public.analytics_access_log (viewer, at desc);

alter table public.analytics_access_log enable row level security;
drop policy if exists analytics_access_log_admin_read on public.analytics_access_log;
create policy analytics_access_log_admin_read on public.analytics_access_log for select to authenticated
  using (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

-- 2. The person ---------------------------------------------------------------------
create table if not exists public.app_person_profile (
  person_key    text primary key,
  user_id       uuid,
  lead_id       uuid,
  installs      uuid[] not null default '{}',
  platform      text,
  first_seen_at timestamptz,
  last_seen_at  timestamptz,
  visits        int not null default 0,
  active_days   int not null default 0,
  active_s      int not null default 0,
  milestones    text[] not null default '{}',
  -- the ♥ picks as they stand (institution ids)
  picks         text[] not null default '{}',
  report_views  int not null default 0,
  report_at     timestamptz,
  request_at    timestamptz,
  -- «Viza testi»: the band, its tens of percent, the old quiz's weak point
  -- (language, income, deposit, gap, age), the TOPIK level, documented income
  -- (yes / no); «Mos tarif» by the old quiz's rules
  visa_band     text,
  visa_bucket   int,
  visa_low      text,
  visa_topik    int,
  visa_income   text,
  tariff        text,
  -- each university's admission chance, as tens of percent
  chances       jsonb not null default '[]'::jsonb,
  score         int not null default 0,
  is_test       boolean not null default false,
  ai_summary    text,
  ai_starter    text,
  ai_at         timestamptz,
  -- the last_seen_at the AI summary was written for
  ai_seen_at    timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists app_person_profile_lead_idx on public.app_person_profile (lead_id) where lead_id is not null;
create index if not exists app_person_profile_user_idx on public.app_person_profile (user_id) where user_id is not null;
create index if not exists app_person_profile_seen_idx on public.app_person_profile (last_seen_at desc);

alter table public.app_person_profile enable row level security;
drop policy if exists app_person_profile_staff_read on public.app_person_profile;
create policy app_person_profile_staff_read on public.app_person_profile for select to authenticated
  using (public.app_events_staff_can_read());

-- Which person a device is: the student signed in on it, else the lead it is
-- tied to, else the device itself.
create or replace function public.fn_app_person_key(p_user uuid, p_lead uuid, p_install uuid)
returns text
language sql
immutable
as $$
  select case when p_user is not null then 'user:' || p_user
              when p_lead is not null then 'lead:' || p_lead
              else 'device:' || p_install end;
$$;

-- The app score, 0–100: how far the person got in the app, then how
-- recently. Ten for opening a university, fifteen for a ♥, fifteen for the
-- assessment, twenty for the report, ten for the request form, ten for a
-- request or a contact, ten for preparing (Study Plan, interview, AI chat),
-- five each for coming back a second and a fourth time. Last seen within a
-- week counts fully, within a month 70%, after that 40%.
create or replace function public.fn_app_score(p_milestones text[], p_visits int, p_last_seen timestamptz)
returns int
language sql
stable
as $$
  select least(100, round((
           case when 'uni_open' = any (p_milestones) then 10 else 0 end
         + case when 'heart' = any (p_milestones) then 15 else 0 end
         + case when 'assess' = any (p_milestones) then 15 else 0 end
         + case when 'report' = any (p_milestones) then 20 else 0 end
         + case when 'lead_form' = any (p_milestones) then 10 else 0 end
         + case when p_milestones && array['request', 'contact'] then 10 else 0 end
         + case when p_milestones && array['study_plan', 'interview', 'ai_chat'] then 10 else 0 end
         + case when coalesce(p_visits, 0) >= 2 then 5 else 0 end
         + case when coalesce(p_visits, 0) >= 4 then 5 else 0 end
         ) * case when p_last_seen is null then 0
                  when p_last_seen > now() - interval '7 days' then 1.0
                  when p_last_seen > now() - interval '30 days' then 0.7
                  else 0.4 end))::int;
$$;

-- Rebuilds the profile of every person whose devices sent something, were
-- tied to someone or marked as test since the last run ([p_all]: everyone).
-- The AI summary is kept; app-journey-summary renews it.
create or replace function public.app_person_profiles_refresh(p_all boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_since timestamptz;
  v_now   timestamptz := clock_timestamp();
  v_n     int;
  v_gone  int;
begin
  select s.at into v_since from public.app_analytics_state s where s.key = 'person_refresh';
  v_since := coalesce(v_since, '-infinity'::timestamptz) - interval '1 minute';

  with map as (
    select i.install_id, public.fn_app_person_key(i.user_id, i.lead_id, i.install_id) as person_key,
           i.user_id, i.lead_id, i.platform, i.first_seen_at, i.last_seen_at, i.test_reason is not null as is_test
      from public.app_installs i
  ),
  touched as (
    select distinct m.person_key
      from map m
     where p_all
        or m.last_seen_at > v_since
        or exists (select 1 from public.app_identity a where a.install_id = m.install_id and a.created_at > v_since)
        or exists (select 1 from public.app_installs i where i.install_id = m.install_id and i.test_marked_at > v_since)
  ),
  people as (
    select m.* from map m join touched t on t.person_key = m.person_key
  ),
  base as (
    select p.person_key,
           array_agg(p.install_id order by p.last_seen_at desc nulls last) as installs,
           (max(p.user_id::text))::uuid as user_id,
           (array_agg(p.lead_id order by p.last_seen_at desc nulls last) filter (where p.lead_id is not null))[1] as lead_id,
           (array_agg(p.platform order by p.last_seen_at desc nulls last))[1] as platform,
           min(p.first_seen_at) as first_seen_at,
           max(p.last_seen_at) as last_seen_at,
           bool_or(p.is_test) as is_test
      from people p
     group by p.person_key
  ),
  ev as (
    select p.person_key, e.event, e.props, e.occurred_at, e.seq
      from people p
      join public.app_events e on e.install_id = p.install_id
     where e.event in ('slot_set', 'slot_remove', 'assessment_result', 'report_view', 'lead_submit')
  ),
  picks as (
    select x.person_key, array_agg(x.iid order by x.at) as picks
      from (select distinct on (ev.person_key, ev.props ->> 'institution_id')
                   ev.person_key, ev.props ->> 'institution_id' as iid, ev.event, ev.occurred_at as at
              from ev
             where ev.event in ('slot_set', 'slot_remove') and ev.props ? 'institution_id'
             order by ev.person_key, ev.props ->> 'institution_id', ev.occurred_at desc, ev.seq desc nulls last) x
     where x.event = 'slot_set'
     group by x.person_key
  ),
  visa as (
    select distinct on (ev.person_key) ev.person_key,
           ev.props ->> 'band' as band,
           case when (ev.props ->> 'score_bucket') ~ '^\d{1,3}$' then (ev.props ->> 'score_bucket')::int end as bucket,
           ev.props ->> 'low' as low,
           case when (ev.props ->> 'topik') ~ '^\d$' then (ev.props ->> 'topik')::int end as topik,
           ev.props ->> 'income' as income,
           ev.props ->> 'tariff' as tariff
      from ev
     where ev.event = 'assessment_result' and ev.props ->> 'kind' = 'visa'
     order by ev.person_key, ev.occurred_at desc, ev.seq desc nulls last
  ),
  chances as (
    select y.person_key, jsonb_agg(jsonb_build_object('institution_id', y.iid, 'bucket', y.bucket)
                                   order by y.bucket desc nulls last) as chances
      from (select distinct on (ev.person_key, ev.props ->> 'institution_id')
                   ev.person_key, ev.props ->> 'institution_id' as iid,
                   case when (ev.props ->> 'score_bucket') ~ '^\d{1,3}$' then (ev.props ->> 'score_bucket')::int end as bucket
              from ev
             where ev.event = 'assessment_result' and ev.props ->> 'kind' = 'admission' and ev.props ? 'institution_id'
             order by ev.person_key, ev.props ->> 'institution_id', ev.occurred_at desc, ev.seq desc nulls last) y
     group by y.person_key
  ),
  marks as (
    select ev.person_key,
           count(*) filter (where ev.event = 'report_view')::int as report_views,
           max(ev.occurred_at) filter (where ev.event = 'report_view') as report_at,
           max(ev.occurred_at) filter (where ev.event = 'lead_submit' and ev.props ->> 'status' = 'ok') as request_at
      from ev
     group by ev.person_key
  ),
  sess as (
    select p.person_key, count(s.*)::int as visits
      from people p
      join public.app_sessions s on s.install_id = p.install_id
     group by p.person_key
  ),
  days as (
    select p.person_key,
           count(distinct d.day) filter (where 'active' = any (d.milestones))::int as active_days,
           coalesce(sum(d.active_s), 0)::int as active_s
      from people p
      join public.app_device_days d on d.install_id = p.install_id
     group by p.person_key
  ),
  ms as (
    select p.person_key, array_agg(distinct m order by m) as milestones
      from people p
      join public.app_device_days d on d.install_id = p.install_id
      cross join lateral unnest(d.milestones) as m
     group by p.person_key
  )
  insert into public.app_person_profile as pp
    (person_key, user_id, lead_id, installs, platform, first_seen_at, last_seen_at, visits, active_days, active_s,
     milestones, picks, report_views, report_at, request_at, visa_band, visa_bucket, visa_low, visa_topik,
     visa_income, tariff, chances, score, is_test, updated_at)
  select b.person_key, b.user_id, b.lead_id, b.installs, b.platform, b.first_seen_at, b.last_seen_at,
         coalesce(s.visits, 0), coalesce(d.active_days, 0), coalesce(d.active_s, 0),
         coalesce(ms.milestones, '{}'), coalesce(pk.picks, '{}'),
         coalesce(mk.report_views, 0), mk.report_at, mk.request_at,
         v.band, v.bucket, v.low, v.topik, v.income, v.tariff,
         coalesce(c.chances, '[]'::jsonb),
         public.fn_app_score(coalesce(ms.milestones, '{}'), coalesce(s.visits, 0), b.last_seen_at),
         b.is_test, now()
    from base b
    left join sess s on s.person_key = b.person_key
    left join days d on d.person_key = b.person_key
    left join ms on ms.person_key = b.person_key
    left join picks pk on pk.person_key = b.person_key
    left join visa v on v.person_key = b.person_key
    left join chances c on c.person_key = b.person_key
    left join marks mk on mk.person_key = b.person_key
  on conflict (person_key) do update
     set user_id = excluded.user_id, lead_id = excluded.lead_id, installs = excluded.installs,
         platform = excluded.platform, first_seen_at = excluded.first_seen_at, last_seen_at = excluded.last_seen_at,
         visits = excluded.visits, active_days = excluded.active_days, active_s = excluded.active_s,
         milestones = excluded.milestones, picks = excluded.picks, report_views = excluded.report_views,
         report_at = excluded.report_at, request_at = excluded.request_at, visa_band = excluded.visa_band,
         visa_bucket = excluded.visa_bucket, visa_low = excluded.visa_low, visa_topik = excluded.visa_topik,
         visa_income = excluded.visa_income, tariff = excluded.tariff, chances = excluded.chances,
         score = excluded.score, is_test = excluded.is_test, updated_at = excluded.updated_at;
  get diagnostics v_n = row_count;

  -- A device tied to a lead since, a lead whose person signed in: their old
  -- rows go (with the AI summary written for them).
  delete from public.app_person_profile pp
   where not exists (select 1 from public.app_installs i
                      where public.fn_app_person_key(i.user_id, i.lead_id, i.install_id) = pp.person_key);
  get diagnostics v_gone = row_count;

  insert into public.app_analytics_state (key, at) values ('person_refresh', v_now)
  on conflict (key) do update set at = excluded.at;
  return jsonb_build_object('profiles', v_n, 'removed', v_gone);
end;
$$;

revoke all on function public.app_person_profiles_refresh(boolean) from public, anon, authenticated;

-- 3. Signals ------------------------------------------------------------------------
create table if not exists public.app_signal_rules (
  key      text primary key,
  name_uz  text not null,
  queue    text not null check (queue in ('now', 'today')),
  -- who it is for: the operators (the boss in the evening), the lead's owner
  -- (the operators when it has none), the documents staff
  target   text not null check (target in ('operators', 'owner', 'documents')),
  -- the timer of a HOZIR task
  minutes  int,
  enabled  boolean not null default true
);

insert into public.app_signal_rules (key, name_uz, queue, target, minutes, enabled) values
  ('new_app_request',  'Ilovadan yangi murojaat',                     'now',   'operators', 10,   true),
  ('came_back',        'Lid ilovaga qaytdi',                          'today', 'owner',     null, true),
  ('report_or_picks',  'Lid hisobotni ko''rdi yoki 3 ta ♥ to''ldirdi', 'today', 'owner',     null, true),
  ('offer_unanswered', 'Universitet taklifiga 48 soat javob yo''q',    'today', 'documents', null, true)
on conflict (key) do update
   set name_uz = excluded.name_uz, queue = excluded.queue, target = excluded.target, minutes = excluded.minutes;

create table if not exists public.app_signals (
  id          bigint generated always as identity primary key,
  rule_key    text not null references public.app_signal_rules (key),
  lead_id     uuid references public.leads (id) on delete cascade,
  -- a student (offer signals): auth.users id
  user_id     uuid,
  -- the Tashkent day the task is for
  day         date not null,
  created_at  timestamptz not null default now(),
  -- when it happened (the request, the visit, the offer), and the timer
  asked_at    timestamptz not null default now(),
  due_at      timestamptz,
  -- operators | boss (working-day evenings) | owner (the lead's, D5) | documents
  target      text not null check (target in ('operators', 'boss', 'owner', 'documents')),
  assigned_to uuid,
  -- what the row says: via (form | telegram), days away, report seen, ♥ count, offers
  detail      jsonb not null default '{}'::jsonb,
  status      text not null default 'open' check (status in ('open', 'done', 'expired')),
  done_at     timestamptz,
  alerted_at  timestamptz,
  check (lead_id is not null or user_id is not null)
);

-- One app task per lead per day; a student's offer task once a day.
create unique index if not exists app_signals_lead_day_key on public.app_signals (lead_id, day) where lead_id is not null;
create unique index if not exists app_signals_user_day_key on public.app_signals (user_id, rule_key, day) where lead_id is null;
create index if not exists app_signals_open_idx on public.app_signals (status, due_at) where status = 'open';

alter table public.app_signal_rules enable row level security;
alter table public.app_signals enable row level security;
drop policy if exists app_signal_rules_staff_read on public.app_signal_rules;
create policy app_signal_rules_staff_read on public.app_signal_rules for select to authenticated
  using (public.app_events_staff_can_read());
drop policy if exists app_signals_staff_read on public.app_signals;
create policy app_signals_staff_read on public.app_signals for select to authenticated
  using (public.app_events_staff_can_read());

-- Signal 1's day, timer and recipients for a request made at [p_at]
-- (Tashkent): working days Monday to Saturday, as the lead SLA
-- (fn_lead_sla_start); 09:00–18:00 the operators and 18:00–22:00 the boss,
-- ten minutes either way; otherwise the next working morning, 09:00 and ten
-- minutes (Sunday waits for Monday, Q92).
create or replace function public.fn_app_request_due(p_at timestamptz)
returns table (day date, due_at timestamptz, target text)
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
  v_dow   int := extract(isodow from v_local)::int;
  v_time  time := v_local::time;
  v_next  date;
begin
  if v_dow <= 6 and v_time >= time '09:00' and v_time < time '18:00' then
    return query select v_local::date, p_at + interval '10 minutes', 'operators'::text;
    return;
  end if;
  if v_dow <= 6 and v_time >= time '18:00' and v_time < time '22:00' then
    return query select v_local::date, p_at + interval '10 minutes', 'boss'::text;
    return;
  end if;
  v_next := case when v_dow <= 6 and v_time < time '09:00' then v_local::date else v_local::date + 1 end;
  if extract(isodow from v_next) = 7 then
    v_next := v_next + 1;
  end if;
  return query select v_next, ((v_next + time '09:00') at time zone 'Asia/Tashkent') + interval '10 minutes',
                      'operators'::text;
end;
$$;

-- Whether a staff member wrote to, called or noted the lead after [p_since]
-- (an automatic message is not one: fn_is_automatic_outgoing).
create or replace function public.fn_lead_touched_since(p_lead uuid, p_since timestamptz)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
           select 1
             from public.messages m
            where m.direction = 'outgoing'
              and m.source in ('instagram', 'telegram')
              and m.created_at > p_since
              and not public.fn_is_automatic_outgoing(m.content, m.metadata)
              and (exists (select 1 from public.communication_identities ci
                            where ci.channel = m.source and ci.identifier = m.sender_id and ci.lead_id = p_lead)
                   or exists (select 1 from public.leads l
                               where l.id = p_lead and l.source = m.source and l.source_id = m.sender_id)))
      or exists (select 1 from public.calls c where c.lead_id = p_lead and c.created_at > p_since)
      or exists (select 1 from public.lead_notes n where n.lead_id = p_lead and n.created_at > p_since);
$$;

revoke all on function public.fn_lead_touched_since(uuid, timestamptz) from public, anon, authenticated;

-- Leads back in the app on [p_day] (Tashkent) two or more days after their
-- last visit: when they came, and after how many days. Test devices aside.
create or replace function public.fn_app_came_back(p_day date)
returns table (lead_id uuid, first_at timestamptz, days_away int)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with li as (
    select i.install_id, i.lead_id
      from public.app_installs i
     where i.lead_id is not null and i.test_reason is null
  ),
  today as (
    select li.lead_id, min(e.occurred_at) as first_at
      from li
      join public.app_events e on e.install_id = li.install_id
     where e.occurred_at >= (p_day::timestamp at time zone 'Asia/Tashkent')
       and e.occurred_at < ((p_day + 1)::timestamp at time zone 'Asia/Tashkent')
     group by li.lead_id
  ),
  prev as (
    select t.lead_id, t.first_at,
           (select max(e.occurred_at)
              from li l2
              join public.app_events e on e.install_id = l2.install_id
             where l2.lead_id = t.lead_id and e.occurred_at < t.first_at) as prev_at
      from today t
  )
  select p.lead_id, p.first_at, floor(extract(epoch from (p.first_at - p.prev_at)) / 86400)::int
    from prev p
   where p.prev_at is not null and p.prev_at <= p.first_at - interval '2 days';
$$;

revoke all on function public.fn_app_came_back(date) from public, anon, authenticated;

-- Every minute: the four signals, and the tasks that closed themselves.
create or replace function public.app_signals_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_since   timestamptz;
  v_now     timestamptz := clock_timestamp();
  v_today   date := (v_now at time zone 'Asia/Tashkent')::date;
  v_day0    timestamptz := v_today::timestamp at time zone 'Asia/Tashkent';
  v_n1      int := 0;
  v_n2      int := 0;
  v_n3      int := 0;
  v_n4      int := 0;
  v_closed  int := 0;
  v_expired int := 0;
  v_rules   text[];
begin
  select s.at into v_since from public.app_analytics_state s where s.key = 'signals';
  v_since := coalesce(v_since, v_now - interval '1 hour') - interval '1 minute';
  select coalesce(array_agg(r.key), '{}') into v_rules from public.app_signal_rules r where r.enabled;

  -- 1. A new request: the lead form, or the app's code in a Telegram chat.
  if 'new_app_request' = any (v_rules) then
    with asked as (
      select l.id as lead_id, l.quiz_submitted_at as asked_at, 'form' as via
        from public.leads l
       where l.quiz_submitted_at > v_since and l.quiz_submitted_at <= v_now
      union all
      select a.lead_id, a.created_at, 'telegram'
        from public.app_identity a
       where a.via in ('telegram_code', 'bot_start') and a.created_at > v_since and a.created_at <= v_now
    ),
    firsts as (
      select distinct on (asked.lead_id) asked.* from asked order by asked.lead_id, asked.asked_at
    )
    insert into public.app_signals (rule_key, lead_id, day, asked_at, due_at, target, assigned_to, detail)
    select 'new_app_request', f.lead_id, d.day, f.asked_at, d.due_at, d.target, l.assigned_to,
           jsonb_build_object('via', f.via)
      from firsts f
      join public.leads l on l.id = f.lead_id
      cross join lateral public.fn_app_request_due(f.asked_at) d
     where l.converted_to_student_id is null and l.status not in ('converted', 'lost')
    on conflict (lead_id, day) where lead_id is not null do nothing;
    get diagnostics v_n1 = row_count;
  end if;

  -- 2. Back in the app after two days and more.
  if 'came_back' = any (v_rules) then
    insert into public.app_signals (rule_key, lead_id, day, asked_at, target, assigned_to, detail)
    select 'came_back', c.lead_id, v_today, c.first_at,
           case when l.assigned_to is not null then 'owner' else 'operators' end, l.assigned_to,
           jsonb_build_object('days', c.days_away)
      from public.fn_app_came_back(v_today) c
      join public.leads l on l.id = c.lead_id
     where l.converted_to_student_id is null and l.status not in ('converted', 'lost')
    on conflict (lead_id, day) where lead_id is not null do nothing;
    get diagnostics v_n2 = row_count;
  end if;

  -- 3. The report seen, or the third ♥, today — once per lead.
  if 'report_or_picks' = any (v_rules) then
    with li as (
      select i.install_id, i.lead_id from public.app_installs i
       where i.lead_id is not null and i.test_reason is null
    ),
    today as (
      select li.lead_id,
             min(e.occurred_at) filter (where e.event = 'report_view') as report_at,
             min(e.occurred_at) filter (where e.event = 'slot_set') as heart_at
        from li
        join public.app_events e on e.install_id = li.install_id
       where e.event in ('report_view', 'slot_set') and e.occurred_at >= v_day0
       group by li.lead_id
    ),
    hit as (
      select t.lead_id, p.report_views, cardinality(p.picks) as picks,
             least(t.report_at, case when cardinality(p.picks) >= 3 then t.heart_at end) as at
        from today t
        join lateral (select pp.report_views, pp.picks from public.app_person_profile pp
                       where pp.lead_id = t.lead_id order by pp.last_seen_at desc nulls last limit 1) p on true
       where t.report_at is not null or (t.heart_at is not null and cardinality(p.picks) >= 3)
    )
    insert into public.app_signals (rule_key, lead_id, day, asked_at, target, assigned_to, detail)
    select 'report_or_picks', h.lead_id, v_today, h.at,
           case when l.assigned_to is not null then 'owner' else 'operators' end, l.assigned_to,
           jsonb_build_object('report', h.report_views > 0, 'picks', h.picks)
      from hit h
      join public.leads l on l.id = h.lead_id
     where h.at is not null
       and l.converted_to_student_id is null and l.status not in ('converted', 'lost')
       and not exists (select 1 from public.app_signals s where s.rule_key = 'report_or_picks' and s.lead_id = h.lead_id)
    on conflict (lead_id, day) where lead_id is not null do nothing;
    get diagnostics v_n3 = row_count;
  end if;

  -- 4. A university offer the student has not answered for 48 hours.
  if 'offer_unanswered' = any (v_rules) then
    insert into public.app_signals (rule_key, user_id, day, asked_at, target, detail)
    select 'offer_unanswered', c.student_id, v_today, min(c.created_at), 'documents',
           jsonb_build_object('offers', count(*))
      from public.student_university_choices c
     where c.status = 'offered' and c.responded_at is null and c.created_at <= v_now - interval '48 hours'
     group by c.student_id
    having not exists (select 1 from public.app_signals s
                        where s.rule_key = 'offer_unanswered' and s.user_id = c.student_id and s.status = 'open')
    on conflict (user_id, rule_key, day) where lead_id is null do nothing;
    get diagnostics v_n4 = row_count;
  end if;

  -- The tasks that closed themselves.
  with done as (
    update public.app_signals s
       set status = 'done', done_at = v_now
      from public.leads l
     where s.status = 'open'
       and s.lead_id = l.id
       and (l.converted_to_student_id is not null
            or l.status in ('converted', 'lost')
            or (s.rule_key = 'new_app_request'
                and (l.last_contacted_at >= s.asked_at - interval '1 minute' or l.call_result is not null))
            or public.fn_lead_touched_since(l.id, case when s.rule_key = 'new_app_request'
                                                       then s.asked_at - interval '1 minute'
                                                       else s.created_at end))
    returning 1
  )
  select count(*) into v_closed from done;

  with done as (
    update public.app_signals s
       set status = 'done', done_at = v_now
     where s.status = 'open'
       and s.rule_key = 'offer_unanswered'
       and not exists (select 1 from public.student_university_choices c
                        where c.student_id = s.user_id and c.status = 'offered' and c.responded_at is null
                          and c.created_at <= v_now - interval '48 hours')
    returning 1
  )
  select v_closed + count(*) into v_closed from done;

  -- A lead's BUGUN task is for its day.
  update public.app_signals s
     set status = 'expired', done_at = v_now
   where s.status = 'open' and s.lead_id is not null and s.rule_key <> 'new_app_request' and s.day < v_today;
  get diagnostics v_expired = row_count;

  insert into public.app_analytics_state (key, at) values ('signals', v_now)
  on conflict (key) do update set at = excluded.at;
  return jsonb_build_object('request', v_n1, 'came_back', v_n2, 'report_or_picks', v_n3, 'offers', v_n4,
                            'closed', v_closed, 'expired', v_expired);
end;
$$;

revoke all on function public.app_signals_tick() from public, anon, authenticated;

-- The HOZIR tasks whose timer ran out, for lead-sla-check to send to Telegram
-- (with «Ilova» in the text): to the boss in the evening, to the staff
-- channel and recipients otherwise. A working-day request from a new lead
-- with a phone is left to the lead SLA, which already sends it and repeats it.
-- Marks what it hands back ([p_dry]: only looks).
create or replace function public.app_signal_alerts(p_dry boolean default false)
returns table (id bigint, lead_id uuid, full_name text, phone text, how_heard text, source text, via text,
               target text, asked_at timestamptz, minutes_waiting int)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  return query
  with due as (
    select s.id as sid,
           -- what fn_lead_sla_scan sends on a working day
           s.target = 'operators'
           and coalesce(btrim(l.phone), '') <> ''
           and l.new_lead_at is not null
           and l.last_contacted_at is null
           and l.call_result is null as by_sla
      from public.app_signals s
      join public.leads l on l.id = s.lead_id
     where s.status = 'open' and s.rule_key = 'new_app_request' and s.alerted_at is null and s.due_at <= now()
  ),
  marked as (
    update public.app_signals s set alerted_at = now()
      from due d
     where d.sid = s.id and not p_dry
    returning s.id
  )
  select s.id, s.lead_id, l.full_name, l.phone, l.how_heard, l.source, s.detail ->> 'via', s.target, s.asked_at,
         floor(extract(epoch from (now() - s.asked_at)) / 60)::int
    from due d
    join public.app_signals s on s.id = d.sid
    join public.leads l on l.id = s.lead_id
   where not d.by_sla
   order by s.asked_at;
end;
$$;

revoke all on function public.app_signal_alerts(boolean) from public, anon, authenticated;
grant execute on function public.app_signal_alerts(boolean) to service_role;

-- 4. The CRM's reads -------------------------------------------------------------------
-- The person a lead or a student is (their profile row), or null.
create or replace function public.fn_app_person_of(p_lead_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(
    (select p.person_key from public.app_person_profile p where p_user_id is not null and p.user_id = p_user_id
      order by p.last_seen_at desc nulls last limit 1),
    (select p.person_key from public.app_person_profile p where p_lead_id is not null and p.lead_id = p_lead_id
      order by p.last_seen_at desc nulls last limit 1));
$$;

revoke all on function public.fn_app_person_of(uuid, uuid) from public, anon, authenticated;

-- «Ilovada» on a lead's card: the profile, the lead's own answers (where it
-- found us, who for), the ways the phone was tied, the ♥ universities by
-- name, the devices. Null when no device is tied. Logged.
create or replace function public.analytics_person(p_lead_id uuid default null, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_key  text;
  v_p    public.app_person_profile%rowtype;
  v_lead public.leads%rowtype;
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_key := public.fn_app_person_of(p_lead_id, p_user_id);
  if v_key is null then
    return null;
  end if;
  select * into v_p from public.app_person_profile where person_key = v_key;
  select * into v_lead from public.leads where id = coalesce(p_lead_id, v_p.lead_id);
  insert into public.analytics_access_log (viewer, person_key, lead_id, user_id, what)
  values (auth.uid(), v_key, v_p.lead_id, v_p.user_id, 'profile');

  return jsonb_build_object(
    'person_key', v_p.person_key,
    'lead_id', v_p.lead_id,
    'user_id', v_p.user_id,
    'platform', v_p.platform,
    'first_seen_at', v_p.first_seen_at,
    'last_seen_at', v_p.last_seen_at,
    'visits', v_p.visits,
    'active_days', v_p.active_days,
    'milestones', to_jsonb(v_p.milestones),
    'lead_source', v_lead.source,
    'contact_channel', v_lead.contact_channel,
    'how_heard', v_lead.how_heard,
    'how_heard_key', public.fn_how_heard_key(v_lead.how_heard),
    'for_whom', v_lead.for_whom,
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object('institution_id', x.iid, 'name_en', i.name_en, 'name_ko', i.name_ko)
                       order by x.ord)
        from unnest(v_p.picks) with ordinality as x(iid, ord)
        left join public.institutions i on i.id::text = x.iid
    ), '[]'::jsonb),
    'visa', case when v_p.visa_band is null then null else jsonb_build_object(
      'band', v_p.visa_band, 'bucket', v_p.visa_bucket, 'low', v_p.visa_low,
      'topik', v_p.visa_topik, 'income', v_p.visa_income) end,
    'tariff', coalesce(v_p.tariff, v_lead.tariff_interest),
    'report_views', v_p.report_views,
    'report_at', v_p.report_at,
    'request_at', v_p.request_at,
    'score', v_p.score,
    'is_test', v_p.is_test,
    'ai_summary', v_p.ai_summary,
    'ai_starter', v_p.ai_starter,
    'ai_at', v_p.ai_at,
    'ai_fresh', v_p.ai_seen_at is not null and v_p.ai_seen_at >= v_p.last_seen_at,
    'ties', coalesce((
      select jsonb_agg(jsonb_build_object('via', a.via, 'at', a.created_at) order by a.created_at)
        from public.app_identity a
       where a.install_id = any (v_p.installs)
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('platform', i.platform, 'model', i.model, 'os', i.os,
                                          'os_version', i.os_version, 'app_version', i.app_version,
                                          'last_seen_at', i.last_seen_at) order by i.last_seen_at desc nulls last)
        from public.app_installs i
       where i.install_id = any (v_p.installs)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.analytics_person(uuid, uuid) from public, anon;
grant execute on function public.analytics_person(uuid, uuid) to authenticated;

-- «To'liq yo'l»: the person's visits in the last [p_days] days and their
-- steps (screens with their time, what was pressed and done), newest first,
-- at most [p_limit] steps. Logged.
create or replace function public.analytics_person_journey(
  p_lead_id uuid default null, p_user_id uuid default null, p_days int default 30, p_limit int default 300)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_key   text;
  v_p     public.app_person_profile%rowtype;
  v_from  timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 90)));
  v_limit int := greatest(10, least(coalesce(p_limit, 300), 1000));
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_key := public.fn_app_person_of(p_lead_id, p_user_id);
  if v_key is null then
    return null;
  end if;
  select * into v_p from public.app_person_profile where person_key = v_key;
  insert into public.analytics_access_log (viewer, person_key, lead_id, user_id, what)
  values (auth.uid(), v_key, v_p.lead_id, v_p.user_id, 'journey');

  return jsonb_build_object(
    'person_key', v_key,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'started_at', s.started_at, 'ended_at', s.ended_at, 'duration_s', s.duration_s,
               'entry_screen', s.entry_screen, 'exit_screen', s.exit_screen, 'exit_event', s.exit_event,
               'events', s.events, 'taps', s.taps, 'platform', i.platform)
             order by s.started_at desc)
        from public.app_sessions s
        join public.app_installs i on i.install_id = s.install_id
       where s.install_id = any (v_p.installs) and s.started_at >= v_from
    ), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at', x.occurred_at, 'event', x.event, 'screen', x.screen, 'element', x.element,
               'duration_ms', x.duration_ms, 'props', x.props - 'x' - 'y')
             order by x.occurred_at desc, x.seq desc nulls last)
        from (select e.* from public.app_events e
               where e.install_id = any (v_p.installs) and e.occurred_at >= v_from
                 -- the plumbing of a visit is not a step
                 and e.event not in ('session_start', 'app_ready', 'rpc_slow', 'card_view', 'sheet_close', 'screen_view')
                 and not (e.event = 'tap' and e.element is null)
               order by e.occurred_at desc, e.seq desc nulls last
               limit v_limit) x
    ), '[]'::jsonb),
    'truncated', (select count(*) from public.app_events e
                   where e.install_id = any (v_p.installs) and e.occurred_at >= v_from
                     and e.event not in ('session_start', 'app_ready', 'rpc_slow', 'card_view', 'sheet_close', 'screen_view')
                     and not (e.event = 'tap' and e.element is null)) > v_limit
  );
end;
$$;

revoke all on function public.analytics_person_journey(uuid, uuid, int, int) from public, anon;
grant execute on function public.analytics_person_journey(uuid, uuid, int, int) to authenticated;

-- «Odamlar»: every person and device seen in the last [p_days] days with
-- their own answer to «Qayerdan topdingiz?» (S3), stage and app score. Test
-- devices only when asked (S10). Not logged: a list, not anyone's path.
create or replace function public.analytics_people(
  p_days int default 30, p_kind text default null, p_include_test boolean default false,
  p_search text default null, p_limit int default 200, p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 400)));
  v_q    text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_out  jsonb;
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with rows as (
    select p.*,
           case when p.user_id is not null then 'student' when p.lead_id is not null then 'lead' else 'guest' end as kind,
           coalesce(pr.full_name, l.full_name) as name,
           l.how_heard, public.fn_how_heard_key(l.how_heard) as how_heard_key, l.for_whom,
           l.status as lead_status, l.assigned_to, l.source as lead_source
      from public.app_person_profile p
      left join public.leads l on l.id = p.lead_id
      left join public.profiles pr on pr.user_id = p.user_id
     where p.last_seen_at >= v_from
       and (p_include_test or not p.is_test)
  ),
  picked as (
    select r.* from rows r
     where (p_kind is null or r.kind = p_kind)
       and (v_q is null or lower(coalesce(r.name, '')) like '%' || v_q || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from picked),
    'kinds', coalesce((select jsonb_object_agg(k.kind, k.n) from (select kind, count(*) as n from rows group by kind) k),
                      '{}'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'person_key', r.person_key, 'kind', r.kind, 'name', r.name, 'lead_id', r.lead_id, 'user_id', r.user_id,
               'how_heard', r.how_heard, 'how_heard_key', r.how_heard_key, 'for_whom', r.for_whom,
               'lead_status', r.lead_status, 'lead_source', r.lead_source, 'assigned_to', r.assigned_to,
               'platform', r.platform, 'last_seen_at', r.last_seen_at, 'visits', r.visits, 'score', r.score,
               'picks', cardinality(r.picks), 'visa_band', r.visa_band, 'report', r.report_views > 0,
               'request', r.request_at is not null, 'is_test', r.is_test)
             order by r.last_seen_at desc)
        from (select * from picked order by last_seen_at desc
               limit greatest(1, least(coalesce(p_limit, 200), 500)) offset greatest(0, coalesce(p_offset, 0))) r
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

revoke all on function public.analytics_people(int, text, boolean, text, int, int) from public, anon;
grant execute on function public.analytics_people(int, text, boolean, text, int, int) to authenticated;

-- «Bugun ilovada»: the three numbers on top (requests waiting and the nearest
-- timer, leads back in the app today, offers the students have not answered)
-- and the open tasks — HOZIR first — with who, what, when, and for whom.
create or replace function public.analytics_today_in_app()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'now', now(),
    'waiting', (select count(*) from public.app_signals s where s.status = 'open' and s.rule_key = 'new_app_request'),
    'waiting_due_at', (select min(s.due_at) from public.app_signals s
                        where s.status = 'open' and s.rule_key = 'new_app_request'),
    'came_back', (select count(*) from public.fn_app_came_back(v_today) c
                    join public.leads l on l.id = c.lead_id
                   where l.converted_to_student_id is null),
    'offers_waiting', (select count(*) from public.student_university_choices c where c.status = 'offered'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'rule', s.rule_key, 'queue', r.queue, 'target', s.target,
               'asked_at', s.asked_at, 'due_at', s.due_at, 'day', s.day, 'detail', s.detail,
               'lead_id', s.lead_id, 'user_id', s.user_id,
               'kind', case when s.lead_id is not null then 'lead' else 'student' end,
               'name', coalesce(l.full_name, sp.full_name),
               'source', l.source, 'contact_channel', l.contact_channel,
               'assigned_to', s.assigned_to, 'assignee', ap.full_name)
             order by case r.queue when 'now' then 0 else 1 end, s.due_at nulls last, s.asked_at desc)
        from public.app_signals s
        join public.app_signal_rules r on r.key = s.rule_key
        left join public.leads l on l.id = s.lead_id
        left join public.profiles sp on sp.user_id = s.user_id
        left join public.profiles ap on ap.user_id = s.assigned_to
       where s.status = 'open'
         and (r.queue = 'now' or s.lead_id is null or s.day = v_today)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.analytics_today_in_app() from public, anon;
grant execute on function public.analytics_today_in_app() to authenticated;

-- app-journey-summary stores what it wrote (service role only).
create or replace function public.app_person_summary_store(
  p_person_key text, p_summary text, p_starter text, p_seen_at timestamptz)
returns boolean
language sql
security definer
set search_path to 'pg_catalog', 'public'
as $$
  update public.app_person_profile
     set ai_summary = left(p_summary, 1200), ai_starter = left(p_starter, 600), ai_at = now(), ai_seen_at = p_seen_at
   where person_key = p_person_key
  returning true;
$$;

revoke all on function public.app_person_summary_store(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.app_person_summary_store(text, text, text, timestamptz) to service_role;

-- 5. Every few minutes ----------------------------------------------------------------
do $$
begin
  perform cron.unschedule('app-person-profiles') where exists (select 1 from cron.job where jobname = 'app-person-profiles');
  perform cron.unschedule('app-signals') where exists (select 1 from cron.job where jobname = 'app-signals');
end $$;
-- Two minutes after app-analytics-refresh, so the sessions and days are fresh.
select cron.schedule('app-person-profiles', '2-59/5 * * * *', 'select public.app_person_profiles_refresh()');
select cron.schedule('app-signals', '* * * * *', 'select public.app_signals_tick()');

-- The first build of every profile; signals start from now.
select public.app_person_profiles_refresh(true);
insert into public.app_analytics_state (key, at) values ('signals', now())
on conflict (key) do update set at = excluded.at;
