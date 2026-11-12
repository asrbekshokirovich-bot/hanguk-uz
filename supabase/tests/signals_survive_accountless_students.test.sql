-- Local test for 20261111200000_signals_survive_accountless_students.sql.
--
--   createdb sig_test && psql -v ON_ERROR_STOP=1 -d sig_test \
--     -f supabase/tests/signals_survive_accountless_students.test.sql
--
-- A stub of the production objects the migration touches (columns, indexes
-- and constraints copied from production on 2026-11-11), the failure of
-- 2026-11-07 reproduced with the old functions, then the migration and the
-- same data again.
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);

create schema cron;
create table cron.job (jobid bigint primary key, jobname text, schedule text, command text, active boolean not null default true);
create table cron.job_run_details (
  jobid bigint, runid bigserial primary key, status text, return_message text,
  start_time timestamptz, end_time timestamptz);

create table public.institutions (id uuid primary key);
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique not null, full_name text);
create table public.leads (
  id uuid primary key default gen_random_uuid(), status text not null default 'new',
  converted_to_student_id uuid, assigned_to uuid, quiz_submitted_at timestamptz,
  last_contacted_at timestamptz, call_result text);
create table public.app_identity (install_id uuid, lead_id uuid, via text, created_at timestamptz default now());
create table public.app_installs (install_id uuid primary key, lead_id uuid, test_reason text);
create table public.app_events (install_id uuid, event text, occurred_at timestamptz);
create table public.app_person_profile (lead_id uuid, report_views int, picks uuid[], last_seen_at timestamptz);
create table public.student_university_choices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (user_id) on update cascade on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  status text not null default 'offered', responded_at timestamptz, created_at timestamptz not null default now());
create table public.student_stage_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  kind text not null, institution_id uuid references public.institutions (id) on delete cascade,
  created_at timestamptz not null default now(), sent_at timestamptz, attempts smallint not null default 0,
  last_error text, ref_date date);
create unique index student_stage_notifications_once on public.student_stage_notifications
  (student_id, kind, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(ref_date, '1900-01-01'::date));
create table public.app_analytics_state (key text primary key, at timestamptz not null);
create table public.app_signal_rules (
  key text primary key, name_uz text not null, queue text not null, target text not null,
  minutes integer, enabled boolean not null default true);
create table public.app_signals (
  id bigserial primary key, rule_key text not null references public.app_signal_rules (key),
  lead_id uuid references public.leads (id) on delete cascade, user_id uuid, day date not null,
  created_at timestamptz not null default now(), asked_at timestamptz not null default now(), due_at timestamptz,
  target text not null, assigned_to uuid, detail jsonb not null default '{}'::jsonb,
  status text not null default 'open', done_at timestamptz, alerted_at timestamptz,
  check (lead_id is not null or user_id is not null));
create unique index app_signals_lead_day_key on public.app_signals (lead_id, day) where lead_id is not null;
create unique index app_signals_user_day_key on public.app_signals (user_id, rule_key, day) where lead_id is null;

create function public.fn_app_request_due(p_at timestamptz)
returns table (day date, due_at timestamptz, target text) language sql stable as $$
  select (p_at at time zone 'Asia/Tashkent')::date, p_at + interval '15 minutes', 'operators'::text $$;
create function public.fn_app_came_back(p_day date)
returns table (lead_id uuid, first_at timestamptz, days_away integer) language sql stable as $$
  select null::uuid, null::timestamptz, null::int where false $$;
create function public.fn_lead_touched_since(p_lead uuid, p_since timestamptz) returns boolean language sql stable as $$ select false $$;

-- The three functions exactly as production had them before the migration.
create function public.trg_app_signal_offer_reminder() returns trigger
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
begin
  insert into public.student_stage_notifications (student_id, kind, institution_id)
  select c.student_id, 'offer_reminder', c.institution_id
    from public.student_university_choices c
   where c.student_id = new.user_id
     and c.status = 'offered' and c.responded_at is null
     and c.created_at <= now() - interval '48 hours'
  on conflict do nothing;
  return null;
end; $$;
create trigger app_signal_offer_reminder after insert on public.app_signals
  for each row when (new.rule_key = 'offer_unanswered' and new.user_id is not null)
  execute function public.trg_app_signal_offer_reminder();

