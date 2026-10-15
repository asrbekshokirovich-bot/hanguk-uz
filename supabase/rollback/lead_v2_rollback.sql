-- Lead module v2 — ROLLBACK of the behaviour change.
--
-- NOT a migration (it lives outside supabase/migrations on purpose, so nothing
-- applies it by accident). Run it, by hand, if the new desk has to be switched
-- off and the old "Yangi lid" alert brought back:
--
--   * the v2 jobs are unscheduled;
--   * the v2 triggers on leads / messages are dropped;
--   * the old triggers, the old SLA scan, the old after-hours functions (hours
--     Mon–Sat 09:40–18:00) and the old row level security on `leads` are
--     restored exactly as the repo's earlier migrations define them.
--
-- It does NOT drop the new columns, tables or settings and does not touch data:
-- they are inert once the triggers are gone, and keeping them means nothing
-- that was recorded (events, call attempts, promises, merged cards) is lost.
-- Leads created while v2 was live have no `new_lead_at`, so they will not show
-- in the old "Yangi lid" and will not trigger the old alert; find them with
--   select id, full_name, source, created_at from public.leads
--    where crm_generation = 'new' and answered_at is null and stage = 'new';
-- Cards that were merged away stay hidden (merged_into_id is set).
--
-- Also stop the edge functions that read the new outbox (lead-alert-dispatch,
-- lead-reports, lead-brief) — their cron jobs are removed below — and redeploy
-- the previous lead-sla-check (it must call fn_lead_sla_scan again).

-- 1. jobs --------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job
     where jobname in ('lead-timer-scan', 'lead-waiting', 'lead-followup-drafts', 'lead-reactivation',
                       'lead-priority', 'lead-alert-expire', 'lead-alert-dispatch', 'lead-brief',
                       'lead-reports-daily', 'lead-reports-weekly');
  end if;
end $$;

-- 2. v2 triggers ---------------------------------------------------------------
drop trigger if exists trg_leads_v2_before_insert on public.leads;
drop trigger if exists trg_leads_v2_after_insert on public.leads;
drop trigger if exists trg_0_leads_v2_guard_columns on public.leads;
drop function if exists public.fn_leads_v2_guard_columns();
drop trigger if exists trg_a_leads_v2_before_update on public.leads;
drop trigger if exists trg_leads_v2_after_update on public.leads;
drop trigger if exists trg_leads_v2_on_message on public.messages;

-- 3. the old after-hours functions, as live before v2 (texts and hours as of 20261014172806,
--    09:00–18:00; queue and echo check as in 20260929170000 / 20260930120000)
create or replace function public.fn_after_hours_reply_texts()
returns text[]
language sql
immutable
as $$
  select array[
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 09:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 09:00–18:00). Operatorlarimiz ertaga soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 09:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 09:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish vaqtimiz 10:00 dan 18:00 gacha bo''lganligi sababli, operatorlarimiz bugun soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Hozirda ish vaqtimiz yakunlangan (ish vaqtimiz: 10:00–18:00). Operatorlarimiz ertaga soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!',
    'Assalomu alaykum, hurmatli mijoz! HANGUK''ga murojaat qilganingiz uchun rahmat. Ish kunlarimiz dushanbadan shanbagacha, soat 10:00 dan 18:00 gacha. Operatorlarimiz dushanba kuni soat 10:00 da siz bilan aloqaga chiqishadi. Sabr-toqatingiz uchun rahmat!'
  ]::text[]
$$;

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
  if v_time < time '09:00' then
    return v_texts[1];
  end if;
  if v_time >= time '18:00' then
    return v_texts[2];
  end if;
  return null;
end;
$$;

create or replace function public.fn_is_automatic_outgoing(p_content text, p_metadata jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $$
  select trim(coalesce(p_content, '')) like '[template]%'
      or coalesce(p_metadata->'attachments'->0->>'type', '') = 'template'
      or trim(coalesce(p_content, '')) = any (public.fn_after_hours_reply_texts())
      or regexp_replace(trim(coalesce(p_content, '')), '\s+', ' ', 'g') = any (public.fn_instagram_flow_texts())
      or coalesce(p_metadata->>'auto_reply', '') not in ('', 'false')
$$;

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

  v_text := public.fn_after_hours_reply_text(new.created_at);
  if v_text is null then
    return new;
  end if;

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

-- 4. the old SLA scan, as in 20261005100000_lead_alerts_working_hours.sql
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

-- 5. the old triggers on leads / messages
drop trigger if exists trg_leads_mark_new_lead on public.leads;
create trigger trg_leads_mark_new_lead
  before insert or update of phone, full_name on public.leads
  for each row execute function public.fn_leads_mark_new_lead();

drop trigger if exists trg_mark_lead_contacted_on_reply on public.messages;
create trigger trg_mark_lead_contacted_on_reply
  after insert on public.messages
  for each row execute function public.fn_mark_lead_contacted_on_reply();

-- the qualified guard, as in 20261015120000_lead_intake_rules.sql (#431)
create or replace function public.fn_leads_qualified_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.qualified := coalesce(trim(new.phone), '') <> ''
                or new.new_lead_at is not null
                or new.replied_chat_at is not null;
  return new;
end;
$function$;

-- 6. the old row level security on leads (everybody on staff sees every lead)
drop policy if exists "lead v2 select" on public.leads;
drop policy if exists "lead v2 insert" on public.leads;
drop policy if exists "lead v2 update" on public.leads;
drop policy if exists "lead v2 delete" on public.leads;
drop policy if exists "Staff can view all leads" on public.leads;
drop policy if exists "Staff can create leads" on public.leads;
drop policy if exists "Staff can update leads" on public.leads;
drop policy if exists "Staff can delete leads" on public.leads;

create policy "Staff can view all leads" on public.leads for select
  using (exists (select 1 from public.user_roles
                  where user_id = auth.uid() and role in ('owner', 'admin', 'call_operator', 'document_handler')));
create policy "Staff can create leads" on public.leads for insert
  with check (exists (select 1 from public.user_roles
                       where user_id = auth.uid() and role in ('owner', 'admin', 'call_operator')));
create policy "Staff can update leads" on public.leads for update
  using (exists (select 1 from public.user_roles
                  where user_id = auth.uid() and role in ('owner', 'admin', 'call_operator')));
create policy "Staff can delete leads" on public.leads for delete
  using (exists (select 1 from public.user_roles
                  where user_roles.user_id = (select auth.uid())
                    and user_roles.role = any (array['owner'::app_role, 'admin'::app_role, 'call_operator'::app_role])));
