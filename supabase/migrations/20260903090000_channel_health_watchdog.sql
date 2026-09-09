-- Notice when a messaging channel stops talking.
--
-- Telegram stopped delivering on 2026-08-04. Nobody found out until an audit in
-- September — 29 days in which every message a student sent on Telegram was
-- lost, because the CRM has no idea what "no messages" means. An empty inbox
-- and a broken inbox look exactly the same from the inside.
--
-- The fix is a heartbeat: per channel, when did an inbound message last arrive,
-- and has it been longer than that channel's normal quiet period? The state is
-- kept in a table rather than recomputed each time so an alert fires on the
-- TRANSITION (healthy → silent, silent → healthy) and not once an hour for a
-- month, which is how alerting gets muted and stops working.
--
-- The scan is SQL. The notification is `channel-health-check`, the edge
-- function that owns the bot token; cron calls it hourly, it calls the scan,
-- and it only has something to send when a channel changed state.

create table if not exists public.channel_health (
  source              text primary key,
  -- How long this channel may plausibly stay quiet. Instagram runs quieter than
  -- Telegram overnight, so the threshold is per channel and editable in place.
  silent_after_hours  integer not null default 24 check (silent_after_hours between 1 and 720),
  enabled             boolean not null default true,
  last_inbound_at     timestamptz,
  state               text not null default 'unknown'
                        check (state in ('unknown', 'healthy', 'silent')),
  state_since         timestamptz not null default now(),
  last_alert_at       timestamptz,
  updated_at          timestamptz not null default now()
);

comment on table public.channel_health is
  'One row per messaging channel: when it last received anything, and whether it is currently considered silent. Written only by fn_channel_health_scan().';

insert into public.channel_health (source, silent_after_hours)
values ('telegram', 24), ('instagram', 48)
on conflict (source) do nothing;

create table if not exists public.channel_health_log (
  id         bigserial primary key,
  source     text not null,
  from_state text,
  to_state   text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_health_log_created
  on public.channel_health_log (created_at desc);

alter table public.channel_health enable row level security;
alter table public.channel_health_log enable row level security;

-- Staff may look at the health board; only the scan (SECURITY DEFINER) writes.
drop policy if exists channel_health_read on public.channel_health;
create policy channel_health_read on public.channel_health
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role in ('owner', 'admin', 'call_operator')
    )
  );

drop policy if exists channel_health_log_read on public.channel_health_log;
create policy channel_health_log_read on public.channel_health_log
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role in ('owner', 'admin', 'call_operator')
    )
  );

/**
 * Refresh every enabled channel's health and report what CHANGED.
 *
 * Returns one JSON object per channel whose state moved, so the caller can
 * notify exactly once per transition:
 *   [{ source, from_state, to_state, last_inbound_at, silent_hours }]
 *
 * A channel that has never received anything stays 'unknown' rather than being
 * reported as newly broken — there is nothing to have broken yet, and firing an
 * alert for it on the day it is configured only teaches people to ignore the
 * alerts.
 */
create or replace function public.fn_channel_health_scan()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_changes jsonb := '[]'::jsonb;
  r         record;
  v_last    timestamptz;
  v_next    text;
begin
  for r in select * from public.channel_health where enabled order by source loop
    select max(created_at) into v_last
    from public.messages
    where source = r.source and direction = 'incoming';

    v_next := case
      when v_last is null then 'unknown'
      when v_last < now() - make_interval(hours => r.silent_after_hours) then 'silent'
      else 'healthy'
    end;

    -- The timestamp is always refreshed; the state and its clock only move on a
    -- real change, so `state_since` answers "how long has it been like this?".
    update public.channel_health
       set last_inbound_at = v_last,
           state           = v_next,
           state_since     = case when v_next = r.state then state_since else now() end,
           updated_at      = now()
     where source = r.source;

    if v_next is distinct from r.state then
      insert into public.channel_health_log (source, from_state, to_state, details)
      values (
        r.source, r.state, v_next,
        jsonb_build_object('last_inbound_at', v_last, 'silent_after_hours', r.silent_after_hours)
      );

      -- 'unknown' is a starting state, not an incident: log the transition,
      -- but give the notifier nothing to send about it.
      if (v_next <> 'unknown' and r.state <> 'unknown')
         or (v_next = 'silent' and r.state = 'unknown') then
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'source', r.source,
          'from_state', r.state,
          'to_state', v_next,
          'last_inbound_at', v_last,
          'silent_hours', case
            when v_last is null then null
            else round(extract(epoch from (now() - v_last)) / 3600.0)
          end
        ));
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_changes) > 0 then
    update public.channel_health set last_alert_at = now()
     where source in (select value->>'source' from jsonb_array_elements(v_changes));
  end if;

  return v_changes;
end;
$$;

revoke all on function public.fn_channel_health_scan() from public, anon, authenticated;
grant execute on function public.fn_channel_health_scan() to service_role;
