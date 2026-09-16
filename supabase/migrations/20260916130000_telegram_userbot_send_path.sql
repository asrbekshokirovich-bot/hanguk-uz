-- Telegram: a send path that does not need a bot connected to the account.
--
-- Why this exists
-- ---------------
-- Clients write to @hangukuz_consulting, a personal account. Telegram offers
-- exactly two ways to reach those chats from outside: connect a bot to the
-- account (Telegram Business), or sign in as the account over MTProto. We ran
-- the second, replaced it with the first on 2026-09-03, and the first turned
-- out to carry a defect of its own: with a chatbot connected, Telegram's
-- Android app opens the BOT when anyone adds the account's phone number as a
-- contact (reported as bugs.telegram.org/c/65751, not affected on Desktop).
-- Disconnecting the bot removes it; nothing else does. So the MTProto path has
-- to be a working option again rather than dead code.
--
-- Half of it already runs in production and none of it was ever committed:
-- `telegram_outbox`, `claim_telegram_outbox` and `complete_telegram_outbox`
-- were created by hand and recovered into the repo on 2026-09-03 with only the
-- edge function to show for them. This migration brings the schema itself
-- under version control, idempotently, so a fresh database matches production.
--
-- What is new here
-- ----------------
-- 1. `complete_telegram_outbox` now mirrors the outcome onto the `messages`
--    row the operator is looking at. Before, a delivered reply left the outbox
--    row marked 'sent' and the CRM row under a "sending" clock for ever — the
--    same defect send-telegram had until its own stamping was added.
-- 2. `telegram_userbot_status` records the userbot's heartbeat. The MTProto
--    session dies quietly (revoked device, changed password, a restart that
--    never came back); on 2026-07-28 it did exactly that and the inbox stayed
--    silent for a week with every status page green. A row that stops being
--    updated is something infra-health-check can alarm on.

-- ---------------------------------------------------------------- the queue
-- One row per reply the CRM wants sent as the account. The userbot polls
-- `telegram-outbox` for these; it lives behind NAT, so nothing can push to it.
create table if not exists public.telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  -- Which signed-in account should send it. Null = whichever one claims it.
  account_label text,
  chat_id text not null,
  text text,
  -- Storage path in `chat-media`; the edge function mints a signed URL per claim
  -- so the userbot never holds storage credentials.
  media_path text,
  media_mime text,
  media_filename text,
  reply_to_msg_id bigint,
  -- pending -> sending -> sent | failed
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  tg_message_id bigint,
  requested_by uuid,
  -- The `messages` row this reply belongs to, so the outcome can be mirrored back.
  message_id uuid,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);

comment on table public.telegram_outbox is
  'Replies queued for the MTProto userbot to send as the company account. Polled via the telegram-outbox edge function; nothing can reach the userbot inbound.';

-- The claim query orders pending rows by age, so this is the index it wants.
create index if not exists telegram_outbox_pending_idx
  on public.telegram_outbox (status, created_at)
  where status = 'pending';

create index if not exists telegram_outbox_message_idx
  on public.telegram_outbox (message_id);

-- Service role only: the edge functions read and write it, no client has any
-- reason to see a queue of outgoing messages.
alter table public.telegram_outbox enable row level security;

-- ------------------------------------------------------------- the heartbeat
-- One row per signed-in account. The userbot touches `last_seen_at` on a timer;
-- infra-health-check alarms when it goes stale. Absence of a row means the
-- userbot has never run, which is also worth seeing.
create table if not exists public.telegram_userbot_status (
  account_label text primary key,
  tg_user_id text,
  username text,
  -- Bumped on every heartbeat. This is the whole point of the table.
  last_seen_at timestamptz not null default now(),
  -- Free text from the process: version, last error, whatever helps diagnose.
  detail text,
  created_at timestamptz not null default now()
);

comment on table public.telegram_userbot_status is
  'Liveness of the MTProto userbot, one row per signed-in account. A stale last_seen_at is how a dead session becomes visible instead of a silent inbox.';

alter table public.telegram_userbot_status enable row level security;

