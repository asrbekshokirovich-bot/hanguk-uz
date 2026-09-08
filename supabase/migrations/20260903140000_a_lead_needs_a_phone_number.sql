-- A conversation is not a lead until you can call the person.
--
-- Attaching every Instagram conversation to a lead (2026-09-03) fixed one
-- problem and created another: 207 rows appeared in Leads with an Instagram
-- handle, no phone number, and no way to contact anybody. The office cannot
-- work those rows, and their presence distorts every count and report the
-- pipeline produces — which is worse than the anonymity it replaced, because a
-- wrong number is trusted and a missing one is not.
--
-- The link itself was right: the conversation has to belong to somebody, or
-- the operator is back to a wall of anonymous handles. What was wrong is
-- calling that record a lead. So the record stays and the claim goes:
-- `qualified` is false until there is a phone number, and the Leads page,
-- its counters and the analytics read only qualified rows.
--
-- The promotion is automatic in both directions it can happen: staff typing a
-- number into the lead, and — far more common — the student sending their
-- number in the chat, which until now nobody transcribed anywhere.

alter table public.leads
  add column if not exists qualified boolean not null default true;

comment on column public.leads.qualified is
  'False = a contact record with no phone number, created automatically from a conversation. Not a lead: excluded from the Leads page, its counters and analytics. Becomes true the moment a phone number is known.';

-- ---------------------------------------------------------------------------
-- 1. A phone number is what makes it a lead
-- ---------------------------------------------------------------------------

create or replace function public.fn_leads_qualified_guard()
returns trigger
language plpgsql
as $$
begin
  -- A phone number always qualifies, however it arrived.
  if coalesce(trim(new.phone), '') <> '' then
    new.qualified := true;
    return new;
  end if;

  -- No phone. Only rows this system created from a conversation are demoted —
  -- `source_id` is the channel account id, which nothing typed by hand has.
  -- A lead a person entered by hand is their judgement to make, not ours.
  if tg_op = 'INSERT'
     and new.source in ('instagram', 'telegram', 'whatsapp')
     and coalesce(trim(new.source_id), '') <> '' then
    new.qualified := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leads_qualified_guard on public.leads;
create trigger trg_leads_qualified_guard
  before insert or update of phone on public.leads
  for each row execute function public.fn_leads_qualified_guard();

-- The 207 already created today, plus anything like them.
update public.leads
   set qualified = false
 where source in ('instagram', 'telegram', 'whatsapp')
   and coalesce(trim(source_id), '') <> ''
   and coalesce(trim(phone), '') = ''
   and qualified;

create index if not exists idx_leads_qualified on public.leads (qualified) where not qualified;

-- ---------------------------------------------------------------------------
-- 2. Read a phone number out of what the student actually wrote
-- ---------------------------------------------------------------------------
-- Students send their number in the chat constantly and nothing ever read it,
-- so the office kept asking for it again. Deliberately narrow: a false
-- positive puts a wrong number on a person's record, which is worse than
-- missing one, so this only accepts shapes that cannot be much else.
--
--   +998 90 123 45 67 / 998901234567   → +998901234567
--   010-1234-5678                      → +821012345678   (Korean mobile)
--   901234567                          → +998901234567, but ONLY when the
--                                        message is that number and nothing
--                                        else — nine bare digits inside a
--                                        sentence is as likely to be a passport
--                                        or an application number.

create or replace function public.fn_extract_phone(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text;
  v_match text;
begin
  if p_text is null or trim(p_text) = '' then
    return null;
  end if;

  -- Separators are decoration: people write a number a dozen ways. Strip them
  -- once and match against the digits.
  v_clean := regexp_replace(p_text, '[\s\-\(\)\.]', '', 'g');

  -- Uzbek, with the country code.
  v_match := (regexp_match(v_clean, '(?:\+)?(998\d{9})'))[1];
  if v_match is not null then
    return '+' || v_match;
  end if;

  -- Korean, written with the country code (+82 10 ...).
  v_match := (regexp_match(v_clean, '(?:\+)?82(10\d{8})'))[1];
  if v_match is not null then
    return '+82' || v_match;
  end if;

  -- Korean, written locally (010 ...).
  v_match := (regexp_match(v_clean, '(010\d{8})'))[1];
  if v_match is not null then
    return '+82' || substring(v_match from 2);
  end if;

  -- A bare Uzbek mobile, but only when it is the whole message. Nine loose
  -- digits inside a sentence is as likely to be a passport or an application
  -- number, and a wrong phone number on a record is worse than none.
  if regexp_replace(v_clean, '\+', '', 'g') ~ '^9\d{8}$' then
    return '+998' || regexp_replace(v_clean, '\+', '', 'g');
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. When it arrives in a message, put it on the record
-- ---------------------------------------------------------------------------

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

  -- Whose conversation is this? The identity spine already knows.
  select ci.lead_id into v_lead_id
    from public.communication_identities ci
   where ci.channel = new.source
     and ci.identifier = new.sender_id
     and ci.lead_id is not null
   limit 1;

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

drop trigger if exists trg_capture_phone_from_message on public.messages;
create trigger trg_capture_phone_from_message
  after insert on public.messages
  for each row execute function public.fn_capture_phone_from_message();

-- ---------------------------------------------------------------------------
-- 4. Read the numbers already sitting in the archive
-- ---------------------------------------------------------------------------
-- Six months of conversations where somebody typed their number and nothing
-- was listening. Most recent message wins, since a person's newest number is
-- the one to call.

with found as (
  select distinct on (ci.lead_id)
         ci.lead_id,
         public.fn_extract_phone(m.content) as phone
    from public.messages m
    join public.communication_identities ci
      on ci.channel = m.source and ci.identifier = m.sender_id
   where m.direction = 'incoming'
     and ci.lead_id is not null
     and public.fn_extract_phone(m.content) is not null
   order by ci.lead_id, m.created_at desc
)
update public.leads l
   set phone = f.phone,
       qualified = true,
       updated_at = now()
  from found f
 where l.id = f.lead_id
   and coalesce(trim(l.phone), '') = '';
