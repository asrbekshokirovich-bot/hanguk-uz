-- Linking a lead's Telegram and Instagram on purpose, instead of waiting for
-- the customer to type something we can match.
--
-- By 2026-09-23 the passive matchers had run dry: 7 Instagram senders had
-- typed a Telegram @handle and 13 Telegram senders an Instagram one, and not
-- one of them matched an identity on the other side. So two active paths:
--
--   1. The operator writes the customer's Telegram / Instagram username (or a
--      Telegram numeric ID) on the lead card. It links at once if we already
--      hold that conversation, and otherwise waits on the lead and links the
--      moment the first message arrives.
--   2. Every lead gets a personal code. The link t.me/<bot>?start=L_<code>
--      opens the bot; the bot claims the code and ties that Telegram account to
--      the lead with no guessing at all. Telegram user IDs are global, so the
--      same person's chats with staff personal accounts (the userbot) land on
--      the lead too.
--
-- Neither path moves a conversation off a student, or off a lead that has a
-- phone of its own, without an explicit "force" from a person.

-- 1. Columns ---------------------------------------------------------------
alter table public.leads
  add column if not exists telegram_handle  text,
  add column if not exists instagram_handle text,
  -- Volatile default: ADD COLUMN evaluates it per row, so every existing lead
  -- gets its own code in the same statement.
  add column if not exists link_code text default substr(md5(gen_random_uuid()::text), 1, 10);

create unique index if not exists leads_link_code_key on public.leads (link_code);
create index if not exists leads_telegram_handle_idx  on public.leads (telegram_handle)  where telegram_handle  is not null;
create index if not exists leads_instagram_handle_idx on public.leads (instagram_handle) where instagram_handle is not null;

-- 2. What an operator pastes, reduced to what we store ----------------------
-- "@Asilbek", "https://t.me/asilbek/", "instagram.com/asilbek?igsh=…",
-- " asilbek " all become "asilbek". A bare number stays a number.
create or replace function public.normalize_handle(txt text)
returns text language sql immutable as $$
  select nullif(lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(coalesce(txt, ''), '\s', '', 'g'),
          '^(https?://)?(www\.)?(t\.me|telegram\.me|instagram\.com)/', '', 'i'),
        '[/?#].*$', ''),
      '^@+', '')
  ), '');
$$;

