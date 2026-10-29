-- Xabarlar (CRM inbox) — navbat v2.
--
-- Audit 2026-10-29 (xabarlar_auditi.html) findings fixed here, database side:
--   3  the first conversation auto-opened and was marked read for everyone —
--      the UI no longer auto-opens; nothing to change here beyond the
--      triggers below.
--   7  "Ichki eslatma" never saved: message_type 'note' was not allowed by
--      messages_message_type_check. Allowed now, and a note is kept out of
--      every "we answered" path (unread clearing, thread bump, previews).
--   9  hidden "[template]" rows and auto-replies drove the queue preview and
--      the waiting time — get_thread_previews now skips hidden rows and
--      reports last_incoming_at / last_human_out_at so the UI can tell
--      "waiting for a person" from "answered".
--  10  an archived conversation never came back when the person wrote again.
--  11  staff / partner / service chats sat in the queue as "Yangi lid":
--      message_threads.kind.
--  15  "@1819638515" — message_threads.handle, filled from the person's own
--      messages (username in metadata), never from ours.
--
-- Also fixed on the way: an automatic reply (after-hours text, Meta instant
-- reply, the bot's welcome) used to mark the person's messages as read —
-- mark_answered_on_outgoing only counts a reply written by a person now.

-- ---------------------------------------------------------------------------
-- 1. message_threads: kind, handle, archived_at
-- ---------------------------------------------------------------------------
alter table public.message_threads
  add column if not exists kind text not null default 'lead',
  add column if not exists handle text,
  add column if not exists archived_at timestamptz;

alter table public.message_threads drop constraint if exists message_threads_kind_check;
alter table public.message_threads
  add constraint message_threads_kind_check
  check (kind in ('lead', 'staff', 'partner', 'service'));

create index if not exists idx_message_threads_kind
  on public.message_threads (kind) where kind <> 'lead';

comment on column public.message_threads.kind is
  'lead (default) | staff (own employee) | partner (university/agency) | service (Telegram 777000 etc.). Only lead threads are in the operator queue.';
comment on column public.message_threads.handle is
  'Public @username of the person, taken from their own incoming messages. Null when they have none.';

-- Known non-lead chats (Telegram chat ids verified in prod 2026-10-29).
update public.message_threads set kind = 'service'
 where source = 'telegram' and sender_id = '777000' and kind = 'lead';
update public.message_threads set kind = 'staff'
 where source = 'telegram'
   and sender_id in ('7467410950', '8308387424', '3655449327', '8107826164', '8463034036', '3696933830')
   and kind = 'lead';
update public.message_threads set kind = 'partner'
 where source = 'telegram' and sender_id = '3721534371' and kind = 'lead';

-- Handle backfill: the latest username the PERSON wrote with.
update public.message_threads t
   set handle = sub.username
  from (
    select distinct on (m.source, m.sender_id) m.source, m.sender_id,
           ltrim(m.metadata ->> 'username', '@') as username
      from public.messages m
     where m.direction = 'incoming'
       and nullif(trim(coalesce(m.metadata ->> 'username', '')), '') is not null
     order by m.source, m.sender_id, m.created_at desc
  ) sub
 where sub.source = t.source and sub.sender_id = t.sender_id
   and t.handle is null;

create or replace function public.fn_thread_handle_from_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_handle text;
begin
  if new.direction <> 'incoming' then
    return new;
  end if;
  v_handle := nullif(ltrim(trim(coalesce(new.metadata ->> 'username', '')), '@'), '');
  if v_handle is null then
    return new;
  end if;
  update public.message_threads
     set handle = v_handle
   where source = new.source and sender_id = new.sender_id
     and handle is distinct from v_handle;
  return new;
end;
$$;

drop trigger if exists trg_thread_handle_from_message on public.messages;
create trigger trg_thread_handle_from_message
  after insert on public.messages
  for each row execute function public.fn_thread_handle_from_message();

-- ---------------------------------------------------------------------------
-- 2. Internal notes: allowed, and invisible to every "we answered" rule
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'file', 'voice', 'video', 'audio', 'note'));

-- A note is written by staff for staff. It is not a reply, so it must not
-- clear the person's unread messages; and an automatic reply is not a reply
-- by a person either (the after-hours text cleared the badge every night).
create or replace function public.mark_answered_on_outgoing()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.direction <> 'outgoing' then
    return new;
  end if;
  if coalesce(new.message_type, '') = 'note' or coalesce(new.metadata ->> 'internal', '') = 'true' then
    return new;
  end if;
  if public.fn_is_automatic_outgoing(new.content, new.metadata) then
    return new;
  end if;

  update public.messages m
     set status = 'read'
   where m.source = new.source
     and m.sender_id = new.sender_id
     and m.direction = 'incoming'
     and m.status = 'unread'
     and m.created_at <= new.created_at;

  return new;
end;
$$;

