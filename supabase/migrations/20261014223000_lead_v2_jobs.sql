-- Lead module v2 (spec "HANGUK Lid bo'limi TT", 2026-10-05) — part 4 of 5: jobs.
--
-- Background work (spec §15). Everything that can be SQL is SQL, scheduled
-- with pg_cron and no HTTP in the middle:
--
--   lead-timer-scan          every 30 s   escalation -> lead_alert_outbox
--   lead-waiting             09:00        Kutish dates arrive; reminder drafts 7 days before
--   lead-followup-drafts     hourly       1/3/7-day drafts for silent leads
--   lead-reactivation        09:05        queue items go to BUGUN, N a day
--   lead-priority            03:30        recency decays: recompute the score
--
-- and the ones that need a network call are edge functions, called the same
-- way as lead-sla-check-1min (vault secret `uni_db_service_role_jwt`):
--
--   lead-alert-dispatch      every 30 s   outbox -> Telegram (everyone / boss)
--   lead-brief               every 2 min  AI brief for leads with a new message
--   lead-reports             09:30 daily, Monday weekly -> Telegram
--
-- pg_cron runs in UTC; Tashkent is UTC+5 all year.

----------------------------------------------------------------------
-- 1. SQL jobs
----------------------------------------------------------------------

-- Kutish: the date arrives -> back to Aloqada and onto BUGUN; a reminder draft
-- is prepared 7 days before.
create or replace function public.fn_lead_waiting_run()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  n integer := 0;
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_tpl jsonb;
  l public.leads;
begin
  for r in
    select id, wait_reason from public.leads
     where stage = 'waiting' and merged_into_id is null and wait_until is not null and wait_until <= v_today
       for update skip locked
  loop
    update public.leads
       set stage = 'contacted',
           next_action_at = now(), next_action_kind = 'wait_end', next_action_note = r.wait_reason,
           wait_until = null, wait_reason = null
     where id = r.id;
    n := n + 1;
  end loop;

  select t into v_tpl from jsonb_array_elements(public.fn_lead_setting('templates')) t where t->>'key' = 'wait_reminder';
  for l in
    select * from public.leads
     where stage = 'waiting' and merged_into_id is null
       and wait_until > v_today and wait_until <= v_today + 7
       and (source in ('instagram', 'telegram')
            or exists (select 1 from public.communication_identities ci
                        where ci.lead_id = leads.id and ci.channel in ('instagram', 'telegram')))
  loop
    insert into public.lead_drafts (lead_id, kind, channel, text, due_at, dedupe_key)
    values (l.id, 'wait_reminder',
            case when l.source in ('instagram', 'telegram') then l.source else coalesce(l.preferred_channel, null) end,
            public.fn_lead_fill_template(coalesce(v_tpl->>coalesce(l.language, 'uz'), v_tpl->>'uz', ''), l, to_char(l.wait_until, 'DD.MM.YYYY')),
            now(), 'wr:' || l.id || ':' || l.wait_until)
    on conflict do nothing;
  end loop;
  return n;
end;
$$;

-- Silent leads (spec §10): 1 / 3 / 7 days after OUR last message with no
-- answer, a draft lands in BUGUN. Nothing is ever sent without a person.
create or replace function public.fn_lead_followup_drafts_run()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r public.leads;
  n integer := 0;
  v_days numeric;
  v_kind text;
  v_tpl jsonb;
  v_key text;
  v_rows integer;
begin
  for r in
    select * from public.leads l
     where l.merged_into_id is null
       and l.stage in ('contacted', 'interested', 'offer')
       and l.answered_at is not null
       and l.last_operator_msg_at is not null
       and (l.last_client_msg_at is null or l.last_client_msg_at < l.last_operator_msg_at)
       and l.last_operator_msg_at <= now() - interval '24 hours'
       and l.due_at is null
       and (l.source in ('instagram', 'telegram')
            or exists (select 1 from public.communication_identities ci
                        where ci.lead_id = l.id and ci.channel in ('instagram', 'telegram')))
  loop
    v_days := extract(epoch from (now() - r.last_operator_msg_at)) / 86400;
    v_kind := case when v_days >= 7 then 'followup_d7' when v_days >= 3 then 'followup_d3' else 'followup_d1' end;
    v_key := 'fu:' || r.id || ':' || to_char(r.last_operator_msg_at at time zone 'Asia/Tashkent', 'YYYYMMDD') || ':' || v_kind;
    select t into v_tpl from jsonb_array_elements(public.fn_lead_setting('templates')) t where t->>'key' = v_kind;

    insert into public.lead_drafts (lead_id, kind, channel, text, due_at, dedupe_key)
    values (r.id, v_kind,
            case when r.source in ('instagram', 'telegram') then r.source else null end,
            public.fn_lead_fill_template(coalesce(v_tpl->>coalesce(r.language, 'uz'), v_tpl->>'uz', ''), r,
                                         to_char((now() + interval '7 days') at time zone 'Asia/Tashkent', 'DD.MM.YYYY')),
            now(), v_key)
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    n := n + v_rows;
  end loop;
  return n;
