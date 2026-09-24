-- "Yangi lid" is now every NEW chat, not every new phone number.
--
-- The owner's rule (2026-09-24): whoever writes to us on Telegram or Instagram
-- for the first time lands in CRM → Aloqa → "Yangi lid" at once, number or no
-- number; someone we have written with before never does. The 10-minute
-- countdown starts at that first message, and it stops the moment anyone
-- answers in the chat — from the CRM or from the phone — because a chat with
-- no number cannot be called, so the reply is the contact.
--
-- Until now a lead only arrived there once it had both a phone and a name
-- (20260923150000_new_lead_section.sql), and a chat with no number was a
-- hidden, unqualified contact. Three changes:
--
--   1. fn_leads_mark_new_lead: a channel lead is new when it is created for a
--      chat that has no messages yet. The channel functions create the lead
--      BEFORE they store the first message, so "no messages under this chat"
--      is exactly "first contact". A number arriving later no longer makes an
--      old contact new.
--   2. fn_leads_qualified_guard: a new-chat lead counts as a lead (qualified)
--      even with no phone, so it shows in "Lidlar" as well, as asked. Older
--      phoneless contacts stay hidden as before.
--   3. fn_mark_lead_contacted_on_reply (new trigger on messages): the first
--      outgoing message in the chat of a lead still waiting in "Yangi lid"
--      stamps last_contacted_at, which takes it out of the section and out of
--      fn_lead_sla_scan's alert.

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
  return new;
end;
$$;

create or replace function public.fn_leads_qualified_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(trim(new.phone), '') <> '' then
    new.qualified := true;
    return new;
  end if;

  -- A brand-new chat is a lead with or without a number. Runs after
  -- trg_leads_mark_new_lead (triggers fire in name order), so new_lead_at is
  -- already decided here.
  if tg_op = 'INSERT' and new.new_lead_at is not null then
    new.qualified := true;
    return new;
  end if;

  if tg_op = 'INSERT'
     and new.source in ('instagram', 'telegram', 'whatsapp')
     and coalesce(trim(new.source_id), '') <> '' then
    new.qualified := false;
  end if;

  return new;
end;
$$;

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

drop trigger if exists trg_mark_lead_contacted_on_reply on public.messages;
create trigger trg_mark_lead_contacted_on_reply
  after insert on public.messages
  for each row execute function public.fn_mark_lead_contacted_on_reply();