create function public.app_signals_tick() returns jsonb
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_since timestamptz; v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'Asia/Tashkent')::date; v_n1 int := 0; v_n4 int := 0; v_rules text[];
begin
  select s.at into v_since from public.app_analytics_state s where s.key = 'signals';
  v_since := coalesce(v_since, v_now - interval '1 hour') - interval '1 minute';
  select coalesce(array_agg(r.key), '{}') into v_rules from public.app_signal_rules r where r.enabled;
  if 'new_app_request' = any (v_rules) then
    insert into public.app_signals (rule_key, lead_id, day, asked_at, due_at, target, assigned_to, detail)
    select 'new_app_request', l.id, d.day, l.quiz_submitted_at, d.due_at, d.target, l.assigned_to, '{}'::jsonb
      from public.leads l cross join lateral public.fn_app_request_due(l.quiz_submitted_at) d
     where l.quiz_submitted_at > v_since and l.quiz_submitted_at <= v_now
    on conflict (lead_id, day) where lead_id is not null do nothing;
    get diagnostics v_n1 = row_count;
  end if;
  if 'offer_unanswered' = any (v_rules) then
    insert into public.app_signals (rule_key, user_id, day, asked_at, target, detail)
    select 'offer_unanswered', c.student_id, v_today, min(c.created_at), 'documents', jsonb_build_object('offers', count(*))
      from public.student_university_choices c
     where c.status = 'offered' and c.responded_at is null and c.created_at <= v_now - interval '48 hours'
     group by c.student_id
    on conflict (user_id, rule_key, day) where lead_id is null do nothing;
    get diagnostics v_n4 = row_count;
  end if;
  insert into public.app_analytics_state (key, at) values ('signals', v_now)
  on conflict (key) do update set at = excluded.at;
  return jsonb_build_object('request', v_n1, 'offers', v_n4);
end; $$;

-- student_deadline_reminders() needs these to exist to be created.
create table public.student_intakes (student_id uuid, intake_id uuid, contract_cancelled_at timestamptz);
create table public.student_university_submissions (student_id uuid, institution_id uuid, online_submitted_at timestamptz);
create table public.university_guidelines (id uuid primary key, institution_id uuid, qabul_yili int, semestr text, daraja text);
create table public.university_guideline_rounds (guideline_uuid uuid, etap_nomi text, holat text, tugash_sana date);
create function public.ai_default_intake() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-0000000000aa'::uuid $$;
create function public.ai_uni_season() returns table (qabul_yili integer, semestr text) language sql stable as $$ select 2027, 'bahor'::text $$;
create function public.student_universities_of(p_student uuid)
returns table (id uuid, institution_id uuid, status text, program text, created_at timestamptz) language sql stable as $$
  select c.id, c.institution_id, c.status, 'bachelor'::text, c.created_at
    from public.student_university_choices c where c.student_id = p_student $$;

-- Data: one student with an account, one without; both left an offer unanswered.
insert into public.app_signal_rules (key, name_uz, queue, target) values
  ('new_app_request', 'Yangi murojaat', 'now', 'operators'),
  ('came_back', 'Qaytdi', 'today', 'operators'),
  ('report_or_picks', 'Hisobot', 'today', 'operators'),
  ('offer_unanswered', 'Javobsiz taklif', 'today', 'documents');
insert into public.institutions values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
insert into public.profiles (user_id, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'Akkauntli talaba'),
  ('22222222-2222-2222-2222-222222222222', 'Akkauntsiz talaba');
insert into public.student_university_choices (student_id, institution_id, created_at) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', now() - interval '3 days'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', now() - interval '3 days');
insert into public.leads (id, quiz_submitted_at) values ('33333333-3333-3333-3333-333333333333', now() - interval '10 seconds');

-- BEFORE: the tick fails whole, exactly as it has in production.
do $$
begin
  begin
    perform public.app_signals_tick();
    raise exception 'TEST FAILED: the old tick was expected to fail on the foreign key';
  exception when foreign_key_violation then
    raise notice 'before: tick fails with % (as in production)', sqlerrm;
  end;
  assert (select count(*) from public.app_signals) = 0, 'old tick must have rolled everything back';
end $$;

\i supabase/migrations/20261111200000_signals_survive_accountless_students.sql

-- AFTER.
do $$
declare r jsonb;
begin
  r := public.app_signals_tick();
  raise notice 'after: %', r;
  assert not (r ? 'errors'), 'no rule may fail: ' || r::text;
  assert (r ->> 'request')::int = 1, 'the new request signal is opened';
  assert (r ->> 'offers')::int = 2, 'both students get the documents-team task';
  assert (select count(*) from public.student_stage_notifications
           where student_id = '11111111-1111-1111-1111-111111111111' and kind = 'offer_reminder') = 1,
         'the student with an account gets the push row';
  assert (select count(*) from public.student_stage_notifications) = 1, 'nobody else gets one';
  assert (select at from public.app_analytics_state where key = 'signals') is not null, 'watermark moved';

  -- a second run changes nothing
  r := public.app_signals_tick();
  assert (r ->> 'request')::int = 0 and (r ->> 'offers')::int = 0, 'second tick is a no-op: ' || r::text;
