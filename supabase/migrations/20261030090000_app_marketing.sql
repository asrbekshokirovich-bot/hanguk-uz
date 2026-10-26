-- App analytics, stage 4: the marketing panel — the plan's «CRM · Ilova
-- analitikasi · Marketing» (2026-10-22) with the owner's answers: S1 the main
-- number is the app-involved contract, S2 one funnel, S3 channels by the
-- person's own answer to «Qayerdan topdingiz?» (eight rows and «Noma'lum»),
-- S8 a period and the one before it, S9 spend typed in by channel, S10 test
-- devices left out unless asked, S11 three numbers on top.
--
-- * ad_spend: the week's spend per channel (owner and admin type it in).
-- * fn_app_install_channel: a device's channel — the own answer of the lead
--   it is tied to (or of the student's lead); 'unknown' otherwise.
-- * analytics_marketing(from, to, test): one period, Tashkent days inclusive —
--   the three numbers (new active devices; requests from the app — the form
--   and the app's code in Telegram — and their share of all new leads;
--   app-involved contracts), the channel table, the funnel (all and per
--   channel), demand, the places people stop, new against returning. With
--   a cut (S4, p_seg) every block counts only the devices in it — and the
--   requests and contracts of the people those devices belong to.
-- * analytics_retention(weeks, test, seg): week cohorts, back on day 1,
--   within 7 and within 30 days.
-- * analytics_segment_options(test): what the cuts can be — the answers the
--   app has seen, the cities on tied cards.
-- * analytics_live(minutes): who is in the app right now and what they do
--   («Jonli»: devices now, how many of them are known leads, the last hour's steps).
-- * analytics_spend_set / analytics_spend_list.
--
-- Definitions (the plan's «Ta'riflar»): a request is the «Konsultant
-- bog'lansin» form or a Telegram message with the app's code; an
-- app-involved contract is one whose person's device is tied to the card and
-- did at least one thing in the app before the contract day; a device is
-- one phone or one browser.

-- 1. Spend --------------------------------------------------------------------------
create table if not exists public.ad_spend (
  id          bigint generated always as identity primary key,
  -- the Monday of the week
  week_start  date not null check (extract(isodow from week_start) = 1),
  channel     text not null references public.lead_how_heard (key),
  amount      numeric(14, 2) not null check (amount > 0),
  currency    text not null default 'USD' check (currency in ('USD', 'UZS')),
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (week_start, channel, currency)
);

alter table public.ad_spend enable row level security;
drop policy if exists ad_spend_staff_read on public.ad_spend;
create policy ad_spend_staff_read on public.ad_spend for select to authenticated
  using (public.app_events_staff_can_read());

-- The week's spend on a channel; nothing or 0 removes it. Owner and admin.
create or replace function public.analytics_spend_set(
  p_week date, p_channel text, p_amount numeric, p_currency text default 'USD', p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_week date := date_trunc('week', p_week::timestamp)::date;
begin
  if not (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lead_how_heard h where h.key = p_channel) then
    return jsonb_build_object('status', 'bad_channel');
  end if;
  if coalesce(p_currency, '') not in ('USD', 'UZS') then
    return jsonb_build_object('status', 'bad_currency');
  end if;
  if p_amount is null or p_amount <= 0 then
    delete from public.ad_spend where week_start = v_week and channel = p_channel and currency = p_currency;
    return jsonb_build_object('status', 'removed');
  end if;
  insert into public.ad_spend (week_start, channel, amount, currency, note, created_by)
  values (v_week, p_channel, p_amount, p_currency, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (week_start, channel, currency) do update
     set amount = excluded.amount, note = excluded.note, created_by = excluded.created_by, updated_at = now();
  return jsonb_build_object('status', 'ok', 'week', v_week);
end;
$$;

revoke all on function public.analytics_spend_set(date, text, numeric, text, text) from public, anon;
grant execute on function public.analytics_spend_set(date, text, numeric, text, text) to authenticated;

-- 2. A device's channel ---------------------------------------------------------------
create or replace function public.fn_app_install_channel(p_lead_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(
    public.fn_how_heard_key(
      coalesce((select l.how_heard from public.leads l where l.id = p_lead_id),
               (select l.how_heard from public.leads l
                 where p_user_id is not null and l.converted_to_student_id = p_user_id
                 order by l.created_at limit 1))),
    'unknown');
$$;

revoke all on function public.fn_app_install_channel(uuid, uuid) from public, anon, authenticated;

-- 2b. Cuts (S4) -------------------------------------------------------------------------
-- A device's latest answer to a test question (question_answer: the range
-- the app sends, never the figure) before [p_before].
create or replace function public.fn_app_answer(p_install uuid, p_q text, p_before timestamptz)
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select e.props ->> 'band'
    from public.app_events e
   where e.install_id = p_install and e.event = 'question_answer' and e.props ->> 'q' = p_q
     and e.occurred_at < p_before
   order by e.occurred_at desc
   limit 1;
$$;

revoke all on function public.fn_app_answer(uuid, text, timestamptz) from public, anon, authenticated;

-- The cut, cleaned: an object of text values; empty values and unknown keys left out.
create or replace function public.fn_app_segment(p_seg jsonb)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each_text(case when jsonb_typeof(p_seg) = 'object' then p_seg else '{}'::jsonb end) x(k, v)
   where v is not null and btrim(v) <> ''
     and k in ('who', 'channel', 'platform', 'age', 'route', 'topik', 'ielts', 'bank', 'income',
               'income_documented', 'region', 'for_whom');
$$;

-- Whether a device is in the cut (S4, «hamma kesimlar»): who — 'guest' or
-- 'client' (signed in with a client code); channel — its «Qayerdan
-- topdingiz?» key or 'unknown'; platform; age — 'new' (first seen in the
-- period) or 'returning'; route, topik, ielts, bank, income,
-- income_documented — its latest answer; region — the city on its card;
-- for_whom — the card's «Kim uchun?». Keys left out don't cut.
create or replace function public.fn_app_in_segment(
  p_install uuid, p_user uuid, p_platform text, p_channel text, p_first_seen timestamptz, p_lead uuid,
  p_seg jsonb, p_t0 timestamptz, p_t1 timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  q text;
begin
  if p_seg ? 'who' and (p_seg ->> 'who' = 'client') <> (p_user is not null) then return false; end if;
  if p_seg ? 'channel' and p_channel is distinct from p_seg ->> 'channel' then return false; end if;
  if p_seg ? 'platform' and p_platform is distinct from p_seg ->> 'platform' then return false; end if;
  if p_seg ? 'age' and p_t0 is not null and (p_seg ->> 'age' = 'new') <> (p_first_seen >= p_t0) then return false; end if;
  if p_seg ? 'region' and not exists (
       select 1 from public.leads l
        where l.id = p_lead and lower(btrim(l.city)) = lower(btrim(p_seg ->> 'region'))) then
    return false;
  end if;
  if p_seg ? 'for_whom' and not exists (
       select 1 from public.leads l where l.id = p_lead and l.for_whom = p_seg ->> 'for_whom') then
    return false;
  end if;
  foreach q in array array['route', 'topik', 'ielts', 'bank', 'income', 'income_documented'] loop
    if p_seg ? q and public.fn_app_answer(p_install, q, p_t1) is distinct from p_seg ->> q then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.fn_app_in_segment(uuid, uuid, text, text, timestamptz, uuid, jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;

-- What each cut can be: the answers seen (with how many devices gave them)
-- and the cities on cards tied to a device. Test devices aside unless asked.
create or replace function public.analytics_segment_options(p_include_test boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not (public.app_events_staff_can_read() or auth.role() = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'answers', coalesce((
      select jsonb_object_agg(x.q, x.bands)
        from (select y.q, jsonb_agg(jsonb_build_object('band', y.band, 'devices', y.n)
                                    order by case when y.band ~ '^\d+(\.\d+)?$' then y.band::numeric end, y.band) as bands
                from (select e.props ->> 'q' as q, e.props ->> 'band' as band, count(distinct e.install_id) as n
                        from public.app_events e
                        join public.app_installs i on i.install_id = e.install_id
                       where e.event = 'question_answer' and (p_include_test or i.test_reason is null)
                         and e.props ->> 'q' in ('route', 'topik', 'ielts', 'bank', 'income', 'income_documented')
                         and coalesce(e.props ->> 'band', '') <> ''
                       group by 1, 2) y
               group by y.q) x), '{}'::jsonb),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('value', r.v, 'devices', r.n) order by r.n desc, r.v)
        from (select btrim(l.city) as v, count(distinct i.install_id) as n
                from public.app_installs i
                join public.leads l on l.id = i.lead_id
               where (p_include_test or i.test_reason is null) and coalesce(btrim(l.city), '') <> ''
               group by 1) r), '[]'::jsonb));
end;
$$;

revoke all on function public.analytics_segment_options(boolean) from public, anon;
grant execute on function public.analytics_segment_options(boolean) to authenticated, service_role;

-- 3. The panel ------------------------------------------------------------------------
create or replace function public.analytics_marketing(
  p_from date, p_to date, p_include_test boolean default false, p_seg jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_t0  timestamptz := p_from::timestamp at time zone 'Asia/Tashkent';
  v_t1  timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Tashkent';
  v_seg jsonb := public.fn_app_segment(p_seg);
  -- no cut: requests, leads and contracts are counted whole, as before
  v_all boolean := public.fn_app_segment(p_seg) = '{}'::jsonb;
  v_out jsonb;
begin
  if not (public.app_events_staff_can_read() or auth.role() = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'bad period' using errcode = '22023';
  end if;

  with dev0 as (
    select i.install_id, i.first_seen_at, i.lead_id, i.user_id, i.platform,
           public.fn_app_install_channel(i.lead_id, i.user_id) as channel,
           coalesce(i.lead_id, (select l.id from public.leads l
                                 where i.user_id is not null and l.converted_to_student_id = i.user_id
                                 order by l.created_at limit 1)) as lead_key
      from public.app_installs i
     where p_include_test or i.test_reason is null
  ),
  dev as (
    select d.* from dev0 d
     where v_all
        or public.fn_app_in_segment(d.install_id, d.user_id, d.platform, d.channel, d.first_seen_at, d.lead_key,
                                    v_seg, v_t0, v_t1)
  ),
  days as (
    select d.install_id, d.milestones
      from public.app_device_days d
      join dev on dev.install_id = d.install_id
     where d.day between p_from and p_to
  ),
  dev_ms as (
    select d.install_id, array_agg(distinct m) as ms
      from days d cross join lateral unnest(d.milestones) m
     group by d.install_id
  ),
  new_dev as (
    select dev.*, coalesce(ms.ms, '{}') as ms
      from dev left join dev_ms ms on ms.install_id = dev.install_id
     where dev.first_seen_at >= v_t0 and dev.first_seen_at < v_t1
  ),
  -- requests: the form, or the app's code in a Telegram chat
  req as (
    select l.id as lead_id, 'form' as via, l.how_heard
      from public.leads l
     where l.quiz_submitted_at >= v_t0 and l.quiz_submitted_at < v_t1
       and (v_all or l.id in (select dev.lead_key from dev))
    union
    select a.lead_id, 'telegram', l.how_heard
      from public.app_identity a
      join public.leads l on l.id = a.lead_id
     where a.via in ('telegram_code', 'bot_start') and a.created_at >= v_t0 and a.created_at < v_t1
       and (v_all or l.id in (select dev.lead_key from dev))
  ),
  req_lead as (
    select r.lead_id, bool_or(r.via = 'form') as form, bool_or(r.via = 'telegram') as tg,
           coalesce(public.fn_how_heard_key(max(r.how_heard)), 'unknown') as channel
      from req r group by r.lead_id
  ),
  -- contracts in the period: a lead's (or its student's) date; a student without a lead
  contracts as (
    select l.id as lead_id, l.converted_to_student_id as user_id, coalesce(l.contract_date, p.contract_date) as cdate,
           coalesce(public.fn_how_heard_key(l.how_heard), 'unknown') as channel
      from public.leads l
      left join public.profiles p on p.user_id = l.converted_to_student_id
     where coalesce(l.contract_date, p.contract_date) between p_from and p_to
       and (v_all or l.id in (select dev.lead_key from dev))
    union all
    select null, p.user_id, p.contract_date, 'unknown'
      from public.profiles p
     where p.contract_date between p_from and p_to
       and not exists (select 1 from public.leads l where l.converted_to_student_id = p.user_id)
       and (v_all or p.user_id in (select dev.user_id from dev))
  ),
  -- app-involved: a tied device did something in the app before the contract day ended
  app_contracts as (
    select c.* from contracts c
     where exists (
       select 1
         from public.app_installs i
         join public.app_events e on e.install_id = i.install_id
        where (i.lead_id = c.lead_id or (c.user_id is not null and i.user_id = c.user_id))
          and (p_include_test or i.test_reason is null)
          and e.occurred_at < ((c.cdate + 1)::timestamp at time zone 'Asia/Tashkent')
          and e.event not in ('app_ready', 'session_start', 'rpc_slow', 'rpc_error', 'app_error', 'card_view'))
  ),
  talked as (
    select l.id from public.leads l
     where l.last_contacted_at is not null or l.call_result is not null or l.status not in ('new')
  ),
  channels as (
    select h.key, h.sort from public.lead_how_heard h
    union all select 'unknown', 999
  ),
  spend as (
    select s.channel, s.currency, sum(s.amount) as amount
      from public.ad_spend s
     where s.week_start between p_from - 6 and p_to
     group by s.channel, s.currency
  ),
  -- the funnel per device (S2: one funnel, each step "reached at least once")
  funnel_dev as (
    select n.install_id, n.channel,
           true as opened,
           'active' = any (n.ms) as active,
           'uni_open' = any (n.ms) as uni,
           n.ms && array['heart', 'assess'] as intent,
           'report' = any (n.ms) as report,
           ('request' = any (n.ms) or n.lead_key in (select r.lead_id from req_lead r)) as request,
           n.lead_key in (select t.id from talked t) as talked,
           (n.lead_key in (select c.lead_id from app_contracts c where c.lead_id is not null)
            or (n.user_id is not null and n.user_id in (select c.user_id from app_contracts c where c.user_id is not null))) as contract
      from new_dev n
  ),
  funnel as (
    select coalesce(f.channel, 'all') as channel,
           jsonb_build_array(count(*), count(*) filter (where f.active), count(*) filter (where f.uni),
                             count(*) filter (where f.intent), count(*) filter (where f.report),
                             count(*) filter (where f.request), count(*) filter (where f.talked),
                             count(*) filter (where f.contract)) as steps
      from funnel_dev f
     group by grouping sets ((), (f.channel))
  ),
  evp as (
    select e.install_id, e.event, e.screen, e.element, e.props, e.user_id, e.occurred_at
      from public.app_events e
      join dev on dev.install_id = e.install_id
     where e.occurred_at >= v_t0 and e.occurred_at < v_t1
  ),
  active_dev as (
    select distinct d.install_id from days d where 'active' = any (d.milestones)
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'include_test', p_include_test, 'seg', v_seg,
    'kpi', jsonb_build_object(
      'new_devices', (select count(*) from new_dev),
      'new_active', (select count(*) from new_dev where 'active' = any (ms)),
      'requests', (select count(*) from req_lead),
      'requests_form', (select count(*) from req_lead where form),
      'requests_telegram', (select count(*) from req_lead where tg),
      'new_leads', (select count(*) from public.leads l where l.created_at >= v_t0 and l.created_at < v_t1
                       and (v_all or l.id in (select dev.lead_key from dev))),
      'contracts', (select count(*) from contracts),
      'app_contracts', (select count(*) from app_contracts),
      'test_devices', (select count(*) from public.app_installs i where i.test_reason is not null)
    ),
    'channels', (
      select jsonb_agg(jsonb_build_object(
               'key', c.key,
               'new_devices', (select count(*) from new_dev n where n.channel = c.key),
               'active', (select count(*) from new_dev n where n.channel = c.key and 'active' = any (n.ms)),
               'requests', (select count(*) from req_lead r where r.channel = c.key),
               'contracts', (select count(*) from app_contracts a where a.channel = c.key),
               'spend', coalesce((select jsonb_object_agg(s.currency, s.amount) from spend s where s.channel = c.key), '{}'::jsonb))
             order by c.sort)
        from channels c
    ),
    'funnel', (select jsonb_object_agg(f.channel, f.steps) from funnel f),
    'demand', jsonb_build_object(
      'filters', coalesce((
        select jsonb_agg(jsonb_build_object('field', x.k, 'value', x.v, 'devices', x.n) order by x.k, x.n desc)
          from (select kv.k, btrim(val) as v, count(distinct e.install_id) as n
                  from evp e
                  cross join lateral (values ('field', e.props ->> 'field'), ('regions', e.props ->> 'regions'),
                                             ('degree', e.props ->> 'degree'), ('topik', e.props ->> 'topik'),
                                             ('type', e.props ->> 'type')) kv(k, raw)
                  cross join lateral unnest(string_to_array(kv.raw, ',')) val
                 where e.event = 'filter_apply' and kv.raw is not null and btrim(val) <> ''
                 group by kv.k, btrim(val)) x), '[]'::jsonb),
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object('form', x.form, 'q', x.q, 'band', x.band, 'devices', x.n)
                         order by x.form, x.q, x.band)
          from (select e.props ->> 'form' as form, e.props ->> 'q' as q, e.props ->> 'band' as band,
                       count(distinct e.install_id) as n
                  from evp e
                 where e.event = 'question_answer' and e.props ? 'q'
                 group by 1, 2, 3) x), '[]'::jsonb),
      'universities', coalesce((
        select jsonb_agg(jsonb_build_object('institution_id', x.iid, 'name_en', i.name_en, 'name_ko', i.name_ko,
                                            'devices', x.devices, 'opens', x.opens, 'avg_position', x.pos,
                                            'seen', x.seen)
                         order by x.devices desc, x.opens desc)
          from (select u.iid, count(distinct u.install_id) filter (where u.event = 'university_open') as devices,
                       count(*) filter (where u.event = 'university_open') as opens,
                       round(avg(u.position) filter (where u.event = 'card_view'), 1) as pos,
                       count(distinct u.install_id) filter (where u.event = 'card_view') as seen
                  from (select e.install_id, e.event, e.props ->> 'institution_id' as iid,
                               case when (e.props ->> 'position') ~ '^\d{1,4}$' then (e.props ->> 'position')::int end as position
                          from evp e
                         where e.event in ('university_open', 'card_view') and e.props ? 'institution_id') u
                 group by u.iid
                 order by 2 desc, 3 desc
                 limit 20) x
          left join public.institutions i on i.id::text = x.iid
         where x.devices > 0), '[]'::jsonb)
    ),
    'stops', jsonb_build_object(
      'exit_screens', coalesce((
        select jsonb_agg(jsonb_build_object('screen', x.exit_screen, 'sessions', x.n) order by x.n desc)
          from (select s.exit_screen, count(*) as n
                  from public.app_sessions s
                  join dev on dev.install_id = s.install_id
                 where s.started_at >= v_t0 and s.started_at < v_t1 and s.exit_screen is not null
                 group by s.exit_screen order by 2 desc limit 10) x), '[]'::jsonb),
      'language_exits', (select count(*) from public.app_sessions s join dev on dev.install_id = s.install_id
                          where s.started_at >= v_t0 and s.started_at < v_t1 and s.exit_screen = '/language'),
      'client_code_seen', (select count(distinct e.install_id) from evp e where e.event = 'screen_view' and e.screen = '/login'),
      'client_code_left', (select count(distinct e.install_id) from evp e
                            where e.event = 'screen_view' and e.screen = '/login'
                              and not exists (select 1 from evp s where s.install_id = e.install_id
                                                 and s.event = 'sign_in' and s.props ->> 'result' = 'ok')),
      'locked_tabs', coalesce((
        select jsonb_agg(jsonb_build_object('tab', x.tab, 'devices', x.n) order by x.n desc)
          from (select e.props ->> 'tab' as tab, count(distinct e.install_id) as n
                  from evp e
                 where e.event = 'tab_open' and e.user_id is null
                   and e.props ->> 'tab' in ('prepare', 'application', 'documents')
                 group by 1) x), '[]'::jsonb),
      'lead_form', jsonb_build_object(
        'opened', (select count(distinct e.install_id) from evp e
                    where e.event = 'form_open' and e.props ->> 'form' in ('lead', 'quiz_contact')),
        'field_error', (select count(distinct e.install_id) from evp e
                         where e.event = 'field_error' and e.props ->> 'form' in ('lead', 'quiz_contact')),
        'submitted', (select count(distinct e.install_id) from evp e
                       where e.event = 'lead_submit' and e.props ->> 'status' = 'ok'))
    ),
    'returning', jsonb_build_object(
      'active', (select count(*) from active_dev),
      'new', (select count(*) from active_dev a join dev on dev.install_id = a.install_id
               where dev.first_seen_at >= v_t0),
      'returning', (select count(*) from active_dev a join dev on dev.install_id = a.install_id
                     where dev.first_seen_at < v_t0)
    ),
    'spend', coalesce((
      select jsonb_agg(jsonb_build_object('week', s.week_start, 'channel', s.channel, 'amount', s.amount,
                                          'currency', s.currency, 'note', s.note) order by s.week_start, s.channel)
        from public.ad_spend s
       where s.week_start between p_from - 6 and p_to), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

revoke all on function public.analytics_marketing(date, date, boolean, jsonb) from public, anon;
grant execute on function public.analytics_marketing(date, date, boolean, jsonb) to authenticated, service_role;

-- «Qaytish»: devices by the week they were first seen (the last [p_weeks]),
-- how many came back the next day, within 7 days, within 30 days. A cohort
-- too young for a mark has null there.
create or replace function public.analytics_retention(
  p_weeks int default 8, p_include_test boolean default false, p_seg jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_seg   jsonb := public.fn_app_segment(p_seg) - 'age';
  v_out   jsonb;
begin
  if not (public.app_events_staff_can_read() or auth.role() = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with dev as (
    select i.install_id, (i.first_seen_at at time zone 'Asia/Tashkent')::date as day0
      from public.app_installs i
     where (p_include_test or i.test_reason is null)
       and i.first_seen_at >= (date_trunc('week', v_today::timestamp)
                               - make_interval(weeks => greatest(1, least(coalesce(p_weeks, 8), 26)) - 1))
                              at time zone 'Asia/Tashkent'
       and (v_seg = '{}'::jsonb
            or public.fn_app_in_segment(
                 i.install_id, i.user_id, i.platform, public.fn_app_install_channel(i.lead_id, i.user_id),
                 i.first_seen_at,
                 coalesce(i.lead_id, (select l.id from public.leads l
                                       where i.user_id is not null and l.converted_to_student_id = i.user_id
                                       order by l.created_at limit 1)),
                 v_seg, null, now()))
  ),
  back as (
    select dev.install_id, dev.day0,
           bool_or(d.day = dev.day0 + 1) as d1,
           bool_or(d.day between dev.day0 + 1 and dev.day0 + 7) as d7,
           bool_or(d.day between dev.day0 + 1 and dev.day0 + 30) as d30
      from dev
      left join public.app_device_days d on d.install_id = dev.install_id and d.day > dev.day0
     group by dev.install_id, dev.day0
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'week', w.week, 'devices', w.n,
           'd1', case when w.week + 1 + 6 < v_today then w.d1 end,
           'd7', case when w.week + 7 + 6 < v_today then w.d7 end,
           'd30', case when w.week + 30 + 6 < v_today then w.d30 end) order by w.week), '[]'::jsonb)
    into v_out
    from (select date_trunc('week', b.day0::timestamp)::date as week, count(*) as n,
                 count(*) filter (where b.d1) as d1, count(*) filter (where b.d7) as d7,
                 count(*) filter (where b.d30) as d30
            from back b group by 1) w;
  return v_out;
end;
$$;

revoke all on function public.analytics_retention(int, boolean, jsonb) from public, anon;
grant execute on function public.analytics_retention(int, boolean, jsonb) to authenticated, service_role;

-- «Jonli»: devices in the app in the last [p_minutes], how many are known
-- people, and the latest steps with who did them. Test devices aside.
create or replace function public.analytics_live(p_minutes int default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_from timestamptz := now() - make_interval(mins => greatest(1, least(coalesce(p_minutes, 5), 60)));
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- «N qurilma hozir ilovada · K tasi tanilgan lid»: devices with a step in
  -- the last p_minutes (test devices aside); K — those tied to a lead card
  -- and not signed in as a student.
  return (
  with now_in as (
    select e.install_id,
           bool_or(coalesce(e.user_id, i.user_id) is not null) as student,
           bool_or(i.lead_id is not null) as lead
      from public.app_events e
      join public.app_installs i on i.install_id = e.install_id
     where e.received_at >= v_from and i.test_reason is null
     group by e.install_id)
  select jsonb_build_object(
    'now', now(),
    'devices', (select count(*) from now_in),
    'leads', (select count(*) from now_in where lead and not student),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at', x.occurred_at, 'event', x.event, 'screen', x.screen, 'element', x.element,
               'duration_ms', x.duration_ms, 'props', x.props - 'x' - 'y', 'platform', x.platform,
               'kind', case when x.user_id is not null then 'student' when x.lead_id is not null then 'lead' else 'guest' end,
               'name', coalesce(pr.full_name, l.full_name), 'lead_id', x.lead_id,
               'source', l.source, 'contact_channel', l.contact_channel)
             order by x.occurred_at desc)
        from (select e.occurred_at, e.event, e.screen, e.element, e.duration_ms, e.props, i.platform,
                     coalesce(e.user_id, i.user_id) as user_id, i.lead_id
                from public.app_events e
                join public.app_installs i on i.install_id = e.install_id
               where e.received_at >= now() - interval '60 minutes' and i.test_reason is null
                 and e.event not in ('session_start', 'app_ready', 'rpc_slow', 'card_view', 'sheet_close', 'screen_view')
                 and not (e.event = 'tap' and e.element is null)
               order by e.occurred_at desc
               limit 60) x
        left join public.leads l on l.id = x.lead_id
        left join public.profiles pr on pr.user_id = x.user_id
    ), '[]'::jsonb)));
end;
$$;

revoke all on function public.analytics_live(int) from public, anon;
grant execute on function public.analytics_live(int) to authenticated;
