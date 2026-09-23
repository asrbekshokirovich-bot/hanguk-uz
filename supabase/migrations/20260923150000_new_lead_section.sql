-- "Yangi lid": the moment an Instagram/Telegram conversation becomes a person
-- the office can call.
--
-- A conversation turns into a lead when a phone number arrives (typed into the
-- chat and read by fn_capture_phone_from_message, or shared via the Telegram
-- contact button). That moment, not the first "salom", is when the 10-minute
-- clock should start — and only for arrivals from here on, so the backlog of
-- older leads never floods the new section.
--
-- `new_lead_at` records that moment once. It is set only when a write brings a
-- lead from "missing a phone or a name" to "has both"; a lead that already had
-- both before this migration keeps null and never appears in "Yangi lid".

alter table public.leads
  add column if not exists new_lead_at timestamptz;

comment on column public.leads.new_lead_at is
  'When this Instagram/Telegram lead first had both a phone number and a name — the start of the "Yangi lid" 10-minute clock. Null for every lead that already had both before 2026-09-23, and for manual leads.';

create or replace function public.fn_leads_mark_new_lead()
returns trigger
language plpgsql
as $$
begin
  if new.new_lead_at is not null then
    return new;
  end if;
  if coalesce(new.source, '') not in ('instagram', 'telegram') then
    return new;
  end if;
  if coalesce(trim(new.phone), '') = '' or coalesce(trim(new.full_name), '') = '' then
    return new;
  end if;
  -- Already had both before this write: an existing lead being edited, not a
  -- new arrival.
  if tg_op = 'UPDATE'
     and coalesce(trim(old.phone), '') <> ''
     and coalesce(trim(old.full_name), '') <> '' then
    return new;
  end if;

  new.new_lead_at := now();
  return new;
end;
$$;

drop trigger if exists trg_leads_mark_new_lead on public.leads;
create trigger trg_leads_mark_new_lead
  before insert or update of phone, full_name on public.leads
  for each row execute function public.fn_leads_mark_new_lead();

create index if not exists idx_leads_new_lead_at
  on public.leads (new_lead_at)
  where new_lead_at is not null;

-- The watchdog now times from `new_lead_at` instead of `created_at`: a chat
-- that never left a number is not a lead anyone failed to call.
drop function if exists public.fn_lead_sla_scan(integer, boolean);

create function public.fn_lead_sla_scan(p_minutes integer default 10, p_dry boolean default false)
returns table (
  id uuid,
  full_name text,
  phone text,
  how_heard text,
  source text,
  arrived_at timestamptz,
  minutes_waiting integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
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
      and l.sla_alerted_at is null
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
    and l.sla_alerted_at is null
    and l.new_lead_at <= now() - make_interval(mins => p_minutes)
  returning l.id, l.full_name, l.phone, l.how_heard, l.source, l.new_lead_at,
    floor(extract(epoch from (now() - l.new_lead_at)) / 60)::integer;
end;
$$;

revoke all on function public.fn_lead_sla_scan(integer, boolean) from public, anon, authenticated;
grant execute on function public.fn_lead_sla_scan(integer, boolean) to service_role;
