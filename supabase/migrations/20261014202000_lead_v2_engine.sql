-- Lead module v2 (spec "HANGUK Lid bo'limi TT", 2026-10-05) — part 3 of 5: engine.
--
-- The state machine. Everything that decides what a lead IS, WHEN it is due
-- and WHO may touch it lives here, in SQL, so it is transactional and tested
-- (supabase/tests/lead_v2). The browser and the edge functions only call it.
--
--   §4  the 10-minute rule     fn_lead_set_timer / fn_lead_reengage / fn_lead_timer_scan
--   §5  one person, one card   fn_lead_merge / fn_lead_try_merge / fn_lead_check_student
--   §7  call result popup      lead_record_call
--   §8  stages, Kutish, lost   lead_set_stage / lead_wait / lead_lose / lead_reopen
--   §9  the no-answer ladder   fn_lead_ladder_next (schema) + lead_record_call
--   §11 promises               lead_request_promise / lead_decide_promise
--   §12 priority score         fn_lead_priority
--   §3  desk, timeline         lead_desk / lead_desk_counts / lead_timeline_v2
--   §14 report                 fn_lead_report / lead_report
--
-- This file REPLACES the old alert mechanism instead of running beside it
-- (running both would alert twice): trg_leads_mark_new_lead and
-- trg_mark_lead_contacted_on_reply are dropped and fn_lead_sla_scan is retired
-- to a function that returns no rows (edge functions that still call it keep
-- working). fn_after_hours_reply_texts / fn_after_hours_reply_text /
-- fn_queue_after_hours_reply are redefined for the new 09:00–22:00 hours.
--
-- Before applying: compare those four functions with the live database —
-- supabase/README.md explains why the repo copy can lag behind production.

----------------------------------------------------------------------
-- 0. Retire the old mechanism
----------------------------------------------------------------------

drop trigger if exists trg_leads_mark_new_lead on public.leads;
drop trigger if exists trg_mark_lead_contacted_on_reply on public.messages;

create or replace function public.fn_lead_sla_scan(p_minutes integer default 10, p_dry boolean default false)
returns table(id uuid, full_name text, phone text, how_heard text, source text, arrived_at timestamptz, minutes_waiting integer)
language sql
stable
as $$
  -- Retired 2026-10-05: the 10-minute rule is leads.due_at + fn_lead_timer_scan.
  select null::uuid, null::text, null::text, null::text, null::text, null::timestamptz, null::integer where false
$$;

create index if not exists idx_leads_v2_phone_key on public.leads (public.fn_lead_phone_key(phone))
  where phone is not null;

----------------------------------------------------------------------
-- 1. Small internal helpers
----------------------------------------------------------------------

