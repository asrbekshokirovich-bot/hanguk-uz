-- "Yangi lid" outside working hours.
--
-- The owner's rule (2026-09-29): working hours are Monday–Saturday
-- 09:40–18:00, Tashkent time; all of Sunday and every evening from 18:00 to
-- 09:40 are off. A new chat that arrives off hours:
--
--   1. gets one automatic reply (fn_after_hours_reply_text), sent by
--      lead-sla-check within a minute, on the channel the person wrote on —
--      "today at 10:00" before 09:40, "tomorrow at 10:00" on a weekday evening,
--      "Monday at 10:00" on Saturday evening and all of Sunday;
--   2. still shows in "Yangi lid" at once, but its 10-minute countdown starts
--      at 10:00 of the next working morning (Saturday evening and Sunday ->
--      Monday 10:00), and no alert goes out before that;
--   3. stays in "Yangi lid" after the automatic reply — only a real answer
--      (or an ALOQA result) takes it out, at night as by day.
--
-- Working hours change nothing: the countdown starts at the first message.
--
--   leads.sla_start_at               when the countdown starts
--   leads.after_hours_reply_sent_at  the automatic reply was claimed / sent

alter table public.leads
  add column if not exists sla_start_at timestamptz,
  add column if not exists after_hours_reply_sent_at timestamptz;

-- The three automatic replies, in the owner's words: [1] before 09:40,
-- [2] a weekday evening, [3] Saturday evening and Sunday.
create or replace function public.fn_after_hours_reply_texts()
returns text[]
language sql
immutable
as $$
  select array[
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 10:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 10:00–18:00). Operatorlarimiz ertaga soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 10:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!'
  ]::text[]
$$;

-- The reply for a chat that arrived at p_at, or null inside working hours.
create or replace function public.fn_after_hours_reply_text(p_at timestamptz)
returns text
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
  v_dow   integer   := extract(isodow from v_local)::integer; -- 1 = Monday … 7 = Sunday
  v_time  time      := v_local::time;
  v_texts text[]    := public.fn_after_hours_reply_texts();
begin
  if v_dow = 7 or (v_dow = 6 and v_time >= time '18:00') then
    return v_texts[3];
  end if;
  if v_time < time '09:40' then
    return v_texts[1];
  end if;
  if v_time >= time '18:00' then
    return v_texts[2];
  end if;
  return null;
end;
$$;

