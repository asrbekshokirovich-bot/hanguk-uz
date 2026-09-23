-- Read a typed phone number in a Telegram bot chat too.
--
-- fn_capture_phone_from_message found the lead only through
-- communication_identities. The Telegram bot creates its lead keyed on
-- (source, source_id = chat id) and writes the identity row only when the
-- contact-share button is pressed — so a student who simply typed their
-- number never got it onto their lead, and never reached "Yangi lid". Fall
-- back to that same (source, source_id) key when no identity row exists.

create or replace function public.fn_capture_phone_from_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_phone   text;
  v_lead_id uuid;
begin
  if new.direction <> 'incoming' then
    return new;
  end if;

  v_phone := public.fn_extract_phone(new.content);
  if v_phone is null then
    return new;
  end if;

  -- Whose conversation is this? The identity spine usually knows.
  select ci.lead_id into v_lead_id
    from public.communication_identities ci
   where ci.channel = new.source
     and ci.identifier = new.sender_id
     and ci.lead_id is not null
   limit 1;

  -- Otherwise the lead the channel created for this account itself.
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

  -- Never overwrite a number somebody already has: a student quoting a
  -- friend's number must not rewrite their own record. Only fill a blank.
  update public.leads
     set phone = v_phone,
         qualified = true,
         updated_at = now()
   where id = v_lead_id
     and coalesce(trim(phone), '') = '';

  return new;
end;
$$;
