-- Who is a new lead, and which outgoing messages count as an answer.
--
-- Three rules the owner set on 2026-10-15, after the intake audit:
--
-- 1. A chat that Hanguk started is not a "Yangi lid", but it is not hidden
--    either. When a staff member writes first (from the Instagram app, the
--    Telegram account or the CRM) and the person writes back, their lead goes
--    to "Bugungi lidlar" for that day and to "Lidlar" from 00:00. No 10-minute
--    countdown, no alert. Until now such a lead got no new_lead_at, and without
--    a phone it was unqualified: hidden from every CRM list (16 of them).
--
--    The moment the person first wrote back is kept in leads.replied_chat_at,
--    and it makes the lead qualified like a phone or new_lead_at does. A phone
--    arriving later does not move it to "Yangi lid": the UPDATE branch of
--    fn_leads_mark_new_lead needs new_chat_at, which a replied chat never has.
--
--    Only a real staff message counts as "Hanguk wrote first": an automatic
--    one (Meta's template, the after-hours reply, the bot) does not, and
--    neither does one from the last minute, which may be an automatic reply to
--    this very message delivered before it.
--
-- 2. An outgoing message marked metadata.auto_reply is automatic. The
--    Instagram webhook marks an echo that left within 3 seconds of the
--    person's message (Meta's instant replies and saved-reply flows, which
--    answered in about a second until 2026-09-15); the Telegram bot marks its
--    own messages. Neither takes a lead out of "Yangi lid" any more.
--
-- 3. The leads hidden by rule 1 come back, in "Lidlar" (they arrived before
--    today).

alter table public.leads
  add column if not exists replied_chat_at timestamptz;

comment on column public.leads.replied_chat_at is
  'When the person first wrote back in a chat Hanguk started (Instagram/Telegram). Such a lead is shown in "Bugungi lidlar"/"Lidlar", never in "Yangi lid".';

-- The closing messages of the Instagram question flows that ran until
-- 2026-09-15. Their questions came about a second after the person's answer
-- and are caught by the 3-second rule; these came minutes later, so they are
-- matched by their exact text (spaces and line breaks folded).
create or replace function public.fn_instagram_flow_texts()
returns text[]
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $$
  select array[
    'Rahmat! Ma''lumotlaringiz qabul qilindi Operatorlarimiz tez orada siz bilan bog''lanadi.',
    'Rahmat! Ma''lumotlaringiz qabul qilindi. Mutaxassisimiz eng qisqa vaqt ichida siz bilan bog''lanadi va Koreya universitetlari, grantlar va hujjat topshirish jarayoni haqida to''liq ma''lumot beradi.',
    'Rahmat! Ma''lumotlaringiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog''lanadi.',
    'Yana ozgina qoldi! Iltimos, savollarga javob berishni yakunlang.'
  ]
$$;

-- True for a message nobody at Hanguk wrote: Meta's template echo, our own
-- after-hours reply, a closing message of the Instagram flows, or anything
-- marked auto_reply (Instagram instant replies, the Telegram bot).
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

    -- Somebody who has written to us before is not new, whatever their lead row.
    if exists (
      select 1 from public.messages m
       where m.source = new.source
         and m.sender_id = new.source_id
         and m.direction = 'incoming'
    ) then
      return new;
    end if;

    -- Hanguk wrote first and this is the answer: "Bugungi lidlar", not "Yangi lid".
    if exists (
      select 1 from public.messages m
       where m.source = new.source
         and m.sender_id = new.source_id
         and m.direction = 'outgoing'
         and m.created_at < now() - interval '1 minute'
         and not public.fn_is_automatic_outgoing(m.content, m.metadata)
    ) then
      new.replied_chat_at := now();
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
  new.qualified := coalesce(trim(new.phone), '') <> ''
                or new.new_lead_at is not null
                or new.replied_chat_at is not null;
  return new;
end;
$function$;

-- The bot's messages stored so far, marked like the webhook marks new ones.
update public.messages
   set metadata = coalesce(metadata, '{}'::jsonb) || '{"auto_reply": "bot"}'::jsonb
 where source = 'telegram'
   and direction = 'outgoing'
   and sender_name = 'Hanguk bot'
   and coalesce(metadata->>'auto_reply', '') = '';

-- Rule 3: the chats Hanguk started that the person answered, hidden until now.
with replied as (
  select l.id,
         (select min(m.created_at) from public.messages m
           where m.source = l.source and m.sender_id = l.source_id
             and m.direction = 'incoming') as first_in,
         (select min(m.created_at) from public.messages m
           where m.source = l.source and m.sender_id = l.source_id
             and m.direction = 'outgoing'
             and not public.fn_is_automatic_outgoing(m.content, m.metadata)) as first_staff
    from public.leads l
   where l.source in ('instagram', 'telegram')
     and coalesce(trim(l.source_id), '') <> ''
     and not l.qualified
     and l.new_lead_at is null
     and l.replied_chat_at is null
)
update public.leads l
   set replied_chat_at = r.first_in,
       qualified = true
  from replied r
 where l.id = r.id
   and r.first_in is not null
   and r.first_staff < r.first_in;
