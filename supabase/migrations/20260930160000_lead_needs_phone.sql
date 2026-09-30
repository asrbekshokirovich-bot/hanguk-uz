-- No phone number, no lead.
--
-- The owner's rule (2026-09-30): a lead without a phone number shows neither
-- in "Lidlar" nor in "Yangi lid". It stays a chat (Xabarlar) until a number
-- arrives. This reverses the "every new chat is a lead, number or no number"
-- part of 20260924080000_new_lead_is_new_chat.sql.
--
--   * leads.qualified (the CRM only loads qualified rows) is now simply "has a
--     phone", for every source and on every change of the phone.
--   * A new chat is remembered in leads.new_chat_at. It becomes a "Yangi lid"
--     (new_lead_at, with its countdown) when the chat has a number: at once if
--     the lead is created with one, otherwise the moment the number arrives
--     (typed in the chat, from the profile, or entered by hand) — unless the
--     chat was already answered by then, in which case it only appears in
--     "Lidlar".
--   * The alert, the quick-exit watchdog and the daily count look only at leads
--     with a phone, like the CRM.
--   * The 27 phoneless leads in "Lidlar" today are hidden (qualified = false);
--     nothing is deleted, and each comes back once it has a number.
--
-- Unchanged: the after-hours automatic reply still goes to every first-time
-- chat (after_hours_reply_queue), with or without a number.

alter table public.leads
  add column if not exists new_chat_at timestamptz;

create or replace function public.fn_leads_mark_new_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_has_phone boolean := coalesce(trim(new.phone), '') <> '';
begin
  if tg_op = 'INSERT' then
    if new.new_lead_at is not null then
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

    new.new_chat_at := now();
    if v_has_phone then
      new.new_lead_at := now();
      new.sla_start_at := public.fn_lead_sla_start(new.new_lead_at);
    end if;
    return new;
  end if;

  -- UPDATE: the number of a new chat has just arrived.
  if new.new_lead_at is null
     and new.new_chat_at is not null
     and new.new_chat_at > now() - interval '7 days'
     and v_has_phone
     and coalesce(trim(old.phone), '') = ''
     and new.call_result is null
     and new.last_contacted_at is null
     and coalesce(new.status, '') not in ('converted', 'lost')
     and new.converted_to_student_id is null
     -- Already answered in the chat: it goes to "Lidlar" only.
     and not exists (
       select 1 from public.messages m
        where m.source = new.source
          and m.sender_id = new.source_id
          and m.direction = 'outgoing'
          and m.created_at >= new.new_chat_at - interval '1 minute'
          and not public.fn_is_automatic_outgoing(m.content, m.metadata)
     ) then
    new.new_lead_at := now();
    new.sla_start_at := public.fn_lead_sla_start(new.new_lead_at);
  end if;
  return new;
end;
$$;

-- A lead is a lead when it has a phone number.
create or replace function public.fn_leads_qualified_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.qualified := coalesce(trim(new.phone), '') <> '';
  return new;
end;
$$;

-- As in 20260929120000_lead_after_hours.sql, plus: only leads with a phone.
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
      and coalesce(trim(l.phone), '') <> ''
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
    and coalesce(trim(l.phone), '') <> ''
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

-- As in 20260930140000_lead_watchdog.sql, plus: only leads with a phone.
create or replace function public.fn_lead_quick_contact_scan(p_dry boolean default false)
returns table(id uuid, full_name text, source text, seconds integer, closed_by text)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_dry then
    return query
    select l.id, l.full_name, l.source,
      extract(epoch from (l.last_contacted_at - l.new_lead_at))::integer,
      (select m.content from public.messages m
        where m.source = l.source and m.sender_id = l.source_id and m.direction = 'outgoing'
          and m.created_at >= l.new_lead_at - interval '1 minute'
          and not public.fn_is_automatic_outgoing(m.content, m.metadata)
        order by m.created_at limit 1)
    from public.leads l
    where l.new_lead_at > now() - interval '1 day'
      and coalesce(trim(l.phone), '') <> ''
      and l.last_contacted_at is not null
      and l.last_contacted_at - l.new_lead_at < interval '30 seconds'
      and l.quick_contact_alerted_at is null;
    return;
  end if;

  return query
  with hit as (
    update public.leads l
       set quick_contact_alerted_at = now()
     where l.new_lead_at > now() - interval '1 day'
       and coalesce(trim(l.phone), '') <> ''
       and l.last_contacted_at is not null
       and l.last_contacted_at - l.new_lead_at < interval '30 seconds'
       and l.quick_contact_alerted_at is null
    returning l.id, l.full_name, l.source, l.source_id, l.new_lead_at, l.last_contacted_at
  )
  select h.id, h.full_name, h.source,
    extract(epoch from (h.last_contacted_at - h.new_lead_at))::integer,
    (select m.content from public.messages m
      where m.source = h.source and m.sender_id = h.source_id and m.direction = 'outgoing'
        and m.created_at >= h.new_lead_at - interval '1 minute'
        and not public.fn_is_automatic_outgoing(m.content, m.metadata)
      order by m.created_at limit 1)
  from hit h;
end;
$function$;

-- As in 20260930140000_lead_watchdog.sql, plus: only leads with a phone.
create or replace function public.fn_lead_daily_report_claim(p_dry boolean default false)
returns table(report_day date, new_leads integer, answered integer, unanswered integer)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_local timestamp := now() at time zone 'Asia/Tashkent';
  v_today date := v_local::date;
  v_day   date := v_local::date - 1;
  v_from  timestamptz := (v_day + time '00:00') at time zone 'Asia/Tashkent';
  v_to    timestamptz := (v_today + time '00:00') at time zone 'Asia/Tashkent';
begin
  if not p_dry then
    if v_local::time < time '09:30' then
      return;
    end if;
    insert into public.lead_daily_reports (report_day) values (v_today)
    on conflict do nothing;
    if not found then
      return;
    end if;
  end if;

  return query
  select v_day,
    count(*)::integer,
    count(*) filter (where l.call_result is not null
                        or l.last_contacted_at is not null
                        or l.status = 'converted'
                        or l.converted_to_student_id is not null)::integer,
    count(*) filter (where l.call_result is null
                       and l.last_contacted_at is null
                       and l.status <> 'converted'
                       and l.converted_to_student_id is null)::integer
  from public.leads l
  where l.new_lead_at >= v_from
    and l.new_lead_at < v_to
    and coalesce(trim(l.phone), '') <> '';
end;
$function$;

-- Hide today's phoneless leads (nothing deleted; a number brings each back).
update public.leads
   set qualified = false
 where qualified = true
   and coalesce(trim(phone), '') = '';
