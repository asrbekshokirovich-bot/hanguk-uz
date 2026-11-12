-- The app-signals job (pg_cron «app-signals», every minute) has failed on every
-- run since 2026-11-07 12:10 UTC:
--
--   insert or update on table "student_stage_notifications" violates foreign
--   key constraint "student_stage_notifications_student_id_fkey"
--   Key (student_id)=(…) is not present in table "users".
--
-- A student profile without a sign-in account (there are 20 of them; the CRM
-- makes them for people who never got an app login) had two university offers
-- go 48 hours unanswered. Rule 4 of app_signals_tick() opened the
-- «offer_unanswered» task for the documents team, the task's trigger tried to
-- queue the student's push, the push table points at auth.users, and the
-- foreign key rolled the whole tick back — rules 1–3 with it. So for four days
-- no «new request», «came back» or «report seen» signal reached an operator
-- either, and nothing said so.
--
-- Three changes:
--   1. The offer-reminder trigger queues a push only for a student who can
--      receive one, as enqueue_stage_notification() has done since the start.
--      The task for the documents team is still opened.
--   2. student_deadline_reminders() had the same gap and would have lost a
--      whole day's reminders the first time such a student's deadline came up.
--   3. app_signals_tick() runs each rule on its own: a rule that fails is
--      reported in the result and as a WARNING, the others still run. The
--      «new request» watermark does not move past a failed run, so nothing
--      that was asked in that minute is lost.
-- And one addition, so that the next silent failure is not silent:
--   4. fn_cron_failing_jobs() — the pg_cron jobs whose latest runs all failed —
--      for the hourly infra-health-check, which already tells Telegram about
--      things that broke.

-- 1. ---------------------------------------------------------------------------
create or replace function public.trg_app_signal_offer_reminder()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  -- Only a student with a sign-in account has a phone to push to; the others
  -- must not break the signal that fired this trigger.
  insert into public.student_stage_notifications (student_id, kind, institution_id)
  select c.student_id, 'offer_reminder', c.institution_id
    from public.student_university_choices c
   where c.student_id = new.user_id
     and c.status = 'offered' and c.responded_at is null
     and c.created_at <= now() - interval '48 hours'
     and exists (select 1 from auth.users u where u.id = c.student_id)
  on conflict do nothing;
  return null;
end;
$$;

revoke all on function public.trg_app_signal_offer_reminder() from public, anon, authenticated;

-- 2. ---------------------------------------------------------------------------
create or replace function public.student_deadline_reminders()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_n int;
begin
  with students as (
    select distinct si.student_id
      from student_intakes si
     where si.intake_id = ai_default_intake() and si.contract_cancelled_at is null
  ),
  picks as (
    select st.student_id, u.institution_id,
           case
             when u.program ilike 'bachelor%' then 'bakalavr'
             when u.program ilike 'master%' then 'magistratura'
             when u.program ilike 'vocational%' then 'kasbiy'
             else null
           end as daraja
      from students st
      cross join lateral student_universities_of(st.student_id) u
     where u.institution_id is not null
       and not exists (select 1 from student_university_submissions s
                        where s.student_id = st.student_id and s.institution_id = u.institution_id
                          and s.online_submitted_at is not null)
  ),
  due as (
    select distinct p.student_id, p.institution_id, r.tugash_sana, r.tugash_sana - v_today as days_left
      from picks p
      join university_guidelines g on g.institution_id = p.institution_id
      join university_guideline_rounds r on r.guideline_uuid = g.id
      cross join ai_uni_season() s
     where g.qabul_yili = s.qabul_yili and g.semestr = s.semestr
       and (p.daraja is null or g.daraja = p.daraja)
       and r.etap_nomi = 'Online hujjat topshirish'
       and coalesce(r.holat, '') <> 'etap_yoq'
       and r.tugash_sana - v_today in (7, 3, 1)
  )
  insert into student_stage_notifications (student_id, kind, institution_id, ref_date)
  select d.student_id, 'deadline_' || d.days_left, d.institution_id, d.tugash_sana
    from due d
   -- a student without a sign-in account cannot get the push (and the table
   -- points at auth.users): skip them instead of losing everyone's reminder
   where exists (select 1 from auth.users u where u.id = d.student_id)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.student_deadline_reminders() from public, anon, authenticated;
grant execute on function public.student_deadline_reminders() to service_role;

-- 3. ---------------------------------------------------------------------------
-- The rules are word for word what production ran on 2026-11-11; only the
-- begin … exception … end around each of them, v_errors and the watermark
-- condition are new.
create or replace function public.app_signals_tick()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
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
  v_errors  jsonb := '[]'::jsonb;
  v_request_ok boolean := true;
  v_n       int;