-- ------------------------------------------------------------------- claim
-- Hand out pending rows, marking them 'sending' in the same statement so two
-- workers cannot take the same row. `for update skip locked` is what makes
-- that safe under concurrency.
create or replace function public.claim_telegram_outbox(
  p_account_label text default null,
  p_limit integer default 10
)
returns setof public.telegram_outbox
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Reap rows abandoned in flight before handing out new work.
  --
  -- A worker that dies between claiming a row and reporting on it leaves that
  -- row 'sending' for ever: claim only ever looks at 'pending', so nothing
  -- would touch it again and the operator's reply would sit under a clock that
  -- never resolves. Giving up on it is deliberately the choice rather than
  -- retrying: the message may well have reached Telegram before the worker
  -- died, and sending a client the same answer twice is worse than telling
  -- staff to resend one. Ten minutes is far past the seconds a real send takes.
  --
  -- Nothing is written to `messages` here. The `trg_propagate_outbox_delivery`
  -- trigger already carries a row going 'failed' across, and it guards on
  -- `delivery_status is distinct from 'sent'`, so a reply that did reach
  -- Telegram before the worker died is left showing as delivered.
  update public.telegram_outbox o
     set status     = 'failed',
         last_error = 'Telegram userbot stopped before confirming this reply — send it again'
   where o.status = 'sending'
     and o.claimed_at < now() - interval '10 minutes';

  return query
  update public.telegram_outbox o
     set status     = 'sending',
         claimed_at = now(),
         attempts   = o.attempts + 1
   where o.id in (
     select i.id
       from public.telegram_outbox i
      where i.status = 'pending'
        and (p_account_label is null
             or i.account_label is null
             or i.account_label = p_account_label)
      order by i.created_at
        for update skip locked
      limit greatest(1, least(p_limit, 100))
   )
  returning o.*;
end;
$function$;

-- ---------------------------------------------------------------- complete
-- Record the outcome, and stamp the external id onto the CRM row.
--
-- Delivery status itself is already handled by two existing triggers, and this
-- deliberately does not fight them: `trg_propagate_outbox_delivery` moves a row
-- to 'sent' or 'failed' as the queue row changes, and
-- `trg_resolve_delivery_status` flips an outgoing message to 'sent' the moment
-- it gains an external id.
--
-- What no trigger does is give the row an external id, and without one the
-- reply is stored twice. The userbot sees its own outgoing message and posts it
-- to telegram-ingest, which de-dupes on `<chat_id>:<message_id>`; with our row
-- carrying no external id that lookup misses and the echo inserts a second copy
-- of the same reply into the thread. Stamping it here is what closes that.
--
-- The other gap is a failure that still has attempts left: the queue row goes
-- back to 'pending', not 'failed', so the propagate trigger stays silent and
-- the operator would see a clock with no explanation behind it.
create or replace function public.complete_telegram_outbox(
  p_id uuid,
  p_ok boolean,
  p_tg_message_id bigint default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.telegram_outbox;
  v_external_id text;
begin
  update public.telegram_outbox
     set status        = case
                           when p_ok then 'sent'
                           when attempts >= 5 then 'failed'
                           else 'pending'
                         end,
         tg_message_id = coalesce(p_tg_message_id, tg_message_id),
         last_error    = case when p_ok then null else p_error end,
         sent_at       = case when p_ok then now() else sent_at end
   where id = p_id
  returning * into v_row;

  -- No such row, or a queue entry with no CRM row behind it: nothing to mirror.
  if v_row.id is null or v_row.message_id is null then
    return;
  end if;

  if not p_ok then
    -- Out of attempts is the propagate trigger's business. This is the other
    -- case: still retrying, so the row stays under a clock, and the reason it
    -- is taking another go is worth showing rather than hiding.
    if v_row.status <> 'failed' then
      update public.messages
         set delivery_error = p_error
       where id = v_row.message_id
         and delivery_status is distinct from 'sent';
    end if;
    return;
  end if;

  -- A success reported without a Telegram message id leaves nothing to key the
  -- echo on. That is worth surviving rather than writing a null external id:
  -- the reply is still delivered, it just cannot be de-duplicated.
  v_external_id := case
    when coalesce(p_tg_message_id, v_row.tg_message_id) is not null
    then v_row.chat_id || ':' || coalesce(p_tg_message_id, v_row.tg_message_id)::text
  end;

  begin
    update public.messages
       set external_id     = coalesce(v_external_id, external_id),
           delivery_status = 'sent',
           delivery_error  = null
     where id = v_row.message_id;
  exception when unique_violation then
    -- The echo got there first and already wrote this message. Ours is the
    -- redundant copy, so it goes rather than sitting in the thread twice.
    delete from public.messages
     where id = v_row.message_id
       and external_id is null;
  end;
end;
$function$;