end $$;

-- One rule failing does not stop the others, and the watermark waits.
do $$
declare r jsonb; v_before timestamptz;
begin
  select at into v_before from public.app_analytics_state where key = 'signals';
  alter table public.app_identity rename to app_identity_gone;      -- rule 1 now errors
  insert into public.profiles (user_id) values ('44444444-4444-4444-4444-444444444444');
  insert into public.student_university_choices (student_id, institution_id, created_at)
    values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', now() - interval '3 days');
  r := public.app_signals_tick();
  raise notice 'with rule 1 broken: %', r;
  assert r -> 'errors' -> 0 ->> 'rule' = 'new_app_request', 'the failed rule is named';
  assert (r ->> 'offers')::int = 1, 'rule 4 still ran';
  assert (select at from public.app_analytics_state where key = 'signals') = v_before, 'watermark did not move';
  alter table public.app_identity_gone rename to app_identity;
  r := public.app_signals_tick();
  assert not (r ? 'errors'), 'recovers: ' || r::text;
  assert (select at from public.app_analytics_state where key = 'signals') > v_before, 'watermark moves again';
end $$;

-- student_deadline_reminders(): the account-less student is skipped, the other is reminded.
do $$
declare n int;
begin
  insert into public.student_intakes (student_id, intake_id) values
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000aa'),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000aa');
  insert into public.university_guidelines values
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 2027, 'bahor', 'bakalavr');
  insert into public.university_guideline_rounds values
    ('00000000-0000-0000-0000-0000000000b1', 'Online hujjat topshirish', 'ochiq', (now() at time zone 'Asia/Tashkent')::date + 3);
  n := public.student_deadline_reminders();
  assert n = 1, 'one reminder, got ' || n;
  assert (select count(*) from public.student_stage_notifications where kind = 'deadline_3'
           and student_id = '11111111-1111-1111-1111-111111111111') = 1, 'for the student with an account';
end $$;

-- fn_cron_failing_jobs()
do $$
declare v_names text;
begin
  insert into cron.job (jobid, jobname, active) values
    (1, 'every-minute-broken', true), (2, 'every-minute-one-blip', true), (3, 'daily-broken', true),
    (4, 'healthy', true), (5, 'broken-but-off', false), (6, 'old-failure', true);
  insert into cron.job_run_details (jobid, status, return_message, start_time)
    select 1, case when g <= 2 then 'succeeded' else 'failed' end, 'ERROR:  boom', now() - make_interval(mins => 10 - g)
      from generate_series(1, 9) g;
  insert into cron.job_run_details (jobid, status, return_message, start_time) values
    (2, 'succeeded', null, now() - interval '3 minutes'), (2, 'failed', 'job startup timeout', now() - interval '2 minutes'),
    (2, 'succeeded', null, now() - interval '1 minute'),
    (3, 'failed', 'ERROR:  daily boom', now() - interval '5 hours'),
    (4, 'succeeded', null, now() - interval '1 minute'),
    (5, 'failed', 'x', now() - interval '1 minute'),
    (6, 'failed', 'x', now() - interval '5 days');
  select string_agg(jobname, ',' order by jobname) into v_names from public.fn_cron_failing_jobs();
  raise notice 'failing jobs: %', v_names;
  assert v_names = 'daily-broken,every-minute-broken', 'got ' || coalesce(v_names, 'none');
  assert (select failing_since from public.fn_cron_failing_jobs() where jobname = 'every-minute-broken')
         between now() - interval '7 minutes 30 seconds' and now() - interval '6 minutes 30 seconds', 'failing since the first bad run';
end $$;

-- Privileges: nothing here is callable through the API.
do $$
begin
  assert not has_function_privilege('anon', 'public.app_signals_tick()', 'execute');
  assert not has_function_privilege('authenticated', 'public.fn_cron_failing_jobs()', 'execute');
  assert not has_function_privilege('authenticated', 'public.student_deadline_reminders()', 'execute');
  assert has_function_privilege('service_role', 'public.fn_cron_failing_jobs()', 'execute');
end $$;

\echo ALL TESTS PASSED