-- 3. Operator links a channel from the lead card ---------------------------
create or replace function public.link_lead_channel(
  p_lead_id uuid,
  p_channel text,
  p_value   text,
  p_force   boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v          text := public.normalize_handle(p_value);
  v_is_id    boolean;
  v_idents   text[];
  v_ident    text;
  v_ci       record;
  v_name     text;
  v_linked   int := 0;
  v_conflict jsonb := '[]'::jsonb;
  v_msgs     int := 0;
begin
  if not exists (
    select 1 from user_roles r
    where r.user_id = auth.uid()
      and r.role = any (array['owner'::app_role, 'admin'::app_role, 'call_operator'::app_role])
  ) then
    raise exception 'forbidden';
  end if;
  if p_channel not in ('telegram', 'instagram') then
    raise exception 'unsupported channel %', p_channel;
  end if;

  select full_name into v_name from leads where id = p_lead_id;
  if not found then raise exception 'lead not found'; end if;

  -- Remember it on the card first: if nothing matches today, the trigger
  -- below finishes the job when the customer writes.
  if p_channel = 'telegram' then
    update leads set telegram_handle = v, updated_at = now() where id = p_lead_id;
  else
    update leads set instagram_handle = v, updated_at = now() where id = p_lead_id;
  end if;

  if v is null then
    return jsonb_build_object('status', 'cleared');
  end if;

  v_is_id := v ~ '^[0-9]{5,}$';

  select array_agg(distinct x) into v_idents from (
    -- A Telegram user ID IS the chat identifier, so it can be linked before
    -- the customer has written a word. An Instagram number is only trusted
    -- if we have actually seen it (IGSIDs are page-scoped; people don't know
    -- their own).
    select v as x
    where v_is_id and (
      p_channel = 'telegram'
      or exists (select 1 from messages m where m.source = p_channel and m.sender_id = v)
      or exists (select 1 from communication_identities ci where ci.channel = p_channel and ci.identifier = v)
    )
    union
    select ci.identifier from communication_identities ci
    where not v_is_id and ci.channel = p_channel and lower(ci.identifier_label) = '@' || v
    union
    select m.sender_id from messages m
    where not v_is_id and m.source = p_channel and m.direction = 'incoming'
      and lower(m.metadata ->> 'username') = v
  ) s where x is not null;

  if v_idents is null then
    return jsonb_build_object('status', 'pending');
  end if;

  -- A real username belongs to exactly one account. When one maps to several
  -- chats the data is contaminated — on 2026-09-23 a staff account's username
  -- sat in the `incoming` metadata of other customers' business chats — so
  -- nothing is linked and the operator picks the right chat (or types its ID).
  if not v_is_id and array_length(v_idents, 1) > 1 then
    return jsonb_build_object(
      'status', 'ambiguous',
      'candidates', (
        select jsonb_agg(jsonb_build_object(
                 'identifier', i,
                 'name', (select t.sender_name from message_threads t
                           where t.source = p_channel and t.sender_id = i limit 1),
                 'messages', (select count(*) from messages m
                               where m.source = p_channel and m.sender_id = i)))
          from unnest(v_idents) i));
  end if;

  foreach v_ident in array v_idents loop
    select ci.id, ci.lead_id, ci.student_id,
           l.full_name as cur_name, l.phone as cur_phone,
           l.source as cur_source, l.source_id as cur_source_id
      into v_ci
      from communication_identities ci
      left join leads l on l.id = ci.lead_id
     where ci.channel = p_channel and ci.identifier = v_ident;

    if not found then
      insert into communication_identities
        (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
      values
        (p_channel, v_ident, case when v_is_id then null else '@' || v end, p_lead_id, v_name,
         'confirmed', 'staff', 'Operator lid kartasida kiritdi');
      v_linked := v_linked + 1;

    elsif v_ci.lead_id = p_lead_id then
      update communication_identities
         set confidence = 'confirmed', updated_at = now()
       where id = v_ci.id;
      v_linked := v_linked + 1;

    elsif p_force
       or (v_ci.student_id is null and (
             v_ci.lead_id is null
             -- An empty lead the webhook made for this very account on first
             -- contact: no phone, keyed on this channel and identifier.
             or (coalesce(trim(v_ci.cur_phone), '') = ''
                 and v_ci.cur_source = p_channel
                 and v_ci.cur_source_id = v_ident))) then
      update communication_identities
         set lead_id = p_lead_id, confidence = 'confirmed', source = 'staff',
             notes = 'Operator lid kartasida kiritdi (ko''chirildi)', updated_at = now()
       where id = v_ci.id;
      v_linked := v_linked + 1;

    else
      v_conflict := v_conflict || jsonb_build_object(
        'identifier', v_ident,
        'lead_id', v_ci.lead_id,
        'name', v_ci.cur_name,
        'is_student', v_ci.student_id is not null);
    end if;
  end loop;

  select count(*) into v_msgs
    from messages m
   where m.source = p_channel and m.sender_id = any (v_idents);

  return jsonb_build_object(
    'status', case when jsonb_array_length(v_conflict) > 0 then 'conflict' else 'linked' end,
    'linked', v_linked,
    'messages', v_msgs,
    'conflicts', v_conflict);
end;
$$;

revoke all on function public.link_lead_channel(uuid, text, text, boolean) from public, anon;
grant execute on function public.link_lead_channel(uuid, text, text, boolean) to authenticated;

-- 4. Pending handles link themselves on the first message -------------------
create or replace function public.link_pending_handle_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user  text;
  v_leads uuid[];
  v_lead  uuid;
  v_ci    record;
begin
  if new.direction <> 'incoming'
     or new.source not in ('telegram', 'instagram')
     or new.sender_id is null then
    return null;
  end if;

  v_user := lower(nullif(new.metadata ->> 'username', ''));
  if v_user is null then
    select lower(ltrim(identifier_label, '@')) into v_user
      from communication_identities
     where channel = new.source and identifier = new.sender_id
       and identifier_label like '@%';
  end if;

  if new.source = 'telegram' then
    select array_agg(id) into v_leads from leads
     where telegram_handle is not null
       and (telegram_handle = new.sender_id or telegram_handle = v_user);
  else
    select array_agg(id) into v_leads from leads
     where instagram_handle is not null
       and (instagram_handle = new.sender_id or instagram_handle = v_user);
  end if;

  -- None, or two leads claiming the same handle: that is for a person to sort out.
  if v_leads is null or array_length(v_leads, 1) <> 1 then
    return null;
  end if;
  v_lead := v_leads[1];

  select ci.id, ci.lead_id, ci.student_id into v_ci
    from communication_identities ci
   where ci.channel = new.source and ci.identifier = new.sender_id;

  if not found then
    insert into communication_identities
      (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
    values
      (new.source, new.sender_id, case when v_user is not null then '@' || v_user end, v_lead,
       new.sender_name, 'confirmed', 'staff', 'Operator kiritgan nik/ID bo''yicha avtomatik ulandi');
  elsif v_ci.lead_id is distinct from v_lead
        and v_ci.student_id is null
        and exists (
          select 1 from leads l
           where l.id = v_ci.lead_id
             and coalesce(trim(l.phone), '') = ''
             and l.source = new.source
             and l.source_id = new.sender_id) then
    update communication_identities
       set lead_id = v_lead, confidence = 'confirmed', source = 'staff',
           notes = 'Operator kiritgan nik/ID bo''yicha avtomatik ulandi', updated_at = now()
     where id = v_ci.id;
  end if;

  return null;
exception when others then
  -- An AFTER trigger that throws would roll back the message itself. Linking
  -- is a convenience; losing a customer's message is not acceptable.
  raise warning 'link_pending_handle_on_message: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_link_pending_handle on public.messages;
create trigger trg_link_pending_handle
  after insert on public.messages
  for each row execute function public.link_pending_handle_on_message();

-- 5. The bot claims a personal link ----------------------------------------
create or replace function public.claim_lead_link(
  p_code       text,
  p_channel    text,
  p_identifier text,
  p_label      text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
  v_ci   record;
begin
  select id, full_name into v_lead from leads where link_code = lower(trim(p_code));
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select id, lead_id, student_id into v_ci
    from communication_identities
   where channel = p_channel and identifier = p_identifier;

  if not found then
    insert into communication_identities
      (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
    values
      (p_channel, p_identifier, p_label, v_lead.id, v_lead.full_name,
       'confirmed', 'auto', 'Mijoz shaxsiy havolani bosdi');
  elsif v_ci.student_id is null then
    -- The customer pressed a link that only this lead was given: that outranks
    -- whatever the webhook guessed earlier.
    update communication_identities
       set lead_id = v_lead.id, confidence = 'confirmed',
           notes = 'Mijoz shaxsiy havolani bosdi', updated_at = now()
     where id = v_ci.id;
  end if;
  -- A student's link is left as it is.

  if p_channel = 'telegram' then
    update leads
       set telegram_handle = coalesce(telegram_handle, lower(nullif(ltrim(p_label, '@'), '')), p_identifier),
           updated_at = now()
     where id = v_lead.id;
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_lead.id, 'name', v_lead.full_name);
end;
$$;

-- Only the webhook (service role) may claim; a signed-in browser must not be
-- able to attach arbitrary Telegram IDs to arbitrary leads by code.
revoke all on function public.claim_lead_link(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_lead_link(text, text, text, text) to service_role;
