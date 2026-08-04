-- Telegram Business: let the bot serve the company's own account.
--
-- Clients write to @hangukuz_consulting, a personal account, not to the bot.
-- The Bot API cannot see those chats at all, so none of it reached the inbox.
-- The workaround was `telegram-userbot`, an MTProto process signed in as the
-- account and mirroring its chats — unofficial, session-expiring, and hosted
-- outside this project on Railway. It stopped on 2026-07-28 and nothing here
-- could tell: no error, no missing secret, just an inbox that went quiet for a
-- week while the Integrations page stayed green.
--
-- Telegram Business (a Premium feature, which this account has) is the
-- supported path. The owner links the bot to their account once; Telegram then
-- delivers `business_message` updates to the same webhook and accepts
-- `business_connection_id` on sendMessage, so replies leave as the account
-- rather than as a bot. No always-on process to die quietly.
--
-- This table holds the link. One row per connected account.

create table if not exists public.telegram_business_connections (
  -- Telegram's connection id. It is what sendMessage needs, so it is the key.
  id text primary key,
  -- The account the bot now answers for.
  user_chat_id text not null,
  owner_user_id text,
  owner_username text,
  -- Telegram flips these when the owner pauses the bot or narrows its rights;
  -- both must hold before we try to send as the account.
  is_enabled boolean not null default true,
  can_reply boolean not null default false,
  -- The whole BusinessConnection object, so a field Telegram adds later is not
  -- lost before the schema catches up.
  raw jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.telegram_business_connections is
  'Bots linked to a Telegram Business account. Carries the business_connection_id that lets send-telegram reply as the account instead of as the bot.';

create index if not exists telegram_business_connections_chat_idx
  on public.telegram_business_connections (user_chat_id);

-- Only the service role touches this: the webhook writes it, send-telegram
-- reads it. No client has any reason to see a connection id — it authorises
-- sending as the company.
alter table public.telegram_business_connections enable row level security;
