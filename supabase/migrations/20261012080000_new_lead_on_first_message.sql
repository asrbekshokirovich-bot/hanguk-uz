-- "Yangi lid" from the first message, phone or no phone.
--
-- The owner's rule (2026-10-12): on Instagram and Telegram, the first message
-- of a new chat is a new lead and lands in CRM → Aloqa → "Yangi lid" at once,
-- whether or not the person wrote a phone number. When a number is typed into
-- the chat later, fn_capture_phone_from_message adds it to the lead as before.
--
-- Until now a chat only became a "Yangi lid" when its phone number arrived
-- (20260923150000_new_lead_section.sql), and leads.qualified — which the CRM
-- list filters on — meant "has a phone". Both change here:
--
--   * fn_leads_mark_new_lead stamps new_lead_at (and the countdown start) on
--     the INSERT of a new chat's lead, not when the phone comes;
--   * fn_leads_qualified_guard counts a lead as qualified when it has a phone
--     OR it arrived as a new chat (new_lead_at), so the CRM shows it.
--
-- Triggers fire in name order, so trg_leads_mark_new_lead sets new_lead_at
-- before trg_leads_qualified_guard reads it.

create or replace function public.fn_leads_mark_new_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    new.new_lead_at := now();
    new.sla_start_at := public.fn_lead_sla_start(new.new_lead_at);
    return new;
  end if;

  -- UPDATE: the number of a chat that arrived before this rule has just come.
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
$function$;

create or replace function public.fn_leads_qualified_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.qualified := coalesce(trim(new.phone), '') <> '' or new.new_lead_at is not null;
  return new;
end;
$function$;

-- The chats of the last 14 days that stayed out of "Yangi lid" only for want
-- of a phone number. Each arrives at its first incoming message. One already
-- answered by a person goes straight to "Lidlar" (last_contacted_at = that
-- reply); the rest wait in "Yangi lid". sla_alerted_at is set so the overdue
-- ones do not all fire a Telegram alert at once.
with arrivals as (
  select l.id,
         coalesce(
           (select min(m.created_at) from public.messages m
             where m.source = l.source and m.sender_id = l.source_id
               and m.direction = 'incoming'),
           l.new_chat_at) as arrived_at
    from public.leads l
   where l.source in ('instagram', 'telegram')
     and l.new_chat_at > now() - interval '14 days'
     and l.new_lead_at is null
)
update public.leads l
   set new_lead_at = a.arrived_at,
       sla_start_at = public.fn_lead_sla_start(a.arrived_at),
       sla_alerted_at = now(),
       qualified = true,
       last_contacted_at = coalesce(l.last_contacted_at, (
         select min(m.created_at) from public.messages m
          where m.source = l.source and m.sender_id = l.source_id
            and m.direction = 'outgoing'
            and m.created_at >= a.arrived_at - interval '1 minute'
            and not public.fn_is_automatic_outgoing(m.content, m.metadata)))
  from arrivals a
 where l.id = a.id;