-- A note must not move the conversation to the top of the inbox.
create or replace function public.bump_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(new.message_type, '') = 'note' or coalesce(new.metadata ->> 'internal', '') = 'true' then
    return new;
  end if;
  update public.message_threads t
     set last_message_at = greatest(t.last_message_at, new.created_at)
   where t.source = new.source and t.sender_id = new.sender_id
     and t.last_message_at < new.created_at;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. A person writing again reopens an archived conversation
-- ---------------------------------------------------------------------------
create or replace function public.fn_reactivate_thread_on_incoming()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.direction <> 'incoming' then
    return new;
  end if;
  update public.message_threads
     set status = 'active', archived_at = null
   where source = new.source and sender_id = new.sender_id
     and status = 'archived';
  return new;
end;
$$;

drop trigger if exists trg_reactivate_thread_on_incoming on public.messages;
create trigger trg_reactivate_thread_on_incoming
  after insert on public.messages
  for each row execute function public.fn_reactivate_thread_on_incoming();

-- Backfill: archived conversations whose last message is from the person
-- (ABLAKULOV AZIZBEK, Odina Opa on 2026-10-29; the 777000 service chat is
-- hidden by its kind, not reopened).
update public.message_threads t
   set status = 'active', archived_at = null
 where t.status = 'archived'
   and t.kind = 'lead'
   and (
     select m.direction from public.messages m
      where m.source = t.source and m.sender_id = t.sender_id
        and coalesce(m.message_type, '') <> 'note'
      order by m.created_at desc, m.id desc limit 1
   ) = 'incoming';

-- ---------------------------------------------------------------------------
-- 4. get_thread_previews v2
-- ---------------------------------------------------------------------------
-- Hidden rows: the empty Instagram card stored as "[template]" (see
-- src/components/crm/messages/hiddenMessages.ts) and internal notes. They
-- never make the preview and never count as the person waiting.
create or replace function public.fn_message_is_hidden(p_source text, p_content text, p_message_type text, p_metadata jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $$
  select (p_source = 'instagram' and trim(coalesce(p_content, '')) = '[template]')
      or coalesce(p_message_type, '') = 'note'
      or coalesce(p_metadata ->> 'internal', '') = 'true'
$$;

drop function if exists public.get_thread_previews();
drop function if exists public.get_thread_preview(uuid);
drop type if exists public.thread_preview;

create type public.thread_preview as (
  id uuid,
  source text,
  sender_id text,
  sender_name text,
  sender_avatar text,
  student_id uuid,
  last_message_at timestamptz,
  unread_count integer,
  status text,
  intake_id uuid,
  last_content text,
  last_message_type text,
  last_direction text,
  last_created_at timestamptz,
  last_delivery_status text,
  last_metadata jsonb,
  assigned_to uuid,
  kind text,
  handle text,
  archived_at timestamptz,
  lead_id uuid,
  last_incoming_at timestamptz,
  last_human_out_at timestamptz
);

create function public.get_thread_previews(p_id uuid default null)
returns setof public.thread_preview
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  select t.id, t.source, t.sender_id, t.sender_name, t.sender_avatar,
         t.student_id, t.last_message_at, t.unread_count, t.status, t.intake_id,
         lm.content, lm.message_type, lm.direction, lm.created_at,
         lm.delivery_status, lm.metadata,
         t.assigned_to,
         t.kind, t.handle, t.archived_at,
         coalesce(
           (select ci.lead_id from public.communication_identities ci
             where ci.channel = t.source and ci.identifier = t.sender_id and ci.lead_id is not null
             limit 1),
           (select l.id from public.leads l
             where l.source = t.source and l.source_id = t.sender_id
             limit 1)
         ) as lead_id,
         li.created_at as last_incoming_at,
         lh.created_at as last_human_out_at
    from public.message_threads t
    -- Last visible message: the preview line.
    left join lateral (
      select m.content, m.message_type, m.direction, m.created_at,
             m.delivery_status, m.metadata
        from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
       order by m.created_at desc, m.id desc
       limit 1
    ) lm on true
    -- When the person last wrote.
    left join lateral (
      select m.created_at
        from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id
         and m.direction = 'incoming'
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
       order by m.created_at desc, m.id desc
       limit 1
    ) li on true
    -- When a PERSON on our side last answered (bot, after-hours and Meta
    -- instant replies do not count).
    left join lateral (
      select m.created_at
        from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id
         and m.direction = 'outgoing'
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
         and not public.fn_is_automatic_outgoing(m.content, m.metadata)
       order by m.created_at desc, m.id desc
       limit 1
    ) lh on true
   where p_id is null or t.id = p_id
   order by t.last_message_at desc;
$$;

create function public.get_thread_preview(p_id uuid)
returns setof public.thread_preview
language sql
stable
set search_path to 'public', 'pg_catalog'
as $$
  select * from public.get_thread_previews(p_id);
$$;

revoke all on function public.get_thread_previews(uuid) from public;
revoke all on function public.get_thread_preview(uuid) from public;
grant execute on function public.get_thread_previews(uuid) to authenticated, service_role;
grant execute on function public.get_thread_preview(uuid) to authenticated, service_role;
grant execute on function public.fn_message_is_hidden(text, text, text, jsonb) to authenticated, service_role, anon;
