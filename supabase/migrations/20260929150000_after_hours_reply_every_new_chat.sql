-- The after-hours automatic reply goes to every chat that writes to us for the
-- first time, not only to brand-new leads.
--
-- The owner's rule (2026-09-29): somebody we already know from another channel
-- — say an old Instagram contact whose phone matches a Telegram account — who
-- writes on Telegram for the first time off hours gets the reply too. They are
-- not a new lead (20260924080000_new_lead_is_new_chat.sql), so they do not land
-- in "Yangi lid" and get no countdown; they only get the text.
--
-- 20260929120000_lead_after_hours.sql picked the recipients from new leads, so
-- that person got nothing. Now the first incoming message of a chat queues the
-- reply (trg_queue_after_hours_reply), and fn_after_hours_reply_claim hands the
-- queue to lead-sla-check, which sends it as before. A new lead's first message
-- is such a message too, so new leads are still covered, exactly once.
--
-- A first message counts when it is:
--   * incoming, on Telegram or Instagram, and not an Instagram comment;
--   * on Telegram, in a private chat with the account, or through the Business
--     connection — never a group, and never a chat with the bot (the bot sends
--     its own welcome);
--   * the chat's first message of all, and live (a backfill of an old chat is
--     not a first contact);
--   * off hours (fn_after_hours_reply_text is not null).

create table if not exists public.after_hours_reply_queue (
  source      text        not null,
  sender_id   text        not null,
  arrived_at  timestamptz not null,
  reply_text  text        not null,
  claimed_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (source, sender_id)
);

alter table public.after_hours_reply_queue enable row level security;
revoke all on table public.after_hours_reply_queue from anon, authenticated;

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

  insert into public.after_hours_reply_queue (source, sender_id, arrived_at, reply_text)
  values (new.source, new.sender_id, new.created_at, v_text)
  on conflict (source, sender_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_queue_after_hours_reply on public.messages;
create trigger trg_queue_after_hours_reply
  after insert on public.messages
  for each row execute function public.fn_queue_after_hours_reply();

-- Same shape as before, so lead-sla-check is unchanged: each queued chat is
-- handed out once, stamped before sending. A chat somebody has already
-- answered by hand is skipped (and stays unclaimed, so it is never sent).
drop function if exists public.fn_after_hours_reply_claim(boolean);
create function public.fn_after_hours_reply_claim(p_dry boolean default false)
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

revoke all on function public.fn_after_hours_reply_claim(boolean) from public, anon, authenticated;
grant execute on function public.fn_after_hours_reply_claim(boolean) to service_role;