create or replace function public.fn_lead_log(p_lead uuid, p_kind text, p_actor uuid default null, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  insert into public.lead_events (lead_id, kind, actor_id, payload)
  values (p_lead, p_kind, p_actor, coalesce(p_payload, '{}'::jsonb))
$$;

create or replace function public.fn_lead_enqueue_alert(p_lead uuid, p_kind text, p_audience text, p_payload jsonb)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  insert into public.lead_alert_outbox (lead_id, kind, audience, payload)
  values (p_lead, p_kind, p_audience, coalesce(p_payload, '{}'::jsonb))
$$;

create or replace function public.fn_lead_stage_rank(p_stage text)
returns integer
language sql
immutable
as $$
  select case p_stage
    when 'new' then 0 when 'contacted' then 1 when 'waiting' then 1 when 'interested' then 2
    when 'offer' then 3 when 'contract' then 4 when 'student' then 5 else -1 end
$$;

create or replace function public.fn_lead_guess_language(p_text text)
returns text
language sql
immutable
as $$ select case when coalesce(p_text, '') ~ '[А-Яа-яЁё]' then 'ru' else 'uz' end $$;

-- The 5 mandatory fields of the call popup (spec §5.1). Which are still empty?
create or replace function public.fn_lead_missing_fields(p public.leads)
returns text[]
language sql
immutable
as $$
  select array_remove(array[
    case when coalesce(trim(p.education_level), '') = '' then 'goal' end,
    case when coalesce(trim(p.cert_level), '') = '' then 'certificate' end,
    case when p.age is null and coalesce(trim(p.study_year), '') = '' then 'age_grade' end,
    case when coalesce(trim(p.city), '') = '' then 'region' end,
    case when p.decider is null then 'decider' end
  ], null)
$$;

-- Priority score 0..100 (spec §12). Orders BUGUN and KEYIN only.
create or replace function public.fn_lead_priority(p public.leads)
returns integer
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  s integer := 0;
  v_comp text := lower(trim(coalesce(p.competitor, '')));
begin
  if p.referral_type is not null or p.referred_by_student_id is not null then s := s + 30; end if;

  if coalesce(p.cert_level, '') ~* '^(TOPIK [3-6]|IELTS (5\.5|6\.0|6\.5|7))' then
    s := s + 25;
  elsif p.exam_date is not null and coalesce(nullif(trim(p.cert_level), ''), 'Yo''q') = 'Yo''q' then
    s := s + 10;
  end if;

  if p.asked_price then s := s + 20; end if;

  if p.decider = 'parent'
     or exists (select 1 from public.lead_contacts c where c.lead_id = p.id and c.role = 'parent') then
    s := s + 15;
  end if;

  s := s + case p.stage when 'offer' then 15 when 'contract' then 25 else 0 end;

  if p.last_client_msg_at is not null then
    if p.last_client_msg_at >= now() - interval '3 days' then s := s + 10;
    elsif p.last_client_msg_at >= now() - interval '7 days' then s := s + 5; end if;
  end if;

  if lower(coalesce(p.source, '')) in ('telegram', 'app') then s := s + 5; end if;
  if v_comp not in ('', 'yo''q', 'yoq', 'no') then s := s + 10; end if;
  if cardinality(public.fn_lead_missing_fields(p)) > 0 then s := s - 5; end if;

  return greatest(0, least(100, s));
end;
$$;

-- The lead behind a chat (source + sender id), following merges.
create or replace function public.fn_lead_find_by_chat(p_source text, p_sender text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v uuid;
  m uuid;
  i integer := 0;
begin
  select ci.lead_id into v
    from public.communication_identities ci
   where ci.channel = p_source and ci.identifier = p_sender and ci.lead_id is not null
   limit 1;
  if v is null then
    select l.id into v
      from public.leads l
     where l.source = p_source and l.source_id = p_sender
     order by l.created_at
     limit 1;
  end if;
  while v is not null and i < 5 loop
    select l.merged_into_id into m from public.leads l where l.id = v;
    exit when m is null;
    v := m;
    i := i + 1;
  end loop;
  return v;
end;
$$;

-- May the signed-in user work on this lead? (RPCs bypass RLS, so they ask.)
create or replace function public.fn_lead_can_touch(l public.leads)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.fn_lead_is_senior()
      or (
        public.fn_lead_has_any_role(array['call_operator'])
        and (l.owner_id is null or l.owner_id = auth.uid() or l.crm_generation = 'old'
             or (l.due_at is not null and l.due_at <= now()))
      )
$$;

create or replace function public.fn_lead_guard(p_id uuid)
returns public.leads
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  if auth.uid() is null or not public.fn_lead_is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into l from public.leads where id = p_id for update;
  if l.id is null then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if not public.fn_lead_can_touch(l) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return l;
end;
$$;

-- "{ism}" "{tarif}" "{narx}" "{sana}" "{operator}" in a template.
create or replace function public.fn_lead_fill_template(p_text text, p public.leads, p_date text default null)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_first text := case
    when coalesce(p.full_name, '') ~* '^(instagram|telegram|ilova|facebook)\M' then ''
    else split_part(coalesce(p.full_name, ''), ' ', 1) end;
  v_offer jsonb := public.fn_lead_setting('offers') -> coalesce(p.product_fit, 'standart');
begin
  return replace(replace(replace(replace(coalesce(p_text, ''),
    '{ism}', v_first),
    '{tarif}', coalesce(v_offer->>'title', '')),
    '{narx}', coalesce(v_offer->>'text', '')),
    '{sana}', coalesce(p_date, ''));
end;
$$;

----------------------------------------------------------------------
-- 2. Timers (spec §4)
----------------------------------------------------------------------

create or replace function public.fn_lead_set_timer(p_id uuid, p_kind text, p_start timestamptz, p_due timestamptz)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.leads
     set timer_kind = p_kind, timer_start_at = p_start, due_at = p_due,
         last_escalated_at = null, escalation_count = 0
   where id = p_id
$$;

create or replace function public.fn_lead_clear_timer(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.leads
     set timer_kind = null, timer_start_at = null, due_at = null,
         last_escalated_at = null, escalation_count = 0
   where id = p_id
$$;

-- The next call of the ladder shows in HOZIR 10 minutes before it is due and
-- is overdue when its time has come.
create or replace function public.fn_lead_arm_ladder(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_next timestamptz;
begin
  select next_attempt_at into v_next from public.leads where id = p_id;
  if v_next is null then
    perform public.fn_lead_clear_timer(p_id);
    return;
  end if;
  perform public.fn_lead_set_timer(p_id, 'ladder', v_next - interval '10 minutes', v_next);
  update public.leads set ladder_state = 'running' where id = p_id;
end;
$$;

-- Somebody wrote / filled a form again. Starts the right timer unless one is
-- already running (the earliest deadline stands).
create or replace function public.fn_lead_reengage(p_id uuid, p_at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
  v_due timestamptz;
begin
  select * into l from public.leads where id = p_id for update;
  if l.id is null or l.merged_into_id is not null then return; end if;
  -- A student writing is the manager's business, not a sales timer (spec §5).
  if l.stage = 'student' or l.matched_student_id is not null then return; end if;
  if l.due_at is not null and l.timer_kind in ('first', 'reply') then return; end if;

  if l.answered_at is null then
    -- Never handled in the new system (a brand-new lead, or an old card that
    -- wrote again): a first-contact timer, visible at once.
    v_due := public.fn_lead_due_at(p_at);
    update public.leads
       set first_contact_at = coalesce(first_contact_at, p_at),
           first_due_at = coalesce(first_due_at, v_due)
     where id = p_id;
    perform public.fn_lead_set_timer(p_id, 'first', public.fn_lead_shift_into_hours(p_at), v_due);
  else
    -- Already answered once: the client is waiting for a reply. It sits in
    -- BUGUN for its 10 minutes and jumps to HOZIR when they are gone.
    v_due := public.fn_lead_due_at(p_at);
    perform public.fn_lead_set_timer(p_id, 'reply', v_due, v_due);
  end if;

  -- A client message ends the ladder and any silence sequence.
  update public.leads
     set ladder_state = case when ladder_state = 'running' then 'stopped' else ladder_state end,
         next_attempt_at = null
   where id = p_id;
  update public.lead_drafts set status = 'skipped', handled_at = now()
   where lead_id = p_id and status = 'pending' and kind like 'followup%';

  if l.stage = 'lost' then
    update public.leads
       set stage = 'contacted', reactivation_queue = null
     where id = p_id;
    update public.reactivation_queues set status = 'done', moved_at = now()
     where lead_id = p_id and status in ('waiting', 'ready');
    perform public.fn_lead_log(p_id, 'reopen', null, jsonb_build_object('why', 'client_wrote', 'lost_reason', l.lost_reason));
  end if;
end;
$$;

-- Reactivation queues for a lost lead (spec §8).
create or replace function public.fn_lead_enqueue_reactivation(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_queue text;
  v_now timestamptz := now();
  v_year integer := extract(year from (now() at time zone 'Asia/Tashkent'))::integer;
  v_due timestamptz;
  c timestamptz;
begin
  select r->>'queue' into v_queue
    from jsonb_array_elements(public.fn_lead_setting('lost_reasons')) r
   where r->>'key' = p_reason;
  if v_queue is null then return; end if;

  update public.reactivation_queues set status = 'cancelled'
   where lead_id = p_id and status in ('waiting', 'ready');

  if v_queue = 'hanbox' then
    -- starts when the next group is announced: a senior presses "Navbatni boshlash"
    insert into public.reactivation_queues (lead_id, queue_key, reason, offer_key, channel, due_at)
    values (p_id, 'hanbox', p_reason, 'hanbox', 'call', null);
  elsif v_queue = 'no_risk' then
    -- starts once the NO RISK condition is on the tariff card (lead_settings.no_risk_announced)
    insert into public.reactivation_queues (lead_id, queue_key, reason, offer_key, channel, due_at)
    values (p_id, 'no_risk', p_reason, 'no_risk', 'call', null);
  elsif v_queue = 'next_intake' then
    -- 10 January or 1 August, whichever comes next (Tashkent, 09:00).
    foreach c in array array[
      ((make_date(v_year, 1, 10) + time '09:00') at time zone 'Asia/Tashkent'),
      ((make_date(v_year, 8, 1) + time '09:00') at time zone 'Asia/Tashkent'),
      ((make_date(v_year + 1, 1, 10) + time '09:00') at time zone 'Asia/Tashkent')
    ] loop
      if c > v_now and v_due is null then v_due := c; end if;
    end loop;
    insert into public.reactivation_queues (lead_id, queue_key, reason, channel, due_at)
    values (p_id, 'next_intake', p_reason, 'call', v_due);
  elsif v_queue = 'other_center' then
    insert into public.reactivation_queues (lead_id, queue_key, reason, channel, due_at)
    values (p_id, 'other_center', p_reason, 'call', v_now + interval '30 days');
  elsif v_queue = 'no_contact' then
    insert into public.reactivation_queues (lead_id, queue_key, reason, channel, due_at) values
      (p_id, 'no_contact', p_reason, 'dm', v_now + interval '14 days'),
      (p_id, 'no_contact', p_reason, 'call', v_now + interval '45 days');
  else
    -- price / parents: wait for somebody to start the queue (an announced
    -- university deadline, a parents' evening).
    insert into public.reactivation_queues (lead_id, queue_key, reason, channel, due_at)
    values (p_id, v_queue, p_reason, 'call', null);
  end if;
end;
$$;

-- Close a lead as lost.
create or replace function public.fn_lead_lose(p_id uuid, p_reason text, p_competitor text, p_note text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_comp text := nullif(trim(coalesce(p_competitor, '')), '');
begin
  if not exists (
    select 1 from jsonb_array_elements(public.fn_lead_setting('lost_reasons')) r where r->>'key' = p_reason
  ) then
    raise exception 'bad_lost_reason' using errcode = '22023';
  end if;

  update public.leads
     set stage = 'lost', lost_reason = p_reason, lost_competitor = v_comp,
         competitor = coalesce(v_comp, competitor),
         lost_at = now(), lost_by = p_actor,
         timer_kind = null, timer_start_at = null, due_at = null,
         last_escalated_at = null, escalation_count = 0,
         next_action_at = null, next_action_kind = null, next_action_note = null,
         next_attempt_at = null,
         ladder_state = case when ladder_state = 'running' then 'stopped' else ladder_state end,
         wait_until = null, wait_reason = null, reactivation_queue = null
   where id = p_id;
  update public.lead_drafts set status = 'skipped', handled_at = now()
   where lead_id = p_id and status = 'pending';
  perform public.fn_lead_log(p_id, 'lost', p_actor,
    jsonb_build_object('reason', p_reason, 'competitor', v_comp, 'note', nullif(trim(coalesce(p_note, '')), '')));
  perform public.fn_lead_enqueue_reactivation(p_id, p_reason);
end;
$$;

-- Move a lead into Kutish (waiting) with a date and a reason (spec §8).
create or replace function public.fn_lead_wait(p_id uuid, p_until date, p_reason text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_until is null or p_until <= (now() at time zone 'Asia/Tashkent')::date then
    raise exception 'wait_date_required' using errcode = '23514';
  end if;
  if p_reason is null or p_reason not in ('exam_result', 'family_decision', 'money', 'next_intake', 'other') then
    raise exception 'wait_reason_required' using errcode = '23514';
  end if;
  update public.leads
     set stage = 'waiting', wait_until = p_until, wait_reason = p_reason,
         timer_kind = null, timer_start_at = null, due_at = null,
         last_escalated_at = null, escalation_count = 0,
         next_attempt_at = null,
         ladder_state = case when ladder_state = 'running' then 'stopped' else ladder_state end,
         next_action_at = (p_until + time '09:00') at time zone 'Asia/Tashkent',
         next_action_kind = 'wait_end', next_action_note = p_reason
   where id = p_id;
  perform public.fn_lead_log(p_id, 'wait', p_actor, jsonb_build_object('until', p_until, 'reason', p_reason));
end;
$$;

----------------------------------------------------------------------
-- 3. One person, one card (spec §5)
----------------------------------------------------------------------

create or replace function public.fn_lead_merge(p_keep uuid, p_drop uuid, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  k public.leads;
  d public.leads;
  v_stage text;
  v_answered timestamptz;
  v_ans_by uuid;
  v_ans_kind text;
  t_kind text; t_start timestamptz; t_due timestamptz;
  d_kind text; d_start timestamptz; d_due timestamptz;
  v_tbl text;
begin
  if p_keep is null or p_drop is null or p_keep = p_drop then return; end if;
  perform set_config('lead_v2.merging', '1', true);

  select * into k from public.leads where id = p_keep for update;
  select * into d from public.leads where id = p_drop for update;
  if k.id is null or d.id is null or k.merged_into_id is not null or d.merged_into_id is not null then
    perform set_config('lead_v2.merging', '', true);
    return;
  end if;

  -- stage: the furthest one; a student wins; lost only if both are lost.
  if k.stage = 'student' or d.stage = 'student' then v_stage := 'student';
  elsif k.stage = 'lost' and d.stage = 'lost' then v_stage := 'lost';
  elsif k.stage = 'lost' then v_stage := d.stage;
  elsif d.stage = 'lost' then v_stage := k.stage;
  elsif public.fn_lead_stage_rank(d.stage) > public.fn_lead_stage_rank(k.stage) then v_stage := d.stage;
  else v_stage := k.stage;
  end if;

  -- answered: the earliest answer stands.
  if k.answered_at is not null and (d.answered_at is null or k.answered_at <= d.answered_at) then
    v_answered := k.answered_at; v_ans_by := k.answered_by; v_ans_kind := k.answer_kind;
  elsif d.answered_at is not null then
    v_answered := d.answered_at; v_ans_by := d.answered_by; v_ans_kind := d.answer_kind;
  end if;

  -- timer: the earliest deadline stands; an answered lead has no first-contact timer.
  t_kind := k.timer_kind; t_start := k.timer_start_at; t_due := k.due_at;
  d_kind := d.timer_kind; d_start := d.timer_start_at; d_due := d.due_at;
  if v_answered is not null then
    if t_kind = 'first' then t_kind := null; t_start := null; t_due := null; end if;
    if d_kind = 'first' then d_kind := null; d_start := null; d_due := null; end if;
  end if;
  if d_due is not null and (t_due is null or d_due < t_due) then
    t_kind := d_kind; t_start := d_start; t_due := d_due;
  end if;
  if v_stage in ('student', 'lost') then t_kind := null; t_start := null; t_due := null; end if;

  update public.leads set
    phone = coalesce(k.phone, d.phone),
    email = coalesce(k.email, d.email),
    birth_date = coalesce(k.birth_date, d.birth_date),
    age = coalesce(k.age, d.age),
    city = coalesce(k.city, d.city),
    education_level = coalesce(k.education_level, d.education_level),
    cert_level = coalesce(k.cert_level, d.cert_level),
    english_level = coalesce(k.english_level, d.english_level),
    korean_level = coalesce(k.korean_level, d.korean_level),
    budget_range = coalesce(k.budget_range, d.budget_range),
    target_intake = coalesce(k.target_intake, d.target_intake),
    exam_date = coalesce(k.exam_date, d.exam_date),
    exam_type = coalesce(k.exam_type, d.exam_type),
    how_heard = coalesce(k.how_heard, d.how_heard),
    source_note = coalesce(k.source_note, d.source_note),
    contact_channel = coalesce(k.contact_channel, d.contact_channel),
    telegram_handle = coalesce(k.telegram_handle, d.telegram_handle),
    instagram_handle = coalesce(k.instagram_handle, d.instagram_handle),
    study_year = coalesce(k.study_year, d.study_year),
    decider = coalesce(k.decider, d.decider),
    language = coalesce(k.language, d.language),
    preferred_channel = coalesce(k.preferred_channel, d.preferred_channel),
    preferred_time_text = coalesce(k.preferred_time_text, d.preferred_time_text),
    campaign_name = coalesce(k.campaign_name, d.campaign_name),
    adset_name = coalesce(k.adset_name, d.adset_name),
    ad_name = coalesce(k.ad_name, d.ad_name),
    form_name = coalesce(k.form_name, d.form_name),
    utm = coalesce(k.utm, d.utm),
    referral_type = coalesce(k.referral_type, d.referral_type),
    referral_name = coalesce(k.referral_name, d.referral_name),
    referred_by_student_id = coalesce(k.referred_by_student_id, d.referred_by_student_id),
    product_fit = coalesce(k.product_fit, d.product_fit),
    objection = coalesce(k.objection, d.objection),
    competitor = coalesce(k.competitor, d.competitor),
    ai_summary = coalesce(k.ai_summary, d.ai_summary),
    converted_to_student_id = coalesce(k.converted_to_student_id, d.converted_to_student_id),
    contract_number = coalesce(k.contract_number, d.contract_number),
    contract_date = coalesce(k.contract_date, d.contract_date),
    notes = case
      when d.notes is null or d.notes = '' then k.notes
      when k.notes is null or k.notes = '' then d.notes
      when position(d.notes in k.notes) > 0 then k.notes
      else k.notes || E'\n' || d.notes end,
    owner_id = coalesce(k.owner_id, d.owner_id),
    first_contact_at = least(k.first_contact_at, d.first_contact_at),
    first_due_at = least(k.first_due_at, d.first_due_at),
    last_client_msg_at = greatest(k.last_client_msg_at, d.last_client_msg_at),
    last_operator_msg_at = greatest(k.last_operator_msg_at, d.last_operator_msg_at),
    last_contacted_at = greatest(k.last_contacted_at, d.last_contacted_at),
    last_attempt_at = greatest(k.last_attempt_at, d.last_attempt_at),
    asked_price = k.asked_price or d.asked_price,
    pinned_at = coalesce(k.pinned_at, d.pinned_at),
    pinned_by = coalesce(k.pinned_by, d.pinned_by),
    answered_at = v_answered, answered_by = v_ans_by, answer_kind = v_ans_kind,
    stage = v_stage,
    timer_kind = t_kind, timer_start_at = t_start, due_at = t_due,
    last_escalated_at = case when t_due is distinct from k.due_at then null else k.last_escalated_at end,
    next_action_at = coalesce(k.next_action_at, d.next_action_at),
    next_action_kind = case when k.next_action_at is not null then k.next_action_kind else d.next_action_kind end,
    next_action_note = case when k.next_action_at is not null then k.next_action_note else d.next_action_note end
  where id = p_keep;

  -- Everything that pointed at the dropped card now points at the survivor.
  foreach v_tbl in array array[
    'communication_identities', 'calls', 'instagram_comments', 'lead_notes', 'lead_contacts',
    'lead_drafts', 'lead_events', 'call_attempts', 'lead_promises', 'social_comments', 'call_analyses',
    'communication_embeddings', 'app_accounts', 'learning_center_students', 'call_lead_suggestions'
  ] loop
    if to_regclass('public.' || v_tbl) is not null
       and exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = v_tbl and column_name = 'lead_id') then
      begin
        execute format('update public.%I set lead_id = $1 where lead_id = $2', v_tbl) using p_keep, p_drop;
      exception when unique_violation then
        execute format('delete from public.%I where lead_id = $1', v_tbl) using p_drop;
      end;
    end if;
  end loop;
  if to_regclass('public.lead_field_suggestions') is not null then
    delete from public.lead_field_suggestions s
     where s.lead_id = p_drop
       and exists (select 1 from public.lead_field_suggestions o where o.lead_id = p_keep and o.field = s.field);
    update public.lead_field_suggestions set lead_id = p_keep where lead_id = p_drop;
  end if;
  begin
    update public.reactivation_queues set lead_id = p_keep where lead_id = p_drop;
  exception when unique_violation then
    delete from public.reactivation_queues where lead_id = p_drop;
  end;
  update public.lead_merge_suggestions set status = 'merged'
   where (lead_id = p_drop and other_id = p_keep) or (lead_id = p_keep and other_id = p_drop);
  delete from public.lead_merge_suggestions where lead_id = p_drop or other_id = p_drop;

  -- The dropped card stays as a hidden tombstone (other tables may point at it).
  update public.leads set
    merged_into_id = p_keep, stage = 'lost', status = 'lost', lost_reason = 'spam_duplicate',
    qualified = false, timer_kind = null, timer_start_at = null, due_at = null,
    next_action_at = null, next_action_kind = null, next_attempt_at = null, ladder_state = 'stopped'
  where id = p_drop;

  perform public.fn_lead_log(p_keep, 'merge', p_actor, jsonb_build_object('merged', p_drop, 'name', d.full_name));
  perform set_config('lead_v2.merging', '', true);
end;
$$;

-- Merge by exact keys (phone, @username); suggest by name only.
create or replace function public.fn_lead_try_merge(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
  r record;
  v_pk text;
  v_tg text;
  v_ig text;
begin
  if current_setting('lead_v2.merging', true) = '1' then return; end if;
  select * into l from public.leads where id = p_id;
  if l.id is null or l.merged_into_id is not null then return; end if;

  v_pk := public.fn_lead_phone_key(l.phone);
  v_tg := public.fn_lead_handle_key(l.telegram_handle);
  v_ig := public.fn_lead_handle_key(l.instagram_handle);

  if v_pk is not null or v_tg is not null or v_ig is not null then
    for r in
      select o.id, o.created_at
        from public.leads o
       where o.id <> l.id
         and o.merged_into_id is null
         and (
           (v_pk is not null and public.fn_lead_phone_key(o.phone) = v_pk)
           or (v_tg is not null and public.fn_lead_handle_key(o.telegram_handle) = v_tg)
           or (v_ig is not null and public.fn_lead_handle_key(o.instagram_handle) = v_ig)
         )
       order by o.created_at
    loop
      if r.created_at <= l.created_at then
        -- the other card is older: it survives
        perform public.fn_lead_merge(r.id, l.id, null);
        perform public.fn_lead_try_merge(r.id);
        return;
      else
        perform public.fn_lead_merge(l.id, r.id, null);
      end if;
    end loop;
  end if;

  -- Same name only: ask a person.
  if length(trim(coalesce(l.full_name, ''))) >= 6
     and l.full_name !~* '^(instagram|telegram|ilova|facebook)\M' then
    insert into public.lead_merge_suggestions (lead_id, other_id, reason)
    select l.id, o.id, 'same_name'
      from public.leads o
     where o.id <> l.id and o.merged_into_id is null
       and lower(trim(o.full_name)) = lower(trim(l.full_name))
    on conflict do nothing;
  end if;
end;
$$;

-- A lead whose phone belongs to a student is not a sales lead (spec §5).
create or replace function public.fn_lead_check_student(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
  v_pk text;
  v_student uuid;
begin
  if to_regclass('public.student_phones') is null then return; end if;
  select * into l from public.leads where id = p_id;
  if l.id is null or l.matched_student_id is not null or l.stage = 'student' then return; end if;
  v_pk := public.fn_lead_phone_key(l.phone);
  if v_pk is null then return; end if;

  select sp.student_id into v_student
    from public.student_phones sp
   where public.fn_lead_phone_key(coalesce(sp.phone_norm, sp.phone)) = v_pk
   limit 1;
  if v_student is null then return; end if;

  update public.leads
     set matched_student_id = v_student,
         timer_kind = null, timer_start_at = null, due_at = null,
         last_escalated_at = null, escalation_count = 0
   where id = p_id;
  perform public.fn_lead_log(p_id, 'student_match', null, jsonb_build_object('student_id', v_student));
  perform public.fn_lead_enqueue_alert(p_id, 'student', 'boss',
    jsonb_build_object('name', l.full_name, 'student_id', v_student));
end;
$$;

----------------------------------------------------------------------
-- 4. Triggers on leads
----------------------------------------------------------------------

create or replace function public.fn_leads_v2_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- rows written by older code paths carry a status, not a stage
  if new.status = 'converted' or new.converted_to_student_id is not null then
    new.stage := 'student';
  elsif new.status = 'lost' then
    new.stage := 'lost';
  elsif new.stage = 'new' and new.status in ('contacted', 'qualified') then
    new.stage := 'contacted';
  end if;
  new.stage_changed_at := coalesce(new.stage_changed_at, now());

  if new.crm_generation = 'new' then
    new.first_contact_at := coalesce(new.first_contact_at, now());
    -- A lead born from a chat exists because the client wrote: that first
    -- message may be stored before the lead is (telegram-webhook does), so the
    -- message trigger would never see it.
    if new.source in ('instagram', 'telegram') and new.last_client_msg_at is null then
      new.last_client_msg_at := new.first_contact_at;
    end if;
    if new.source = 'manual' and new.owner_id is null and new.created_by is not null then
      new.owner_id := new.created_by;
    end if;
    if new.stage = 'new' and new.due_at is null and coalesce(new.source, '') <> 'learning_center' then
      new.timer_kind := 'first';
      new.timer_start_at := public.fn_lead_shift_into_hours(new.first_contact_at);
      new.due_at := public.fn_lead_due_at(new.first_contact_at);
      new.first_due_at := new.due_at;
    end if;
    new.priority_score := public.fn_lead_priority(new);
  end if;
  return new;
end;
$$;

create or replace function public.fn_leads_v2_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_into uuid;
begin
  perform public.fn_lead_log(new.id, 'created', new.created_by,
    jsonb_build_object('source', new.source, 'generation', new.crm_generation));
  perform public.fn_lead_try_merge(new.id);

  -- If this contact turned out to be somebody we already know, the person has
  -- just written / filled a form again: the surviving card needs its timer.
  select merged_into_id into v_into from public.leads where id = new.id;
  if v_into is not null then
    perform public.fn_lead_reengage(v_into, coalesce(new.first_contact_at, now()));
  else
    perform public.fn_lead_check_student(new.id);
  end if;
  return null;
end;
$$;

create or replace function public.fn_leads_v2_before_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if current_setting('lead_v2.merging', true) = '1' then
    return new;
  end if;

  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    new.status := case new.stage
      when 'student' then 'converted' when 'lost' then 'lost' when 'new' then 'new' else 'contacted' end;
    if new.stage in ('student', 'lost', 'waiting') then
      new.timer_kind := null; new.timer_start_at := null; new.due_at := null;
      new.last_escalated_at := null; new.escalation_count := 0;
    end if;
  elsif new.status is distinct from old.status then
    -- the old screens still write status (convert / reject / restore)
    if new.status = 'converted' then
      new.stage := 'student'; new.stage_changed_at := now();
      new.timer_kind := null; new.timer_start_at := null; new.due_at := null;
    elsif new.status = 'lost' then
      new.stage := 'lost'; new.stage_changed_at := now();
      new.timer_kind := null; new.timer_start_at := null; new.due_at := null;
    elsif new.status in ('contacted', 'qualified') and old.stage in ('new', 'lost', 'student') then
      new.stage := 'contacted'; new.stage_changed_at := now();
    elsif new.status = 'new' and old.stage in ('lost', 'student') then
      new.stage := 'new'; new.stage_changed_at := now();
    end if;
  end if;

  if new.crm_generation = 'new' then
    new.priority_score := public.fn_lead_priority(new);
  end if;
  return new;
end;
$$;

create or replace function public.fn_leads_v2_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if current_setting('lead_v2.merging', true) = '1' then
    return null;
  end if;

  if new.stage is distinct from old.stage then
    perform public.fn_lead_log(new.id, 'stage', auth.uid(),
      jsonb_build_object('from', old.stage, 'to', new.stage));
    if new.stage = 'student' then
      perform public.fn_lead_enqueue_alert(new.id, 'contract', 'boss',
        jsonb_build_object('name', new.full_name, 'stage', 'student', 'owner_id', new.owner_id));
    end if;
  end if;

  if new.phone is distinct from old.phone
     or new.telegram_handle is distinct from old.telegram_handle
     or new.instagram_handle is distinct from old.instagram_handle then
    perform public.fn_lead_try_merge(new.id);
    perform public.fn_lead_check_student(new.id);
  end if;

  -- The app quiz was submitted again: the old card writes again.
  if new.quiz_submitted_at is not null and new.quiz_submitted_at is distinct from old.quiz_submitted_at then
    perform public.fn_lead_reengage(new.id, new.quiz_submitted_at);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_leads_v2_before_insert on public.leads;
create trigger trg_leads_v2_before_insert
  before insert on public.leads
  for each row execute function public.fn_leads_v2_before_insert();

drop trigger if exists trg_leads_v2_after_insert on public.leads;
create trigger trg_leads_v2_after_insert
  after insert on public.leads
  for each row execute function public.fn_leads_v2_after_insert();

-- Named "trg_a_..." so it runs before the other BEFORE triggers (they fire in
-- name order) and the stage/status are settled when they look.
drop trigger if exists trg_a_leads_v2_before_update on public.leads;
create trigger trg_a_leads_v2_before_update
  before update on public.leads
  for each row execute function public.fn_leads_v2_before_update();

drop trigger if exists trg_leads_v2_after_update on public.leads;
create trigger trg_leads_v2_after_update
  after update on public.leads
  for each row execute function public.fn_leads_v2_after_update();

-- The "lead v2 update" policy says WHICH rows a caller may update, not which
-- columns. The columns below belong to the engine: they change only through
-- the lead_* RPCs (security definer, so they run as the function owner) or
-- from edge functions (service_role). A browser writing them straight through
-- PostgREST runs as `authenticated` and is refused, whatever its role: it
-- could otherwise stop a timer (due_at = null) without answering, skip the 5
-- mandatory fields (stage), move the ladder, pin, or take a lead.
-- status may still be set to 'converted' with converted_to_student_id: that is
-- the "make a student" flow (LeadsContext.convertToStudent).
-- SECURITY INVOKER on purpose: current_user must be the caller.
create or replace function public.fn_leads_v2_guard_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.stage is distinct from old.stage
     or new.crm_generation is distinct from old.crm_generation
     or new.owner_id is distinct from old.owner_id
     or new.first_contact_at is distinct from old.first_contact_at
     or new.timer_kind is distinct from old.timer_kind
     or new.timer_start_at is distinct from old.timer_start_at
     or new.due_at is distinct from old.due_at
     or new.first_due_at is distinct from old.first_due_at
     or new.last_escalated_at is distinct from old.last_escalated_at
     or new.escalation_count is distinct from old.escalation_count
     or new.last_client_msg_at is distinct from old.last_client_msg_at
     or new.last_operator_msg_at is distinct from old.last_operator_msg_at
     or new.answered_at is distinct from old.answered_at
     or new.answered_by is distinct from old.answered_by
     or new.answer_kind is distinct from old.answer_kind
     or new.attempt_no is distinct from old.attempt_no
     or new.last_attempt_at is distinct from old.last_attempt_at
     or new.next_attempt_at is distinct from old.next_attempt_at
     or new.ladder_state is distinct from old.ladder_state
     or new.wait_until is distinct from old.wait_until
     or new.wait_reason is distinct from old.wait_reason
     or new.lost_reason is distinct from old.lost_reason
     or new.lost_competitor is distinct from old.lost_competitor
     or new.lost_at is distinct from old.lost_at
     or new.lost_by is distinct from old.lost_by
     or new.pinned_at is distinct from old.pinned_at
     or new.pinned_by is distinct from old.pinned_by
     or new.merged_into_id is distinct from old.merged_into_id
     or new.matched_student_id is distinct from old.matched_student_id
     or new.priority_score is distinct from old.priority_score
     or new.stage_changed_at is distinct from old.stage_changed_at
     or new.reactivation_queue is distinct from old.reactivation_queue
  then
    raise exception 'not_allowed' using detail = 'engine_column', errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not (new.status = 'converted' and new.converted_to_student_id is not null) then
    raise exception 'not_allowed' using detail = 'status', errcode = '42501';
  end if;

  return new;
end;
$$;

-- "trg_0_..." sorts before "trg_a_...": the guard sees the caller's own
-- change, before fn_leads_v2_before_update derives stage/timers from status.
drop trigger if exists trg_0_leads_v2_guard_columns on public.leads;
create trigger trg_0_leads_v2_guard_columns
  before update on public.leads
  for each row execute function public.fn_leads_v2_guard_columns();

----------------------------------------------------------------------
-- 5. Messages: the client wrote / we answered (spec §4, §1.4)
----------------------------------------------------------------------

create or replace function public.fn_leads_v2_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
  l public.leads;
  v_kind text;
  v_has_phone boolean;
  v_chat_answers boolean;
  v_hit text;
begin
  if new.source not in ('instagram', 'telegram', 'facebook') or coalesce(trim(new.sender_id), '') = '' then
    return new;
  end if;
  if coalesce(new.message_type, '') in ('comment', 'note')
     or coalesce(new.metadata->>'internal', '') in ('true', 't', '1') then
    return new;
  end if;

  v_id := public.fn_lead_find_by_chat(new.source, new.sender_id);
  if v_id is null then return new; end if;
  select * into l from public.leads where id = v_id for update;
  if l.id is null then return new; end if;

  if new.direction = 'incoming' then
    update public.leads
       set last_client_msg_at = greatest(coalesce(last_client_msg_at, new.created_at), new.created_at),
           asked_price = asked_price or (coalesce(new.content, '') ~* '(narx|qancha|tarif|shartnoma|to''lov|цен|сколько|стоим|договор|price|cost)'),
           language = coalesce(language, public.fn_lead_guess_language(new.content))
     where id = v_id;

    -- Only live messages start a timer; a backfilled history must not.
    if new.created_at >= now() - interval '30 minutes' then
      select w into v_hit
        from jsonb_array_elements_text(coalesce(public.fn_lead_setting('boss_alert_words'), '[]'::jsonb)) w
       where position(lower(w) in lower(coalesce(new.content, ''))) > 0
       limit 1;
      if v_hit is not null then
        perform public.fn_lead_enqueue_alert(v_id, 'keyword', 'boss',
          jsonb_build_object('name', l.full_name, 'word', v_hit, 'text', left(new.content, 300)));
      end if;
      perform public.fn_lead_reengage(v_id, new.created_at);
    end if;
    return new;
  end if;

  -- outgoing
  if new.direction <> 'outgoing' or public.fn_is_automatic_outgoing(new.content, new.metadata) then
    return new;
  end if;
  -- a reply from before the lead existed is not a reply to it
  if new.created_at < coalesce(l.first_contact_at, l.created_at) - interval '1 minute' then
    return new;
  end if;

  update public.leads
     set last_operator_msg_at = greatest(coalesce(last_operator_msg_at, new.created_at), new.created_at),
         last_contacted_at = greatest(coalesce(last_contacted_at, new.created_at), new.created_at),
         owner_id = coalesce(owner_id, (
           select ur.user_id from public.user_roles ur
            where ur.user_id = new.replied_by
              and ur.role::text in ('call_operator', 'lead_senior', 'owner', 'admin')
            limit 1))
   where id = v_id;

  if l.matched_student_id is not null or l.stage = 'student' then
    return new;
  end if;

  if l.answered_at is null then
    v_has_phone := public.fn_lead_phone_key(l.phone) is not null;
    v_chat_answers := coalesce((public.fn_lead_setting('chat_answers_phone_leads') #>> '{}')::boolean, false);
    if not v_has_phone or v_chat_answers then
      v_kind := 'chat';
    elsif l.last_attempt_at is not null and new.created_at >= l.last_attempt_at - interval '1 minute' then
      -- operators call first; if nobody answers, write in the chat (spec §1.4)
      v_kind := 'call_attempt+chat';
    end if;

    if v_kind is not null then
      update public.leads
         set answered_at = new.created_at, answered_by = new.replied_by, answer_kind = v_kind,
             stage = case when stage = 'new' then 'contacted' else stage end
       where id = v_id;
      perform public.fn_lead_log(v_id, 'answered', new.replied_by,
        jsonb_build_object('kind', v_kind, 'seconds', extract(epoch from (new.created_at - coalesce(l.first_contact_at, l.created_at)))::integer));
      if l.timer_kind in ('first', 'reply') then
        perform public.fn_lead_clear_timer(v_id);
      end if;
      if l.ladder_state = 'running' and l.next_attempt_at is not null then
        perform public.fn_lead_arm_ladder(v_id);
      end if;
    end if;
  elsif l.timer_kind = 'reply' then
    perform public.fn_lead_clear_timer(v_id);
    perform public.fn_lead_log(v_id, 'answered', new.replied_by, jsonb_build_object('kind', 'chat', 'reply', true));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_v2_on_message on public.messages;
create trigger trg_leads_v2_on_message
  after insert on public.messages
  for each row execute function public.fn_leads_v2_on_message();

----------------------------------------------------------------------
-- 6. Outside working hours: the automatic reply (spec §4)
----------------------------------------------------------------------

-- Every text that counts as "the automatic reply, not an answer": the three
-- legacy ones, and the ones from lead_settings.auto_reply.
create or replace function public.fn_after_hours_reply_texts()
returns text[]
language sql
stable
set search_path = public, pg_catalog
as $$
  select array_remove(array[
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 10:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 10:00–18:00). Operatorlarimiz ertaga soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 10:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    public.fn_lead_setting('auto_reply')->>'uz',
    public.fn_lead_setting('auto_reply')->>'ru'
  ]::text[], null)
$$;

-- Same body as 20260930120000_ignore_instagram_template_echo.sql; STABLE now,
-- because fn_after_hours_reply_texts() reads lead_settings.
-- Plus: a message written by the Telegram bot (telegram-webhook stamps
-- metadata.bot = true) is not a person answering either.
create or replace function public.fn_is_automatic_outgoing(p_content text, p_metadata jsonb)
returns boolean
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  select trim(coalesce(p_content, '')) like '[template]%'
      or coalesce(p_metadata->'attachments'->0->>'type', '') = 'template'
      or coalesce(p_metadata->>'bot', '') in ('true', 't', '1')
      or trim(coalesce(p_content, '')) = any (public.fn_after_hours_reply_texts())
$$;

-- The reply for a chat that arrived at p_at (Uzbek), or null inside working hours.
create or replace function public.fn_after_hours_reply_text(p_at timestamptz)
returns text
language sql
stable
set search_path = public, pg_catalog
as $$
  select case when public.fn_lead_in_hours(p_at) then null
              else public.fn_lead_setting('auto_reply')->>'uz' end
$$;

-- In the language of the message (Cyrillic -> Russian).
create or replace function public.fn_lead_auto_reply_text(p_at timestamptz, p_content text)
returns text
language sql
stable
set search_path = public, pg_catalog
as $$
  select case when public.fn_lead_in_hours(p_at) then null
              else coalesce(public.fn_lead_setting('auto_reply')->>public.fn_lead_guess_language(p_content),
                            public.fn_lead_setting('auto_reply')->>'uz') end
$$;

-- As in 20260929170000_after_hours_reply_wait_for_quiet.sql; the only change is
-- the text, which now follows the new hours and the client's language.
create or replace function public.fn_queue_after_hours_reply()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_text text;
begin
  if new.direction <> 'incoming'
     or new.source not in ('instagram', 'telegram')
     or coalesce(trim(new.sender_id), '') = '' then
    return new;
  end if;

  update public.after_hours_reply_queue q
     set last_incoming_at = greatest(coalesce(q.last_incoming_at, q.arrived_at), new.created_at)
   where q.source = new.source
     and q.sender_id = new.sender_id
     and q.claimed_at is null;
  if found then
    return new;
  end if;

  if new.source = 'instagram' and coalesce(new.message_type, '') = 'comment' then
    return new;
  end if;
  if new.source = 'telegram'
     and coalesce(new.metadata->>'chat_type', '') <> 'private'
     and not (coalesce(new.metadata, '{}'::jsonb) ? 'business_connection_id') then
    return new;
  end if;
  if new.created_at < now() - interval '30 minutes' then
    return new;
  end if;

  v_text := public.fn_lead_auto_reply_text(new.created_at, new.content);
  if v_text is null then
    return new;
  end if;

  -- Only the chat's very first message: once per conversation.
  if exists (
    select 1 from public.messages m
     where m.source = new.source
       and m.sender_id = new.sender_id
       and m.id <> new.id
  ) then
    return new;
  end if;

  insert into public.after_hours_reply_queue (source, sender_id, arrived_at, last_incoming_at, reply_text)
  values (new.source, new.sender_id, new.created_at, new.created_at, v_text)
  on conflict (source, sender_id) do nothing;

  return new;
end;
$$;

----------------------------------------------------------------------
-- 7. Escalation scan (spec §4) — every 30 seconds
----------------------------------------------------------------------

-- Every lead whose deadline has passed and nobody answered gets an alert in the
-- outbox for everyone (operators, senior, boss), and again every N minutes
-- until it is answered. Only inside working hours. Returns how many.
create or replace function public.fn_lead_timer_scan(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  n integer := 0;
  v_repeat integer := coalesce((public.fn_lead_setting('escalation_repeat_minutes') #>> '{}')::integer, 10);
  v_user text;
begin
  if not public.fn_lead_in_hours(p_now) then
    return 0;
  end if;

  for r in
    select l.id, l.full_name, l.phone, l.source, l.contact_channel, l.timer_kind, l.due_at, l.owner_id,
           l.campaign_name, l.form_name, l.attempt_no, l.escalation_count,
           coalesce(nullif(l.instagram_handle, ''), nullif(l.telegram_handle, '')) as handle
      from public.leads l
     where l.due_at is not null
       and l.timer_start_at <= p_now
       and l.due_at <= p_now
       and l.merged_into_id is null
       and l.matched_student_id is null
       and l.stage <> 'student'
       and (l.last_escalated_at is null
            or l.last_escalated_at <= p_now - make_interval(mins => v_repeat) + interval '5 seconds')
     order by l.due_at
       for update skip locked
  loop
    select ci.identifier_label into v_user
      from public.communication_identities ci
     where ci.lead_id = r.id and ci.identifier_label is not null
     order by ci.created_at desc limit 1;

    update public.leads
       set last_escalated_at = p_now, escalation_count = escalation_count + 1
     where id = r.id;

    perform public.fn_lead_enqueue_alert(r.id, 'escalation', 'everyone', jsonb_build_object(
      'name', r.full_name,
      'username', coalesce(r.handle, v_user),
      'phone', r.phone,
      'source', r.source,
      'channel', r.contact_channel,
      'campaign', r.campaign_name,
      'form', r.form_name,
      'timer', r.timer_kind,
      'attempt', r.attempt_no,
      'minutes_late', greatest(0, floor(extract(epoch from (p_now - r.due_at)) / 60))::integer,
      'repeat', r.escalation_count + 1,
      'owner_id', r.owner_id));
    perform public.fn_lead_log(r.id, 'escalation', null,
      jsonb_build_object('n', r.escalation_count + 1,
        'minutes_late', greatest(0, floor(extract(epoch from (p_now - r.due_at)) / 60))::integer));
    n := n + 1;
  end loop;
  return n;
end;
$$;

----------------------------------------------------------------------
-- 8. RPCs the desk calls
----------------------------------------------------------------------

-- Card fields. Only these are writable from the browser through the RPC.
create or replace function public.fn_lead_apply_fields(p_id uuid, p_f jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- A phone, when given, has to be a real one (the merge and the student match
  -- run on it); clearing it is allowed.
  if p_f ? 'phone' and nullif(trim(coalesce(p_f->>'phone', '')), '') is not null
     and public.fn_lead_phone_key(p_f->>'phone') is null then
    raise exception 'phone_invalid' using errcode = '22023';
  end if;

  update public.leads set
    phone = case when p_f ? 'phone' then nullif(trim(p_f->>'phone'), '') else phone end,
    instagram_handle = case when p_f ? 'instagram_handle'
      then nullif(lower(regexp_replace(trim(p_f->>'instagram_handle'), '^@', '')), '') else instagram_handle end,
    telegram_handle = case when p_f ? 'telegram_handle'
      then nullif(lower(regexp_replace(trim(p_f->>'telegram_handle'), '^@', '')), '') else telegram_handle end,
    full_name = case when p_f ? 'full_name' and nullif(trim(p_f->>'full_name'), '') is not null then trim(p_f->>'full_name') else full_name end,
    email = case when p_f ? 'email' then nullif(trim(p_f->>'email'), '') else email end,
    birth_date = case when p_f ? 'birth_date' then nullif(p_f->>'birth_date', '')::date else birth_date end,
    education_level = case when p_f ? 'education_level' then nullif(trim(p_f->>'education_level'), '') else education_level end,
    cert_level = case when p_f ? 'cert_level' then nullif(trim(p_f->>'cert_level'), '') else cert_level end,
    age = case when p_f ? 'age' then nullif(p_f->>'age', '')::integer else age end,
    study_year = case when p_f ? 'study_year' then nullif(trim(p_f->>'study_year'), '') else study_year end,
    city = case when p_f ? 'city' then nullif(trim(p_f->>'city'), '') else city end,
    decider = case when p_f ? 'decider' then nullif(p_f->>'decider', '') else decider end,
    language = case when p_f ? 'language' then nullif(p_f->>'language', '') else language end,
    preferred_channel = case when p_f ? 'preferred_channel' then nullif(p_f->>'preferred_channel', '') else preferred_channel end,
    preferred_time_text = case when p_f ? 'preferred_time_text' then nullif(trim(p_f->>'preferred_time_text'), '') else preferred_time_text end,
    exam_date = case when p_f ? 'exam_date' then nullif(p_f->>'exam_date', '')::date else exam_date end,
    exam_type = case when p_f ? 'exam_type' then nullif(trim(p_f->>'exam_type'), '') else exam_type end,
    budget_range = case when p_f ? 'budget_range' then nullif(trim(p_f->>'budget_range'), '') else budget_range end,
    target_intake = case when p_f ? 'target_intake' then nullif(trim(p_f->>'target_intake'), '') else target_intake end,
    referral_type = case when p_f ? 'referral_type' then nullif(p_f->>'referral_type', '') else referral_type end,
    referral_name = case when p_f ? 'referral_name' then nullif(trim(p_f->>'referral_name'), '') else referral_name end,
    objection = case when p_f ? 'objection' then nullif(trim(p_f->>'objection'), '') else objection end,
    competitor = case when p_f ? 'competitor' then nullif(trim(p_f->>'competitor'), '') else competitor end,
    product_fit = case when p_f ? 'product_fit' then nullif(trim(p_f->>'product_fit'), '') else product_fit end,
    how_heard = case when p_f ? 'how_heard' then nullif(trim(p_f->>'how_heard'), '') else how_heard end,
    source_note = case when p_f ? 'source_note' then nullif(trim(p_f->>'source_note'), '') else source_note end
  where id = p_id;
end;
$$;

create or replace function public.lead_save_fields(p_lead_id uuid, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  perform public.fn_lead_apply_fields(p_lead_id, coalesce(p_fields, '{}'::jsonb));
  perform public.fn_lead_log(p_lead_id, 'field', auth.uid(),
    jsonb_build_object('keys', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(coalesce(p_fields, '{}'::jsonb)) k)));
end;
$$;

-- The call popup (spec §7). One call, one result.
--   p_result   talked | no_answer | busy | wrong_number
--   p_payload  { started_at, fields:{...card fields...}, stage, next_action_at,
--                next_action_kind (callback|followup), note,
--                wait_until, wait_reason, lost_reason, lost_competitor }
-- Returns { ok, result, attempt_no, next_attempt_at, chat_prompt, template, lost }.
create or replace function public.lead_record_call(p_lead_id uuid, p_result text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  l public.leads;
  v_now timestamptz := now();
  v_started timestamptz := coalesce(nullif(p_payload->>'started_at', '')::timestamptz, v_now);
  v_note text := nullif(trim(coalesce(p_payload->>'note', '')), '');
  v_seq integer;
  v_attempt integer;
  v_next timestamptz;
  v_missing text[];
  v_target text;
  v_kind text;
  v_at timestamptz;
  v_has_chat boolean;
  v_first_answer boolean;
  v_window integer := coalesce((public.fn_lead_setting('ladder')->>'window_days')::integer, 7);
  v_dm_after integer := coalesce((public.fn_lead_setting('ladder')->>'dm_after_attempt')::integer, 2);
  v_tpl jsonb;
  v_lang text;
  v_result jsonb;
  v_keep_timer boolean := false;
begin
  l := public.fn_lead_guard(p_lead_id);
  if p_result not in ('talked', 'no_answer', 'busy', 'wrong_number') then
    raise exception 'bad_result' using errcode = '22023';
  end if;
  if l.stage = 'student' then
    raise exception 'lead_is_student' using errcode = '23514';
  end if;

  select count(*) + 1 into v_seq from public.call_attempts where lead_id = p_lead_id;
  v_first_answer := l.answered_at is null;
  v_has_chat := exists (
      select 1 from public.communication_identities ci
       where ci.lead_id = p_lead_id and ci.channel in ('telegram', 'instagram', 'facebook'))
    or (l.source in ('instagram', 'telegram') and coalesce(trim(l.source_id), '') <> '');
  v_lang := coalesce(l.language, 'uz');

  -- the card fields travel with the result
  if p_payload ? 'fields' then
    perform public.fn_lead_apply_fields(p_lead_id, p_payload->'fields');
  end if;
  -- the objection / competitor taps can also sit at the top level
  if p_payload ? 'objection' or p_payload ? 'competitor' then
    perform public.fn_lead_apply_fields(p_lead_id, jsonb_strip_nulls(jsonb_build_object(
      'objection', p_payload->'objection', 'competitor', p_payload->'competitor')));
  end if;
  select * into l from public.leads where id = p_lead_id;

  insert into public.call_attempts (lead_id, operator_id, started_at, ended_at, result, attempt_no, note)
  values (p_lead_id, v_uid, v_started, v_now, p_result, v_seq, v_note);

  update public.leads
     set owner_id = coalesce(owner_id, v_uid),
         last_contacted_at = v_now,
         last_attempt_at = v_now
   where id = p_lead_id;
  perform public.fn_lead_log(p_lead_id, 'call', v_uid,
    jsonb_build_object('result', p_result, 'attempt', v_seq, 'note', v_note));

  ------------------------------------------------------------------ talked
  if p_result = 'talked' then
    v_missing := public.fn_lead_missing_fields(l);
    if nullif(trim(coalesce(l.objection, '')), '') is null then v_missing := array_append(v_missing, 'objection'); end if;
    if nullif(trim(coalesce(l.competitor, '')), '') is null then v_missing := array_append(v_missing, 'competitor'); end if;
    if cardinality(v_missing) > 0 then
      raise exception 'missing_fields:%', array_to_string(v_missing, ',') using errcode = '23514';
    end if;

    v_target := coalesce(nullif(p_payload->>'stage', ''), 'contacted');
    if v_target not in ('contacted', 'interested', 'offer', 'contract', 'waiting', 'lost') then
      raise exception 'bad_stage' using errcode = '22023';
    end if;
    if v_target not in ('waiting', 'lost')
       and public.fn_lead_stage_rank(v_target) < public.fn_lead_stage_rank(l.stage) then
      v_target := l.stage;
    end if;
    if v_target = 'offer' and coalesce(nullif(trim(l.product_fit), ''), '') = '' then
      raise exception 'missing_fields:product_fit' using errcode = '23514';
    end if;

    -- the call finished: this is the answer
    update public.leads
       set answered_at = coalesce(answered_at, v_now),
           answered_by = coalesce(answered_by, v_uid),
           answer_kind = coalesce(answer_kind, 'call'),
           attempt_no = 0, ladder_state = case when ladder_state = 'running' then 'stopped' else ladder_state end,
           next_attempt_at = null
     where id = p_lead_id;
    if v_first_answer then
      perform public.fn_lead_log(p_lead_id, 'answered', v_uid, jsonb_build_object('kind', 'call',
        'seconds', extract(epoch from (v_now - coalesce(l.first_contact_at, l.created_at)))::integer));
    end if;
    perform public.fn_lead_clear_timer(p_lead_id);

    if v_target = 'waiting' then
      perform public.fn_lead_wait(p_lead_id, nullif(p_payload->>'wait_until', '')::date, p_payload->>'wait_reason', v_uid);
    elsif v_target = 'lost' then
      perform public.fn_lead_lose(p_lead_id, p_payload->>'lost_reason', p_payload->>'lost_competitor', v_note, v_uid);
    else
      v_kind := coalesce(nullif(p_payload->>'next_action_kind', ''), 'callback');
      v_at := nullif(p_payload->>'next_action_at', '')::timestamptz;
      if v_kind = 'followup' then
        v_at := coalesce(v_at, v_now + interval '24 hours');
      elsif v_at is null then
        raise exception 'next_action_required' using errcode = '23514';
      end if;
      update public.leads
         set stage = v_target,
             next_action_at = v_at, next_action_kind = v_kind, next_action_note = v_note,
             contract_date = case when v_target = 'contract' and contract_date is null
                                  then (v_now at time zone 'Asia/Tashkent')::date else contract_date end
       where id = p_lead_id;
      if v_kind = 'callback' then
        perform public.fn_lead_set_timer(p_lead_id, 'callback', v_at - interval '10 minutes', v_at);
      end if;
    end if;
    v_result := jsonb_build_object('ok', true, 'result', 'talked', 'stage', v_target);

  ------------------------------------------------------------- no_answer
  elsif p_result = 'no_answer' then
    v_attempt := l.attempt_no + 1;
    update public.leads set attempt_no = v_attempt where id = p_lead_id;

    if v_attempt >= coalesce(jsonb_array_length(public.fn_lead_setting('ladder')->'steps'), 4) + 1
       or (l.first_contact_at is not null and v_now - l.first_contact_at > make_interval(days => v_window)
           and v_attempt >= 3) then
      -- 5 attempts and nobody picked up: "aloqa yo'q" (spec §4.2)
      update public.leads set ladder_state = 'exhausted' where id = p_lead_id;
      perform public.fn_lead_lose(p_lead_id, 'no_contact', null, 'Avtomatik: 5 urinish, javob yo''q', v_uid);
      v_result := jsonb_build_object('ok', true, 'result', 'no_answer', 'attempt_no', v_attempt, 'lost', true);
    else
      v_next := public.fn_lead_ladder_next(v_attempt, v_now);
      update public.leads
         set ladder_state = 'running', next_attempt_at = v_next
       where id = p_lead_id;

      -- A first / reply timer with a chat channel stays until the operator has
      -- written in the chat (spec §1.4); the ladder takes over after that.
      v_keep_timer := v_has_chat and l.timer_kind in ('first', 'reply') and l.due_at is not null;
      if not v_keep_timer then
        if l.answered_at is null then
          update public.leads
             set answered_at = v_now, answered_by = v_uid, answer_kind = 'call_attempt'
           where id = p_lead_id;
          perform public.fn_lead_log(p_lead_id, 'answered', v_uid, jsonb_build_object('kind', 'call_attempt',
            'seconds', extract(epoch from (v_now - coalesce(l.first_contact_at, l.created_at)))::integer));
        end if;
        perform public.fn_lead_arm_ladder(p_lead_id);
      end if;
      perform public.fn_lead_log(p_lead_id, 'ladder', v_uid,
        jsonb_build_object('attempt', v_attempt, 'next', v_next));

      -- from attempt 2 on, a "we called" message is ready as a draft
      if v_attempt >= v_dm_after and v_has_chat then
        select t into v_tpl from jsonb_array_elements(public.fn_lead_setting('templates')) t where t->>'key' = 'called';
        insert into public.lead_drafts (lead_id, kind, channel, text, due_at, dedupe_key)
        values (p_lead_id, 'ladder_dm',
                case when l.source in ('instagram', 'telegram') then l.source else null end,
                public.fn_lead_fill_template(coalesce(v_tpl->>v_lang, v_tpl->>'uz', ''), l),
                v_now, 'ladder_dm:' || p_lead_id || ':' || v_attempt)
        on conflict do nothing;
      end if;
      v_result := jsonb_build_object('ok', true, 'result', 'no_answer', 'attempt_no', v_attempt,
        'next_attempt_at', v_next, 'chat_prompt', v_keep_timer, 'chat_available', v_has_chat);
    end if;

  ------------------------------------------------------------------ busy
  elsif p_result = 'busy' then
    v_at := nullif(p_payload->>'next_action_at', '')::timestamptz;
    if v_at is null then
      raise exception 'next_action_required' using errcode = '23514';
    end if;
    if l.answered_at is null then
      update public.leads set answered_at = v_now, answered_by = v_uid, answer_kind = 'call_attempt'
       where id = p_lead_id;
      perform public.fn_lead_log(p_lead_id, 'answered', v_uid, jsonb_build_object('kind', 'call_attempt',
        'seconds', extract(epoch from (v_now - coalesce(l.first_contact_at, l.created_at)))::integer));
    end if;
    update public.leads
       set next_action_at = v_at, next_action_kind = 'callback', next_action_note = v_note,
           ladder_state = case when ladder_state = 'running' then 'stopped' else ladder_state end,
           next_attempt_at = null
     where id = p_lead_id;
    perform public.fn_lead_set_timer(p_lead_id, 'callback', v_at - interval '10 minutes', v_at);
    v_result := jsonb_build_object('ok', true, 'result', 'busy', 'next_action_at', v_at);

  ---------------------------------------------------------- wrong_number
  else
    update public.leads set phone = null, qualified = false where id = p_lead_id;
    perform public.fn_lead_log(p_lead_id, 'field', v_uid,
      jsonb_build_object('keys', jsonb_build_array('phone'), 'wrong_number', l.phone));
    if v_has_chat then
      -- stays on the desk as a phone-less lead; the chat message answers it
      v_result := jsonb_build_object('ok', true, 'result', 'wrong_number', 'chat_prompt', true, 'template', 'confirm_phone');
    else
      perform public.fn_lead_lose(p_lead_id, 'no_contact', null, 'Nomer xato, chat yo''q', v_uid);
      v_result := jsonb_build_object('ok', true, 'result', 'wrong_number', 'lost', true);
    end if;
  end if;

  return v_result;
end;
$$;

-- Manual stage moves (the card's buttons): Qiziqdi / Taklif / Shartnoma.
create or replace function public.lead_set_stage(p_lead_id uuid, p_stage text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  if p_stage not in ('contacted', 'interested', 'offer', 'contract') then
    raise exception 'bad_stage' using errcode = '22023';
  end if;
  if l.stage in ('student', 'lost') then
    raise exception 'use_reopen' using errcode = '23514';
  end if;
  if p_payload ? 'product_fit' then
    perform public.fn_lead_apply_fields(p_lead_id, jsonb_build_object('product_fit', p_payload->'product_fit'));
    select * into l from public.leads where id = p_lead_id;
  end if;
  if p_stage = 'interested' and cardinality(public.fn_lead_missing_fields(l)) > 0 then
    raise exception 'missing_fields:%', array_to_string(public.fn_lead_missing_fields(l), ',') using errcode = '23514';
  end if;
  if p_stage = 'offer' and coalesce(nullif(trim(l.product_fit), ''), '') = '' then
    raise exception 'missing_fields:product_fit' using errcode = '23514';
  end if;
  update public.leads
     set stage = p_stage,
         owner_id = coalesce(owner_id, auth.uid()),
         contract_date = case when p_stage = 'contract' and contract_date is null
                              then (now() at time zone 'Asia/Tashkent')::date else contract_date end,
         wait_until = null, wait_reason = null
   where id = p_lead_id;
end;
$$;

create or replace function public.lead_wait(p_lead_id uuid, p_until date, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  if l.answered_at is null then
    raise exception 'not_answered_yet' using errcode = '23514';
  end if;
  perform public.fn_lead_wait(p_lead_id, p_until, p_reason, auth.uid());
end;
$$;

create or replace function public.lead_lose(p_lead_id uuid, p_reason text, p_competitor text default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  perform public.fn_lead_lose(p_lead_id, p_reason, p_competitor, p_note, auth.uid());
end;
$$;

-- Qayta ochish: a lost lead goes back to Aloqada, in the pool.
create or replace function public.lead_reopen(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  if l.stage <> 'lost' then
    raise exception 'not_lost' using errcode = '23514';
  end if;
  update public.leads
     set stage = 'contacted', reactivation_queue = null,
         next_action_at = now(), next_action_kind = 'task', next_action_note = 'Qayta ochildi'
   where id = p_lead_id;
  update public.reactivation_queues set status = 'cancelled'
   where lead_id = p_lead_id and status in ('waiting', 'ready');
  perform public.fn_lead_log(p_lead_id, 'reopen', auth.uid(), jsonb_build_object('lost_reason', l.lost_reason));
end;
$$;

-- "Olish": take a lead from the pool, or take over a breached one.
create or replace function public.lead_claim(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  if l.owner_id is not null and l.owner_id <> auth.uid() then
    if not (public.fn_lead_is_senior() or (l.due_at is not null and l.due_at <= now())) then
      raise exception 'owned_by_other' using errcode = '42501';
    end if;
  end if;
  update public.leads set owner_id = auth.uid() where id = p_lead_id;
  perform public.fn_lead_log(p_lead_id, 'claim', auth.uid(), jsonb_build_object('from', l.owner_id));
end;
$$;

create or replace function public.lead_reassign(p_lead_id uuid, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  if not public.fn_lead_is_senior() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.leads set owner_id = p_owner where id = p_lead_id;
  perform public.fn_lead_log(p_lead_id, 'reassign', auth.uid(), jsonb_build_object('from', l.owner_id, 'to', p_owner));
end;
$$;

create or replace function public.lead_pin(p_lead_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
begin
  l := public.fn_lead_guard(p_lead_id);
  if not public.fn_lead_is_senior() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.leads
     set pinned_at = case when p_pinned then now() else null end,
         pinned_by = case when p_pinned then auth.uid() else null end
   where id = p_lead_id;
  perform public.fn_lead_log(p_lead_id, 'pin', auth.uid(), jsonb_build_object('pinned', p_pinned));
end;
$$;

-- Promises: discount / special terms need the boss (spec §11).
create or replace function public.lead_request_promise(p_lead_id uuid, p_kind text, p_text text, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  l public.leads;
  v_id uuid;
begin
  l := public.fn_lead_guard(p_lead_id);
  if coalesce(trim(p_text), '') = '' then
    raise exception 'text_required' using errcode = '23514';
  end if;
  insert into public.lead_promises (lead_id, operator_id, kind, text, reason)
  values (p_lead_id, auth.uid(), coalesce(p_kind, 'discount'), trim(p_text), nullif(trim(coalesce(p_reason, '')), ''))
  returning id into v_id;
  perform public.fn_lead_log(p_lead_id, 'promise', auth.uid(), jsonb_build_object('status', 'pending', 'text', p_text));
  perform public.fn_lead_enqueue_alert(p_lead_id, 'promise', 'boss', jsonb_build_object(
    'promise_id', v_id, 'name', l.full_name, 'kind', p_kind, 'text', p_text, 'reason', p_reason, 'operator_id', auth.uid()));
  return v_id;
end;
$$;

create or replace function public.lead_decide_promise(p_promise_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_lead uuid;
begin
  if auth.uid() is null or not public.fn_lead_is_boss() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.lead_promises
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_promise_id and status = 'pending'
   returning lead_id into v_lead;
  if v_lead is null then
    raise exception 'promise_not_pending' using errcode = 'P0002';
  end if;
  perform public.fn_lead_log(v_lead, 'promise', auth.uid(),
    jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end, 'promise_id', p_promise_id));
end;
$$;

-- Start a reactivation queue: every waiting row becomes eligible now.
create or replace function public.lead_start_queue(p_queue_key text)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  n integer;
begin
  if auth.uid() is null or not public.fn_lead_is_senior() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_queue_key = 'no_risk'
     and not coalesce((public.fn_lead_setting('no_risk_announced') #>> '{}')::boolean, false) then
    raise exception 'queue_not_announced' using errcode = '23514';
  end if;
  update public.reactivation_queues
     set status = 'ready', due_at = coalesce(due_at, now())
   where queue_key = p_queue_key and status = 'waiting';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Merge suggestions (the card's "Bu odam bo'lishi mumkin").
create or replace function public.lead_merge_confirm(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s public.lead_merge_suggestions;
  a public.leads;
  b public.leads;
begin
  s := (select x from public.lead_merge_suggestions x where x.id = p_suggestion_id and x.status = 'pending');
  if s.id is null then
    raise exception 'suggestion_not_pending' using errcode = 'P0002';
  end if;
  a := public.fn_lead_guard(s.lead_id);
  b := public.fn_lead_guard(s.other_id);
  if a.created_at <= b.created_at then
    perform public.fn_lead_merge(a.id, b.id, auth.uid());
  else
    perform public.fn_lead_merge(b.id, a.id, auth.uid());
  end if;
end;
$$;

create or replace function public.lead_merge_dismiss(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or not public.fn_lead_is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.lead_merge_suggestions set status = 'dismissed' where id = p_suggestion_id and status = 'pending';
end;
$$;

-- "+ Lid": a lead typed in by hand (office visit, referral).
create or replace function public.lead_create_manual(
  p_name text, p_phone text, p_origin text default 'office',
  p_referral_type text default null, p_referral_name text default null, p_fields jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.fn_lead_is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name_required' using errcode = '23514';
  end if;
  if public.fn_lead_phone_key(p_phone) is null then
    raise exception 'phone_required' using errcode = '23514';
  end if;
  if p_origin = 'referral' and (p_referral_type is null or coalesce(trim(p_referral_name), '') = '') then
    raise exception 'referral_required' using errcode = '23514';
  end if;

  insert into public.leads (full_name, phone, source, status, created_by, contact_channel, how_heard,
                            referral_type, referral_name)
  values (trim(p_name), trim(p_phone), 'manual', 'new', auth.uid(),
          case when p_origin = 'referral' then 'Telefon' else 'Ofisga keldi' end,
          case when p_origin = 'referral' then 'Do''sti / tanishi tavsiyasi' else null end,
          case when p_origin = 'referral' then p_referral_type end,
          case when p_origin = 'referral' then nullif(trim(p_referral_name), '') end)
  returning id into v_id;

  if p_fields is not null and p_fields <> '{}'::jsonb then
    perform public.fn_lead_apply_fields(v_id, p_fields);
  end if;
  return v_id;
end;
$$;

-- Answer a comment in public (spec §3.2): stops the lead's timer. The reply
-- itself is posted by the instagram-send edge function; this records it.
create or replace function public.lead_comment_answer(p_comment_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  c public.social_comments;
  v_lead uuid;
  v_into uuid;
  l public.leads;
begin
  if auth.uid() is null or not public.fn_lead_is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into c from public.social_comments where id = p_comment_id for update;
  if c.id is null then
    raise exception 'comment_not_found' using errcode = 'P0002';
  end if;
  update public.social_comments
     set replied_at = coalesce(replied_at, now()), replied_by = coalesce(replied_by, auth.uid()),
         reply_text = coalesce(nullif(trim(coalesce(p_reply, '')), ''), reply_text)
   where id = c.id;

  v_lead := c.lead_id;
  loop  -- follow merges
    select merged_into_id into v_into from public.leads where id = v_lead;
    exit when v_into is null;
    v_lead := v_into;
  end loop;
  if v_lead is null then return; end if;

  select * into l from public.leads where id = v_lead for update;
  if l.stage = 'student' then return; end if;
  update public.leads
     set answered_at = coalesce(answered_at, now()),
         answered_by = coalesce(answered_by, auth.uid()),
         answer_kind = coalesce(answer_kind, 'comment'),
         owner_id = coalesce(owner_id, auth.uid()),
         stage = case when stage = 'new' then 'contacted' else stage end
   where id = v_lead;
  if l.timer_kind in ('first', 'reply') then
    perform public.fn_lead_clear_timer(v_lead);
  end if;
  perform public.fn_lead_log(v_lead, 'comment', auth.uid(), jsonb_build_object('comment_id', c.id));
end;
$$;

-- AI field suggestions (spec §10 "Maydon takliflari"). The existing
-- accept_lead_suggestion (20260922120000) only knows the old field list and
-- silently ignores cert_level / decider / study_year ... — these two do the
-- same job through the v2 field whitelist, check the role and the lead's
-- visibility, and also work for lead_senior.
create or replace function public.lead_apply_suggestion(p_suggestion_id uuid, p_value text default null)
returns public.lead_field_suggestions
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s public.lead_field_suggestions;
  l public.leads;
  v_value text;
  v_edited boolean;
begin
  select * into s from public.lead_field_suggestions where id = p_suggestion_id for update;
  if s.id is null then
    raise exception 'suggestion_not_found' using errcode = 'P0002';
  end if;
  l := public.fn_lead_guard(s.lead_id);

  v_value := coalesce(nullif(btrim(p_value), ''), s.suggested_value);
  v_edited := v_value is distinct from s.suggested_value;

  if s.field = 'summary' then
    update public.leads set ai_summary = v_value where id = s.lead_id;
  elsif s.field = 'age' and v_value !~ '^[0-9]{1,3}$' then
    null; -- not a number: nothing to apply
  elsif s.field in ('full_name', 'email', 'birth_date', 'education_level', 'cert_level', 'age', 'study_year', 'city',
                    'decider', 'language', 'preferred_channel', 'preferred_time_text', 'exam_date', 'exam_type',
                    'budget_range', 'target_intake', 'referral_type', 'referral_name', 'objection', 'competitor',
                    'product_fit', 'how_heard', 'source_note') then
    perform public.fn_lead_apply_fields(s.lead_id, jsonb_build_object(s.field, v_value));
  end if;

  update public.lead_field_suggestions
     set status = case when v_edited then 'corrected' else 'accepted' end,
         corrected_value = case when v_edited then v_value else null end,
         decided_by = auth.uid(), decided_at = now(), updated_at = now()
   where id = p_suggestion_id
  returning * into s;
  return s;
end;
$$;

create or replace function public.lead_reject_suggestion(p_suggestion_id uuid)
returns public.lead_field_suggestions
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s public.lead_field_suggestions;
  l public.leads;
begin
  select * into s from public.lead_field_suggestions where id = p_suggestion_id for update;
  if s.id is null then
    raise exception 'suggestion_not_found' using errcode = 'P0002';
  end if;
  l := public.fn_lead_guard(s.lead_id);
  update public.lead_field_suggestions
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
   where id = p_suggestion_id
  returning * into s;
  return s;
end;
$$;

-- lead_senior reads (and decides on) the AI suggestions like the other staff.
do $$
begin
  if to_regclass('public.lead_field_suggestions') is not null then
    drop policy if exists lfs_senior_read on public.lead_field_suggestions;
    create policy lfs_senior_read on public.lead_field_suggestions for select to authenticated
      using (public.fn_lead_has_any_role(array['lead_senior']));
  end if;
end $$;

-- Service-role entry for webhooks: this person wrote / filled a form again.
create or replace function public.lead_reengage(p_lead_id uuid, p_at timestamptz default now())
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$ select public.fn_lead_reengage(p_lead_id, p_at) $$;

----------------------------------------------------------------------
-- 9. Reading: desk, counters, timeline
----------------------------------------------------------------------

-- The desk (spec §3.1): one row per lead that has something to do, with its
-- block. Runs with the caller's rights, so the pool/own rule is RLS's job.
create or replace function public.lead_desk()
returns table (
  id uuid, full_name text, phone text, source text, contact_channel text, channels text[],
  handle text, campaign_name text, form_name text, ad_name text,
  stage text, owner_id uuid, crm_generation text,
  timer_kind text, timer_start_at timestamptz, due_at timestamptz,
  next_action_at timestamptz, next_action_kind text, next_action_note text,
  attempt_no integer, ladder_state text,
  last_client_msg_at timestamptz, priority_score integer, pinned boolean,
  missing integer, pending_drafts integer, referral boolean, ai_summary text,
  bucket text, sort_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with t as (select (now() at time zone 'Asia/Tashkent')::date as today),
  base as (
    select l.*,
           cardinality(public.fn_lead_missing_fields(l))::integer as missing_n,
           (select count(*) from public.lead_drafts d
             where d.lead_id = l.id and d.status = 'pending' and d.due_at <= now() + interval '1 day')::integer as drafts,
           (select min(d.due_at) from public.lead_drafts d where d.lead_id = l.id and d.status = 'pending') as draft_at
      from public.leads l
     where l.merged_into_id is null
       and l.stage <> 'student'
       and l.matched_student_id is null
  )
  select b.id, b.full_name, b.phone, b.source, b.contact_channel,
         array(select distinct ci.channel from public.communication_identities ci where ci.lead_id = b.id) as channels,
         coalesce(nullif(b.instagram_handle, ''), nullif(b.telegram_handle, '')) as handle,
         b.campaign_name, b.form_name, b.ad_name,
         b.stage, b.owner_id, b.crm_generation,
         b.timer_kind, b.timer_start_at, b.due_at,
         b.next_action_at, b.next_action_kind, b.next_action_note,
         b.attempt_no, b.ladder_state,
         b.last_client_msg_at, b.priority_score, (b.pinned_at is not null),
         b.missing_n,
         b.drafts,
         (b.referral_type is not null or b.referred_by_student_id is not null),
         left(b.ai_summary, 400),
         x.bucket, x.sort_at
    from base b
    cross join t
    cross join lateral (
      select case
        when b.due_at is not null and b.timer_start_at <= now() then 'hozir'
        when b.due_at is not null and (b.timer_start_at at time zone 'Asia/Tashkent')::date <= t.today then 'bugun'
        when b.due_at is not null then 'keyin'
        when b.next_action_at is not null and (b.next_action_at at time zone 'Asia/Tashkent')::date <= t.today then 'bugun'
        when b.drafts > 0 then 'bugun'
        when b.stage = 'contract' then 'bugun'
        when b.stage = 'offer' and coalesce(b.stage_changed_at, b.updated_at) < now() - interval '3 days'
             and (b.last_client_msg_at is null or b.last_client_msg_at < b.stage_changed_at) then 'bugun'
        when b.next_action_at is not null then 'keyin'
        else null end as bucket,
      case
        when b.due_at is not null and b.timer_start_at <= now() then b.due_at
        when b.due_at is not null then b.timer_start_at
        when b.next_action_at is not null then b.next_action_at
        when b.drafts > 0 then b.draft_at
        else coalesce(b.stage_changed_at, b.updated_at)
      end as sort_at
    ) x
   where x.bucket is not null
   order by case x.bucket when 'hozir' then 0 when 'bugun' then 1 else 2 end,
            case when x.bucket = 'hozir' then x.sort_at end asc nulls last,
            case when x.bucket <> 'hozir' and b.pinned_at is not null then 0 else 1 end,
            case when x.bucket = 'bugun' then x.sort_at end asc nulls last,
            case when x.bucket = 'bugun' then b.priority_score end desc nulls last,
            case when x.bucket = 'keyin' then x.sort_at end asc nulls last
$$;

-- Sidebar badges and the desk header.
create or replace function public.lead_desk_counts()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'hozir', (select count(*) from public.leads l
               where l.merged_into_id is null and l.due_at is not null and l.timer_start_at <= now() and l.stage <> 'student'
                 and l.matched_student_id is null),
    'breached', (select count(*) from public.leads l
                  where l.merged_into_id is null and l.due_at is not null and l.due_at <= now() and l.timer_start_at <= now()
                    and l.stage <> 'student' and l.matched_student_id is null),
    'barcha', (select count(*) from public.leads l
                where l.merged_into_id is null and l.stage not in ('student', 'lost') and l.first_contact_at is not null),
    'yoqotilgan', (select count(*) from public.reactivation_queues q where q.status in ('waiting', 'ready')),
    'baza', (select count(*) from public.leads l where l.merged_into_id is null and l.crm_generation = 'old'),
    'comments', (select count(*) from public.social_comments c where c.replied_at is null)
  )
$$;

-- One stream for the whole conversation: every channel, our calls, and what
-- happened to the lead (spec §6 "Vaqt chizig'i").
create or replace function public.lead_timeline_v2(p_lead_id uuid, p_limit integer default 300)
returns table (at timestamptz, kind text, channel text, direction text, body text, actor_id uuid, meta jsonb)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with ids as (
    select l.id from public.leads l where l.id = p_lead_id or l.merged_into_id = p_lead_id
  ),
  idn as (
    select ci.channel, ci.identifier
      from public.communication_identities ci
     where ci.lead_id in (select id from ids) and ci.channel in ('telegram', 'instagram', 'facebook')
    union
    select l.source, l.source_id
      from public.leads l
     where l.id in (select id from ids) and l.source in ('instagram', 'telegram', 'facebook') and l.source_id is not null
  )
  select m.created_at,
         case when m.direction = 'incoming' then 'message_in' else 'message_out' end,
         m.source::text, m.direction::text, m.content, m.replied_by,
         jsonb_build_object('id', m.id, 'message_type', m.message_type, 'delivery_status', m.delivery_status,
                            'internal', m.metadata->>'internal')
    from public.messages m
    join idn on idn.channel = m.source and idn.identifier = m.sender_id
  union all
  select ca.started_at, 'call', 'phone', 'outgoing', ca.note, ca.operator_id,
         jsonb_build_object('result', ca.result, 'attempt_no', ca.attempt_no, 'duration', ca.duration_seconds)
    from public.call_attempts ca where ca.lead_id in (select id from ids)
  union all
  select e.at, 'event', null, null, null, e.actor_id, jsonb_build_object('kind', e.kind) || e.payload
    from public.lead_events e
   where e.lead_id in (select id from ids)
     and e.kind in ('stage', 'wait', 'lost', 'promise', 'merge', 'claim', 'reassign', 'reactivation', 'reopen',
                    'student_match', 'ladder', 'escalation')
  union all
  select c.created_at, 'comment', c.platform, 'incoming', c.text, null,
         jsonb_build_object('post', c.post_label, 'replied_at', c.replied_at, 'reply', c.reply_text)
    from public.social_comments c where c.lead_id in (select id from ids)
  order by 1 desc
  limit greatest(1, least(p_limit, 1000))
$$;

----------------------------------------------------------------------
-- 10. Report (spec §14) — results only
----------------------------------------------------------------------

create or replace function public.fn_lead_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_from timestamptz := (p_from + time '00:00') at time zone 'Asia/Tashkent';
  v_to timestamptz := ((p_to + 1) + time '00:00') at time zone 'Asia/Tashkent';
  v_out jsonb;
begin
  with
  new_leads as (
    select l.* from public.leads l
     where l.merged_into_id is null and l.first_contact_at >= v_from and l.first_contact_at < v_to
  ),
  stage_ev as (
    select e.lead_id, e.at, e.actor_id, e.payload->>'to' as to_stage
      from public.lead_events e
     where e.kind = 'stage' and e.at >= v_from and e.at < v_to
  ),
  talked as (
    select distinct ca.lead_id from public.call_attempts ca
     where ca.result = 'talked' and ca.started_at >= v_from and ca.started_at < v_to
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'totals', jsonb_build_object(
      'leads', (select count(*) from new_leads),
      'answered', (select count(*) from new_leads where answered_at is not null),
      'answered_in_10', (select count(*) from new_leads where answered_at is not null and first_due_at is not null and answered_at <= first_due_at),
      'talked', (select count(*) from talked),
      'offers', (select count(distinct lead_id) from stage_ev where to_stage = 'offer'),
      'contracts_sent', (select count(distinct lead_id) from stage_ev where to_stage = 'contract'),
      'students', (select count(distinct lead_id) from stage_ev where to_stage = 'student')
    ),
    'by_source', (select coalesce(jsonb_agg(row_to_json(s) order by s.leads desc), '[]'::jsonb) from (
      select coalesce(nl.source, '—') as source,
             count(*) as leads,
             count(*) filter (where nl.answered_at is not null) as answered,
             count(*) filter (where nl.id in (select lead_id from talked)) as talked,
             count(*) filter (where nl.id in (select lead_id from stage_ev where to_stage = 'offer')) as offers,
             count(*) filter (where nl.id in (select lead_id from stage_ev where to_stage = 'student')) as students
        from new_leads nl group by 1) s),
    'by_ad', (select coalesce(jsonb_agg(row_to_json(a) order by a.leads desc), '[]'::jsonb) from (
      select coalesce(nl.ad_name, nl.form_name, nl.campaign_name, '—') as ad,
             count(*) as leads,
             count(*) filter (where nl.id in (select lead_id from stage_ev where to_stage = 'student')) as students
        from new_leads nl where nl.campaign_name is not null or nl.form_name is not null or nl.ad_name is not null
       group by 1) a),
    'by_operator', (select coalesce(jsonb_agg(row_to_json(o) order by o.students desc), '[]'::jsonb) from (
      select se.actor_id as operator_id, count(distinct se.lead_id) as students
        from stage_ev se where se.to_stage = 'student' and se.actor_id is not null group by 1) o),
    'lost', (select coalesce(jsonb_agg(row_to_json(x) order by x.n desc), '[]'::jsonb) from (
      select l.lost_reason as reason, count(*) as n
        from public.leads l
       where l.merged_into_id is null and l.stage = 'lost' and l.lost_at >= v_from and l.lost_at < v_to
       group by 1) x),
    'generation', (select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb) from (
      select l.crm_generation as generation,
             count(*) as leads,
             count(*) filter (where l.answered_at is not null or l.last_contacted_at is not null or l.call_result is not null) as answered,
             count(*) filter (where l.stage = 'student') as students
        from public.leads l
       where l.merged_into_id is null and l.created_at >= v_from and l.created_at < v_to
       group by 1) g)
  ) into v_out;
  return v_out;
end;
$$;

create or replace function public.lead_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null or not public.fn_lead_is_senior() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return public.fn_lead_report(p_from, p_to);
end;
$$;

----------------------------------------------------------------------
-- 11. Grants
----------------------------------------------------------------------

-- Internal functions: only the database itself (triggers, definers) and the
-- service role call them.
do $$
declare
  f text;
begin
  foreach f in array array[
    'fn_lead_log(uuid,text,uuid,jsonb)',
    'fn_lead_enqueue_alert(uuid,text,text,jsonb)',
    'fn_lead_set_timer(uuid,text,timestamptz,timestamptz)',
    'fn_lead_clear_timer(uuid)',
    'fn_lead_arm_ladder(uuid)',
    'fn_lead_reengage(uuid,timestamptz)',
    'fn_lead_enqueue_reactivation(uuid,text)',
    'fn_lead_lose(uuid,text,text,text,uuid)',
    'fn_lead_wait(uuid,date,text,uuid)',
    'fn_lead_merge(uuid,uuid,uuid)',
    'fn_lead_try_merge(uuid)',
    'fn_lead_check_student(uuid)',
    'fn_lead_timer_scan(timestamptz)',
    'fn_lead_apply_fields(uuid,jsonb)',
    'fn_lead_guard(uuid)',
    'fn_lead_report(date,date)',
    'lead_reengage(uuid,timestamptz)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;

  -- The browser's RPCs: signed-in users only (each checks the role itself).
  foreach f in array array[
    'lead_save_fields(uuid,jsonb)',
    'lead_record_call(uuid,text,jsonb)',
    'lead_set_stage(uuid,text,jsonb)',
    'lead_wait(uuid,date,text)',
    'lead_lose(uuid,text,text,text)',
    'lead_reopen(uuid)',
    'lead_claim(uuid)',
    'lead_reassign(uuid,uuid)',
    'lead_pin(uuid,boolean)',
    'lead_request_promise(uuid,text,text,text)',
    'lead_decide_promise(uuid,boolean)',
    'lead_start_queue(text)',
    'lead_merge_confirm(uuid)',
    'lead_merge_dismiss(uuid)',
    'lead_create_manual(text,text,text,text,text,jsonb)',
    'lead_comment_answer(uuid,text)',
    'lead_apply_suggestion(uuid,text)',
    'lead_reject_suggestion(uuid)',
    'lead_desk()',
    'lead_desk_counts()',
    'lead_timeline_v2(uuid,integer)',
    'lead_report(date,date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;