begin
  select s.at into v_since from public.app_analytics_state s where s.key = 'signals';
  v_since := coalesce(v_since, v_now - interval '1 hour') - interval '1 minute';
  select coalesce(array_agg(r.key), '{}') into v_rules from public.app_signal_rules r where r.enabled;

  -- 1. A new request: the lead form, or the app's code in a Telegram chat.
  if 'new_app_request' = any (v_rules) then
    begin
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
    exception when others then
      v_request_ok := false;
      v_errors := v_errors || jsonb_build_object('rule', 'new_app_request', 'error', sqlerrm);
      raise warning 'app_signals_tick: new_app_request failed: %', sqlerrm;
    end;
  end if;

  -- 2. Back in the app after two days and more.
  if 'came_back' = any (v_rules) then
    begin
      insert into public.app_signals (rule_key, lead_id, day, asked_at, target, assigned_to, detail)
      select 'came_back', c.lead_id, v_today, c.first_at,
             case when l.assigned_to is not null then 'owner' else 'operators' end, l.assigned_to,
             jsonb_build_object('days', c.days_away)
        from public.fn_app_came_back(v_today) c
        join public.leads l on l.id = c.lead_id
       where l.converted_to_student_id is null and l.status not in ('converted', 'lost')
      on conflict (lead_id, day) where lead_id is not null do nothing;
      get diagnostics v_n2 = row_count;
    exception when others then
      v_errors := v_errors || jsonb_build_object('rule', 'came_back', 'error', sqlerrm);
      raise warning 'app_signals_tick: came_back failed: %', sqlerrm;
    end;
  end if;

  -- 3. The report seen, or the third ♥, today — once per lead.
  if 'report_or_picks' = any (v_rules) then
    begin
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
    exception when others then
      v_errors := v_errors || jsonb_build_object('rule', 'report_or_picks', 'error', sqlerrm);
      raise warning 'app_signals_tick: report_or_picks failed: %', sqlerrm;
    end;
  end if;

  -- 4. A university offer the student has not answered for 48 hours.
  if 'offer_unanswered' = any (v_rules) then
    begin
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
    exception when others then
      v_errors := v_errors || jsonb_build_object('rule', 'offer_unanswered', 'error', sqlerrm);
      raise warning 'app_signals_tick: offer_unanswered failed: %', sqlerrm;
    end;
  end if;

  -- The tasks that closed themselves.
  begin
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
    select count(*) into v_n from done;
    v_closed := v_closed + v_n;

    -- A lead's BUGUN task is for its day.
    update public.app_signals s
       set status = 'expired', done_at = v_now
     where s.status = 'open' and s.lead_id is not null and s.rule_key <> 'new_app_request' and s.day < v_today;
    get diagnostics v_expired = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_object('rule', 'close', 'error', sqlerrm);
    raise warning 'app_signals_tick: closing failed: %', sqlerrm;
  end;

  -- The watermark is what rule 1 reads from: it only moves when rule 1 ran, so
  -- a request made during a failed minute is picked up by the next good one.
  if v_request_ok then
    insert into public.app_analytics_state (key, at) values ('signals', v_now)
    on conflict (key) do update set at = excluded.at;
  end if;

  return jsonb_build_object('request', v_n1, 'came_back', v_n2, 'report_or_picks', v_n3, 'offers', v_n4,
                            'closed', v_closed, 'expired', v_expired)
         || case when jsonb_array_length(v_errors) > 0 then jsonb_build_object('errors', v_errors) else '{}'::jsonb end;
end;
$function$;

revoke all on function public.app_signals_tick() from public, anon, authenticated;
grant execute on function public.app_signals_tick() to service_role;

-- 4. ---------------------------------------------------------------------------
-- pg_cron jobs whose latest runs all failed. «Latest» is the last three runs
-- inside two days: a job that runs every minute is reported after three bad
-- minutes (one slow start is not an outage), a daily job after its bad run.
-- A job that is switched off is not reported.
create or replace function public.fn_cron_failing_jobs()
returns table (jobname text, failed_runs int, last_error text, failing_since timestamptz)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with recent as (
    select j.jobid, coalesce(j.jobname, 'job ' || j.jobid) as jobname,
           d.status, d.return_message, d.start_time,
           row_number() over (partition by j.jobid order by d.start_time desc) as rn
      from cron.job j
      join cron.job_run_details d on d.jobid = j.jobid
     where j.active
       and d.status in ('succeeded', 'failed')
       and d.start_time > now() - interval '2 days'
  ),
  last3 as (
    select r.jobid, r.jobname,
           count(*) as runs,
           count(*) filter (where r.status = 'failed') as failed,
           (array_agg(r.return_message order by r.start_time desc))[1] as last_error
      from recent r
     where r.rn <= 3
     group by r.jobid, r.jobname
  )
  select l.jobname, l.failed::int,
         left(regexp_replace(coalesce(l.last_error, ''), '\s+', ' ', 'g'), 300),
         (select min(d.start_time)
            from cron.job_run_details d
           where d.jobid = l.jobid and d.status = 'failed'
             and d.start_time > coalesce(
                   (select max(s.start_time) from cron.job_run_details s
                     where s.jobid = l.jobid and s.status = 'succeeded'),
                   '-infinity'::timestamptz))
    from last3 l
   where l.failed = l.runs
   order by l.jobname;
$$;

revoke all on function public.fn_cron_failing_jobs() from public, anon, authenticated;
grant execute on function public.fn_cron_failing_jobs() to service_role;

comment on function public.fn_cron_failing_jobs() is
  'pg_cron jobs whose last runs (up to three, within two days) all failed — read hourly by infra-health-check.';
