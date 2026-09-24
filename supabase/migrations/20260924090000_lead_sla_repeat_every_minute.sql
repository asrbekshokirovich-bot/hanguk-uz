-- Keep alerting about an unanswered new lead every minute until somebody
-- answers.
--
-- The owner's rule (2026-09-24): one alert at the 10-minute mark was not
-- enough — the alert must repeat, every minute, for as long as the lead sits
-- in "Yangi lid" with no reply, no ALOQA result, and not closed. It stops by
-- itself the moment any of those happens, because each of them takes the lead
-- out of the scan below.
--
-- sla_alerted_at used to mean "alerted, never again". It now means "last
-- alerted at": a lead is due again once its last alert is 50 seconds old, so
-- the every-minute cron (lead-sla-check-1min) catches it on each run despite
-- scheduling jitter.

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
      floor(extract(epoch from (now() - l.new_lead_at)) / 60)::integer
    from public.leads l
    where l.new_lead_at is not null
      and l.call_result is null
      and l.last_contacted_at is null
      and l.status not in ('converted', 'lost')
      and l.converted_to_student_id is null
      and (l.sla_alerted_at is null or l.sla_alerted_at <= now() - interval '50 seconds')
      and l.new_lead_at <= now() - make_interval(mins => p_minutes)
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
    and l.new_lead_at <= now() - make_interval(mins => p_minutes)
  returning l.id, l.full_name, l.phone, l.how_heard, l.source, l.new_lead_at,
    floor(extract(epoch from (now() - l.new_lead_at)) / 60)::integer;
end;
$function$;