end;
$$;

-- Reactivation queues (spec §8): up to `queue_daily_limit` lost leads a day go
-- back to BUGUN, each marked with its queue (and, for the DM queue, a draft).
create or replace function public.fn_lead_reactivation_run()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  l public.leads;
  n integer := 0;
  v_limit integer := coalesce((public.fn_lead_setting('queue_daily_limit') #>> '{}')::integer, 15);
  v_done integer;
  v_tpl jsonb;
begin
  select count(*) into v_done
    from public.reactivation_queues
   where status = 'moved'
     and moved_at >= ((now() at time zone 'Asia/Tashkent')::date + time '00:00') at time zone 'Asia/Tashkent';

  select t into v_tpl from jsonb_array_elements(public.fn_lead_setting('templates')) t where t->>'key' = 'reactivation_check';

  for r in
    select q.id, q.lead_id, q.queue_key, q.channel
      from public.reactivation_queues q
      join public.leads x on x.id = q.lead_id
     where q.status in ('waiting', 'ready')
       and q.due_at is not null and q.due_at <= now()
       and x.stage = 'lost' and x.merged_into_id is null
     order by q.due_at, q.created_at
       for update of q skip locked
  loop
    exit when v_done + n >= v_limit;
    select * into l from public.leads where id = r.lead_id;

    update public.leads
       set stage = 'contacted', owner_id = null, reactivation_queue = r.queue_key,
           next_action_at = now(), next_action_kind = 'reactivation', next_action_note = r.queue_key
     where id = r.lead_id;
    update public.reactivation_queues set status = 'moved', moved_at = now() where id = r.id;
    perform public.fn_lead_log(r.lead_id, 'reactivation', null,
      jsonb_build_object('queue', r.queue_key, 'channel', r.channel));

    if r.channel = 'dm' then
      insert into public.lead_drafts (lead_id, kind, channel, text, due_at, dedupe_key)
      values (r.lead_id, 'reactivation',
              case when l.source in ('instagram', 'telegram') then l.source else null end,
              public.fn_lead_fill_template(coalesce(v_tpl->>coalesce(l.language, 'uz'), v_tpl->>'uz', ''), l),
              now(), 'react:' || r.id)
      on conflict do nothing;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.fn_lead_priority_refresh()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  update public.leads l
     set priority_score = public.fn_lead_priority(l)
   where l.crm_generation = 'new'
     and l.merged_into_id is null
     and l.stage not in ('student', 'lost')
     and l.priority_score is distinct from public.fn_lead_priority(l);
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'fn_lead_waiting_run()', 'fn_lead_followup_drafts_run()', 'fn_lead_reactivation_run()', 'fn_lead_priority_refresh()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

----------------------------------------------------------------------
-- 2. Escalation outbox helpers for the dispatcher (edge function)
----------------------------------------------------------------------

-- Hand out unsent alerts once: the claim is taken here, before sending, so two
-- overlapping runs never send the same one twice. A claim that was never
-- completed (the function died) is handed out again after 2 minutes.
create or replace function public.fn_lead_alert_claim(p_limit integer default 50)
returns setof public.lead_alert_outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
  update public.lead_alert_outbox o
     set claimed_at = now(), attempts = o.attempts + 1
   where o.id in (
     select x.id from public.lead_alert_outbox x
      where x.sent_at is null
        and x.attempts < 5
        and (x.claimed_at is null or x.claimed_at < now() - interval '2 minutes')
        -- an escalation for a lead that has been answered meanwhile is stale
        and not (x.kind = 'escalation' and exists (
              select 1 from public.leads l
               where l.id = x.lead_id and (l.due_at is null or l.merged_into_id is not null)))
      order by x.created_at
      limit p_limit
        for update skip locked)
  returning o.*;
end;
$$;

create or replace function public.fn_lead_alert_done(p_id bigint, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.lead_alert_outbox
     set sent_at = case when p_ok then now() else null end,
         last_error = case when p_ok then null else left(p_error, 500) end,
         claimed_at = case when p_ok then claimed_at else null end
   where id = p_id
$$;

-- Stale escalations (answered while queued) are closed instead of sent.
create or replace function public.fn_lead_alert_expire()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  update public.lead_alert_outbox o
     set sent_at = now(), last_error = 'expired'
   where o.sent_at is null
     and (o.attempts >= 5 or o.created_at < now() - interval '1 day'
          or (o.kind = 'escalation' and exists (
               select 1 from public.leads l where l.id = o.lead_id and (l.due_at is null or l.merged_into_id is not null))));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- What the office TV shows (spec §14): new leads nobody answered for 10 minutes.
create or replace function public.fn_lead_tv_warnings()
returns table (lead_id uuid, label text, source text, minutes_late integer, timer_kind text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select l.id,
         coalesce(nullif(l.instagram_handle, ''), nullif(l.telegram_handle, ''),
                  (select ci.identifier_label from public.communication_identities ci
                    where ci.lead_id = l.id and ci.identifier_label is not null limit 1),
                  l.full_name),
         l.source,
         greatest(0, floor(extract(epoch from (now() - l.due_at)) / 60))::integer,
         l.timer_kind
    from public.leads l
   where l.due_at is not null and l.due_at <= now() and l.timer_start_at <= now()
     and l.merged_into_id is null and l.matched_student_id is null and l.stage <> 'student'
     and coalesce((public.fn_lead_setting('tv_warning') #>> '{}')::boolean, true)
   order by l.due_at
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'fn_lead_alert_claim(integer)', 'fn_lead_alert_done(bigint,boolean,text)',
    'fn_lead_alert_expire()', 'fn_lead_tv_warnings()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

----------------------------------------------------------------------
-- 3. Schedules
----------------------------------------------------------------------

-- SQL-only jobs (no secrets needed). Skipped quietly where pg_cron is absent.
do $$
declare
  v_every_30s text := '30 seconds';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'lead v2: pg_cron is not installed, jobs not scheduled';
    return;
  end if;

  perform cron.unschedule(jobname) from cron.job
   where jobname in ('lead-timer-scan', 'lead-waiting', 'lead-followup-drafts', 'lead-reactivation',
                     'lead-priority', 'lead-alert-expire');

  -- seconds-granularity needs pg_cron 1.5+; fall back to every minute.
  begin
    perform cron.schedule('lead-timer-scan', v_every_30s, $job$select public.fn_lead_timer_scan()$job$);
  exception when others then
    raise warning 'lead v2: 30-second schedule not supported (%), using every minute', sqlerrm;
    perform cron.schedule('lead-timer-scan', '* * * * *', $job$select public.fn_lead_timer_scan()$job$);
  end;

  perform cron.schedule('lead-waiting', '0 4 * * *', $job$select public.fn_lead_waiting_run()$job$);
  perform cron.schedule('lead-followup-drafts', '5 * * * *', $job$select public.fn_lead_followup_drafts_run()$job$);
  perform cron.schedule('lead-reactivation', '5 4 * * *', $job$select public.fn_lead_reactivation_run()$job$);
  perform cron.schedule('lead-priority', '30 22 * * *', $job$select public.fn_lead_priority_refresh()$job$);
  perform cron.schedule('lead-alert-expire', '*/10 * * * *', $job$select public.fn_lead_alert_expire()$job$);
end $$;

-- Edge-function jobs, called like lead-sla-check-1min.
do $$
declare
  v_jwt text;
  v_job record;
  v_has_cron boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
begin
  if not v_has_cron then
    return;
  end if;
  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise warning 'lead v2: vault is not available, edge-function jobs not scheduled';
    return;
  end if;
  select decrypted_secret into v_jwt from vault.decrypted_secrets where name = 'uni_db_service_role_jwt';
  if v_jwt is null then
    raise warning 'lead v2: vault secret uni_db_service_role_jwt is missing, edge-function jobs not scheduled';
    return;
  end if;

  for v_job in
    select * from (values
      ('lead-alert-dispatch', '30 seconds', 'lead-alert-dispatch', '{}'),
      ('lead-brief',          '*/2 * * * *', 'lead-brief',          '{}'),
      ('lead-reports-daily',  '30 4 * * *',  'lead-reports',        '{"kind":"daily"}'),
      ('lead-reports-weekly', '30 4 * * 1',  'lead-reports',        '{"kind":"weekly"}')
    ) as t (jobname, schedule, fn, body)
  loop
    perform cron.unschedule(v_job.jobname) where exists (select 1 from cron.job where jobname = v_job.jobname);
    begin
      perform cron.schedule(v_job.jobname, v_job.schedule, format($j$
        select net.http_post(
          url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/%s',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %s'),
          body := '%s'::jsonb,
          timeout_milliseconds := 30000)
      $j$, v_job.fn, v_jwt, v_job.body));
    exception when others then
      if v_job.schedule = '30 seconds' then
        perform cron.schedule(v_job.jobname, '* * * * *', format($j$
          select net.http_post(
            url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/%s',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %s'),
            body := '%s'::jsonb,
            timeout_milliseconds := 30000)
        $j$, v_job.fn, v_jwt, v_job.body));
      else
        raise;
      end if;
    end;
  end loop;
end $$;
