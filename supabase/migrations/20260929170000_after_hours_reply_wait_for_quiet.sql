-- The after-hours automatic reply waits until the person has finished writing.
--
-- The owner's rule (2026-09-29): people often send several messages in a row
-- (three within a minute at 19:00, say). The reply must not cut in after the
-- first one. It goes out once the chat has been quiet for 2 minutes: the first
-- message starts a 2-minute wait, and every further message from them during
-- the wait starts it again. If anyone answers by hand in the meantime, no
-- automatic reply is sent at all (unchanged, see fn_after_hours_reply_claim).
--
-- lead-sla-check runs once a minute, so the reply leaves 2–3 minutes after the
-- person's last message.

alter table public.after_hours_reply_queue
  add column if not exists last_incoming_at timestamptz;

update public.after_hours_reply_queue
   set last_incoming_at = arrived_at
 where last_incoming_at is null;

-- As in 20260929150000_after_hours_reply_every_new_chat.sql, plus: a later
-- message in a chat still waiting for its reply restarts the wait.
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

  -- Still writing: push the reply back.
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

  -- Only the chat's very first message.
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

-- As in 20260929150000_after_hours_reply_every_new_chat.sql, plus: only once
-- the chat has been quiet for 2 minutes.
create or replace function public.fn_after_hours_reply_claim(p_dry boolean default false)
returns table(id uuid, source text, source_id text, reply_text text)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_dry then
    return query
    select null::uuid, q.source, q.sender_id, q.reply_text
    from public.after_hours_reply_queue q
    where q.claimed_at is null
      and q.arrived_at > now() - interval '1 day'
      and coalesce(q.last_incoming_at, q.arrived_at) <= now() - interval '2 minutes'
      and not exists (
        select 1 from public.messages m
         where m.source = q.source
           and m.sender_id = q.sender_id
           and m.direction = 'outgoing'
           and m.created_at >= q.arrived_at - interval '1 minute'
      );
    return;
  end if;

  return query
  update public.after_hours_reply_queue q
  set claimed_at = now()
  where q.claimed_at is null
    and q.arrived_at > now() - interval '1 day'
    and coalesce(q.last_incoming_at, q.arrived_at) <= now() - interval '2 minutes'
    and not exists (
      select 1 from public.messages m
       where m.source = q.source
         and m.sender_id = q.sender_id
         and m.direction = 'outgoing'
         and m.created_at >= q.arrived_at - interval '1 minute'
    )
  returning null::uuid, q.source, q.sender_id, q.reply_text;
end;
$function$;
