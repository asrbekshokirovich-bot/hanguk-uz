-- Notice when a brand-new lead sits uncontacted too long.
--
-- A lead that nobody calls in the first few minutes cools fast. Until now the
-- CRM had no idea a lead was waiting at all — the operator had to be looking
-- at the right tab at the right time. This is the watchdog: every lead still
-- uncontacted (no call_result, no last_contacted_at) 10 minutes after it was
-- created gets one Telegram alert to the staff alert channel, and is marked so
-- it never alerts twice.
--
-- The scan is SQL, same split as fn_channel_health_scan: this function decides
-- and marks, the edge function (`lead-sla-check`) owns the bot token and sends.
-- Cron calls it every 2 minutes — tight relative to the hourly channel-health
-- job because the SLA itself is 10 minutes, not a day.

alter table public.leads
  add column if not exists sla_alerted_at timestamptz;

comment on column public.leads.sla_alerted_at is
  'When the "still uncontacted after 10 minutes" Telegram alert was sent for this lead. Null until fired; set once so fn_lead_sla_scan never re-alerts the same lead.';

/**
 * Find leads that just crossed the uncontacted-for-`p_minutes` line and mark
 * them alerted, atomically, so two overlapping cron runs cannot double-send.
 *
 * `p_dry` skips the mark (and the transition) entirely — a plain read of what
 * *would* fire, for the edge function's `?dry=1` and for hand-testing.
 */
create or replace function public.fn_lead_sla_scan(p_minutes integer default 10, p_dry boolean default false)
returns table (
  id uuid,
  full_name text,
  phone text,
  how_heard text,
  source text,
  created_at timestamptz,
  minutes_waiting integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if p_dry then
    return query
    select l.id, l.full_name, l.phone, l.how_heard, l.source, l.created_at,
      floor(extract(epoch from (now() - l.created_at)) / 60)::integer as minutes_waiting
    from public.leads l
    where l.call_result is null
      and l.last_contacted_at is null
      and l.status not in ('converted', 'lost')
      and l.converted_to_student_id is null
      and l.sla_alerted_at is null
      and l.created_at <= now() - make_interval(mins => p_minutes)
    order by l.created_at;
    return;
  end if;

  return query
  update public.leads l
  set sla_alerted_at = now()
  where l.call_result is null
    and l.last_contacted_at is null
    and l.status not in ('converted', 'lost')
    and l.converted_to_student_id is null
    and l.sla_alerted_at is null
    and l.created_at <= now() - make_interval(mins => p_minutes)
  returning l.id, l.full_name, l.phone, l.how_heard, l.source, l.created_at,
    floor(extract(epoch from (now() - l.created_at)) / 60)::integer as minutes_waiting;
end;
$$;

revoke all on function public.fn_lead_sla_scan(integer, boolean) from public, anon, authenticated;
grant execute on function public.fn_lead_sla_scan(integer, boolean) to service_role;
