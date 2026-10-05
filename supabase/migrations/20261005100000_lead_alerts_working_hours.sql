-- The "no contact for 10 minutes" alert only during working hours.
--
-- The owner's rule (2026-10-05): the every-minute alert about an unanswered
-- new lead (lead-sla-check → fn_lead_sla_scan) stops when the working day
-- ends at 18:00 and starts again at 10:00 of the next working morning —
-- weekday nights as well as Saturday 18:00 → Monday 10:00. This covers every
-- lead, whatever channel it came from (Instagram, Telegram, the app).
--
-- Between 09:40 (when work starts) and 10:00 the alert is sent only for a
-- lead whose countdown started that morning, so a lead that arrived during
-- the day keeps its 10-minute alert, while the ones left from the day before
-- come back at 10:00, together with the overnight ones (their countdown starts
-- at 10:00 anyway, fn_lead_sla_start).

-- Whether the alert may go out at p_now for a countdown that started at
-- p_start.
create or replace function public.fn_lead_alerts_open(p_now timestamptz, p_start timestamptz)
returns boolean
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_local timestamp := p_now at time zone 'Asia/Tashkent';
  v_dow   integer   := extract(isodow from v_local)::integer; -- 1 = Monday … 7 = Sunday
  v_time  time      := v_local::time;
  v_start timestamp := p_start at time zone 'Asia/Tashkent';
begin
  if v_dow = 7 or v_time < time '09:40' or v_time >= time '18:00' then
    return false;
  end if;
  if v_time >= time '10:00' then
    return true;
  end if;
  return v_start::date = v_local::date and v_start::time >= time '09:40';
end;
$$;

-- As in 20260930160000_lead_needs_phone.sql, plus the working-hours window.
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
      and public.fn_lead_alerts_open(now(), coalesce(l.sla_start_at, l.new_lead_at))
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
    and public.fn_lead_alerts_open(now(), coalesce(l.sla_start_at, l.new_lead_at))
  returning l.id, l.full_name, l.phone, l.how_heard, l.source, l.new_lead_at,
    floor(extract(epoch from (now() - coalesce(l.sla_start_at, l.new_lead_at))) / 60)::integer;
end;
$function$;
