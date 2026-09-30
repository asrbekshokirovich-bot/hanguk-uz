-- Two watchdogs on "Yangi lid", so that a silent failure like the Instagram
-- template echo (20260930120000_ignore_instagram_template_echo.sql) is seen in
-- minutes, not the next day. Both go only to the owner's own Telegram
-- (lead_alert_recipients.watchdog), sent by lead-sla-check.
--
-- 1. Suspicious quick exit: a new lead marked answered (last_contacted_at)
--    within 30 seconds of arriving was almost certainly closed by an automatic
--    message, not by a person. One alert per lead, with the message that
--    closed it, so a genuinely fast staff reply is easy to tell apart.
-- 2. Daily report at 09:30 Tashkent for the day before (00:00–24:00): how many
--    new leads came, how many were answered, how many are still unanswered.

alter table public.lead_alert_recipients
  add column if not exists watchdog boolean not null default false;

update public.lead_alert_recipients
   set watchdog = true
 where chat_id = '1580805284';

alter table public.leads
  add column if not exists quick_contact_alerted_at timestamptz;

-- 1. Each new lead that left "Yangi lid" within 30 seconds, handed out once
-- (stamped here), with the outgoing message that took it out.
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

-- 2. One report a day. The row for today is taken here, so the report goes
-- out once even if runs overlap or the function is called by hand.
create table if not exists public.lead_daily_reports (
  report_day date primary key,
  sent_at    timestamptz not null default now()
);

alter table public.lead_daily_reports enable row level security;
revoke all on table public.lead_daily_reports from anon, authenticated;

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
    and l.new_lead_at < v_to;
end;
$function$;

revoke all on function public.fn_lead_quick_contact_scan(boolean) from public, anon, authenticated;
grant execute on function public.fn_lead_quick_contact_scan(boolean) to service_role;
revoke all on function public.fn_lead_daily_report_claim(boolean) from public, anon, authenticated;
grant execute on function public.fn_lead_daily_report_claim(boolean) to service_role;