-- When the countdown for a lead arriving at p_at starts: p_at itself inside
-- working hours, otherwise 10:00 of the next working morning in Tashkent.
create or replace function public.fn_lead_sla_start(p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
  v_dow   integer   := extract(isodow from v_local)::integer; -- 1 = Monday … 7 = Sunday
  v_time  time      := v_local::time;
  v_day   date;
begin
  if v_dow <= 6 and v_time >= time '09:40' and v_time < time '18:00' then
    return p_at;
  end if;

  if v_dow <= 6 and v_time < time '09:40' then
    v_day := v_local::date;
  else
    v_day := v_local::date + 1;
  end if;
  if extract(isodow from v_day) = 7 then
    v_day := v_day + 1;
  end if;

  return (v_day + time '10:00') at time zone 'Asia/Tashkent';
end;
$$;

-- As in 20260924080000_new_lead_is_new_chat.sql, plus the countdown start.
create or replace function public.fn_leads_mark_new_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op <> 'INSERT' or new.new_lead_at is not null then
    return new;
  end if;
  if coalesce(new.source, '') not in ('instagram', 'telegram')
     or coalesce(trim(new.source_id), '') = '' then
    return new;
  end if;

  -- Somebody we have already talked to is not new, whatever their lead row.
  if exists (
    select 1 from public.messages m
     where m.source = new.source
       and m.sender_id = new.source_id
  ) then
    return new;
  end if;

  new.new_lead_at := now();
  new.sla_start_at := public.fn_lead_sla_start(new.new_lead_at);
  return new;
end;
$$;

-- As in 20260924080000_new_lead_is_new_chat.sql, except that the automatic
-- after-hours reply is not an answer: the lead stays in "Yangi lid".
create or replace function public.fn_mark_lead_contacted_on_reply()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lead_id uuid;
begin
  if new.direction <> 'outgoing' or new.source not in ('instagram', 'telegram') then
    return new;
  end if;

  -- The automatic reply (the CRM row, or its echo from Telegram/Instagram).
  if trim(coalesce(new.content, '')) = any (public.fn_after_hours_reply_texts()) then
    return new;
  end if;

  select ci.lead_id into v_lead_id
    from public.communication_identities ci
   where ci.channel = new.source
     and ci.identifier = new.sender_id
     and ci.lead_id is not null
   limit 1;

  if v_lead_id is null then
    select l.id into v_lead_id
      from public.leads l
     where l.source = new.source
       and l.source_id = new.sender_id
     limit 1;
  end if;

  if v_lead_id is null then
    return new;
  end if;

  -- Only a lead still waiting in "Yangi lid"; nothing else is touched.
  update public.leads
     set last_contacted_at = new.created_at,
         updated_at = now()
   where id = v_lead_id
     and new_lead_at is not null
     and last_contacted_at is null
     -- A backfilled reply from before the lead existed is not a reply to it;
     -- the minute of slack covers Telegram's whole-second timestamps.
     and new.created_at >= new_lead_at - interval '1 minute';

  return new;
end;
$$;

-- As in 20260924090000_lead_sla_repeat_every_minute.sql, but timed from the
-- countdown start, so an off-hours lead is not alerted before 10:10.
create or replace function public.fn_lead_sla_scan(p_minutes integer default 10, p_dry boolean default false)
returns table(id uuid, full_name text, phone text, how_heard text, source text, arrived_at timestamp with time zone, minutes_waiting integer)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_dry then
    return query
    select l.id, l.full_name, l.phone, l.how_heard, l.source, l.new_lead_at,
      floor(extract(epoch from (now() - coalesce(l.sla_start_at, l.new_lead_at))) / 60)::integer
    from public.leads l
    where l.new_lead_at is not null
      and l.call_result is null
      and l.last_contacted_at is null
      and l.status not in ('converted', 'lost')
      and l.converted_to_student_id is null
      and (l.sla_alerted_at is null or l.sla_alerted_at <= now() - interval '50 seconds')
      and coalesce(l.sla_start_at, l.new_lead_at) <= now() - make_interval(mins => p_minutes)
    order by l.new_lead_at;
    return;
  end if;

  return query
  update public.leads l
  set sla_alerted_at = now()
  where l.new_lead_at is not null
    and l.call_result is null
    and l.last_contacted_at is null
    and l.status not in ('converted', 'lost')
    and l.converted_to_student_id is null
    and (l.sla_alerted_at is null or l.sla_alerted_at <= now() - interval '50 seconds')
    and coalesce(l.sla_start_at, l.new_lead_at) <= now() - make_interval(mins => p_minutes)
  returning l.id, l.full_name, l.phone, l.how_heard, l.source, l.new_lead_at,
    floor(extract(epoch from (now() - coalesce(l.sla_start_at, l.new_lead_at))) / 60)::integer;
end;
$function$;

-- The off-hours new leads still owed their automatic reply, each handed out
-- once: the stamp is taken here, before sending, so two overlapping runs never
-- send it twice. A lead somebody has already answered is skipped.
create or replace function public.fn_after_hours_reply_claim(p_dry boolean default false)
returns table(id uuid, source text, source_id text, reply_text text)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_dry then
    return query
    select l.id, l.source, l.source_id, public.fn_after_hours_reply_text(l.new_lead_at)
    from public.leads l
    where l.new_lead_at is not null
      and l.sla_start_at > l.new_lead_at
      and l.after_hours_reply_sent_at is null
      and l.new_lead_at > now() - interval '1 day'
      and l.call_result is null
      and l.last_contacted_at is null
      and l.status not in ('converted', 'lost')
      and l.converted_to_student_id is null
      and l.source in ('instagram', 'telegram')
      and coalesce(trim(l.source_id), '') <> ''
      and public.fn_after_hours_reply_text(l.new_lead_at) is not null;
    return;
  end if;

  return query
  update public.leads l
  set after_hours_reply_sent_at = now()
  where l.new_lead_at is not null
    and l.sla_start_at > l.new_lead_at
    and l.after_hours_reply_sent_at is null
    and l.new_lead_at > now() - interval '1 day'
    and l.call_result is null
    and l.last_contacted_at is null
    and l.status not in ('converted', 'lost')
    and l.converted_to_student_id is null
    and l.source in ('instagram', 'telegram')
    and coalesce(trim(l.source_id), '') <> ''
    and public.fn_after_hours_reply_text(l.new_lead_at) is not null
  returning l.id, l.source, l.source_id, public.fn_after_hours_reply_text(l.new_lead_at);
end;
$function$;

revoke all on function public.fn_after_hours_reply_claim(boolean) from public, anon, authenticated;
grant execute on function public.fn_after_hours_reply_claim(boolean) to service_role;
