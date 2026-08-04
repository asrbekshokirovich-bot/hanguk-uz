# Hanguk Telegram Bot + CRM Integration

A Telegram bot for **Hanguk Education** that greets prospective students, captures
them as **leads** in the CRM, and logs every conversation into the CRM's unified
inbox. Staff reply from the CRM — the bot does **not** auto-answer questions with
AI (human-only by design).

## What it does

```
Prospective student ──▶ Telegram bot ──▶ telegram-webhook (Edge Function)
                                              │
                            ┌─────────────────┼──────────────────────┐
                            ▼                 ▼                      ▼
                      leads table       messages table        canned reply
                    (CRM > Leads)    (CRM > Messages inbox)   (welcome / ack)
                                              │
   Staff reply in CRM inbox ──▶ send-telegram (Edge Function) ──▶ Telegram user
```

1. **Lead capture** — every Telegram user becomes a row in `leads`
   (`source = 'telegram'`, deduplicated by Telegram user id), enriched with their
   phone number (one-tap "share contact" button) and area of interest
   (Bachelor's / Master's / Korean course / GKS scholarship).
2. **Unified inbox** — every incoming message is written to `messages` /
   `message_threads`, so it shows up live in **CRM → Messages**.
3. **Human replies** — when staff reply in the inbox, `MessagesContext` calls the
   `send-telegram` function, which delivers the message back to the user.
4. **Canned funnel only** — the bot sends a welcome on `/start`, asks for a phone
   number, and acknowledges interests. It never answers free-form questions
   automatically; a consultant handles those from the CRM.

Supported canned languages: **Uzbek** (default) and **Russian** (`/ru`, `/uz`).

## Edge Functions

| Function | Direction | Auth | Purpose |
|----------|-----------|------|---------|
| `telegram-webhook` | Telegram → CRM | public (`verify_jwt = false`) | Receives updates, logs to inbox, captures leads, sends canned replies |
| `send-telegram` | CRM → Telegram | staff JWT (checked in-function) | Sends staff replies; requires `owner`/`admin`/`call_operator` role |
| `_shared/telegram.ts` | — | — | Shared Bot API helpers (sendMessage, keyboards) |

## One-time setup

### 1. Create the bot
In Telegram, talk to [@BotFather](https://t.me/BotFather) → `/newbot` → copy the
**bot token**.

### 2. Store the token as a Supabase secret
```bash
supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC-..."
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already configured for the
project.

### 3. Deploy the functions
```bash
supabase functions deploy telegram-webhook
supabase functions deploy send-telegram
```
(Or let the Lovable/Supabase pipeline deploy them.)

### 4. Register the webhook with Telegram
```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-..."
export SUPABASE_PROJECT_REF="lysjdtyanhdfphqyijsr"   # see .env (VITE_SUPABASE_PROJECT_ID)
./scripts/telegram-bot.sh set-webhook
./scripts/telegram-bot.sh set-commands   # optional: registers /start, /help, /ru
```

### 5. Test
Open the bot in Telegram, press **Start**. You should see the welcome message,
a new lead appears under **CRM → Leads**, and the conversation appears under
**CRM → Messages**. Reply from the inbox and confirm it arrives in Telegram.

## How leads are mapped

| Lead field | Source |
|------------|--------|
| `full_name` | Telegram first + last name (falls back to `@username`) |
| `source` | `'telegram'` |
| `source_id` | Telegram user id (dedup key) |
| `phone` | Shared via the "share contact" button |
| `preferred_program` | Chosen interest button |
| `how_heard` | `'Telegram bot'` |
| `status` | `'new'` |

The inbox thread and the lead share the Telegram id (`message_threads.sender_id`
== `leads.source_id`), so staff can correlate them by phone/name.

## The company account (Telegram Business)

Most clients do not write to the bot. They write to **@hangukuz_consulting**,
the company's own Telegram account — and the Bot API cannot see those chats at
all. That is the gap `telegram-userbot` was filling: an MTProto process signed
in as the account, mirroring its chats. Unofficial, session-expiring, hosted off
this project, and when it stopped on 2026-07-28 nothing here could tell.

Telegram Business is the supported route, and the account already has the
Premium it requires.

### One-time setup

1. In Telegram, on the **company account**: Settings → **Telegram Business** →
   **Chatbots**.
2. Enter the bot's username and enable **Reply to messages** — without that
   right the bot can read the chats but not answer them.
3. In the CRM: Settings → Integrations → Telegram → **Connect**. This
   re-registers the webhook including the `business_*` update types.

Step 3 is not optional after step 2. Telegram delivers only the update types the
webhook registration asked for, and `business_message` is **not** in the default
set — a webhook registered before this existed receives `message` only, looks
entirely healthy, and never sees a single message sent to the company account.
The status card reports this as `business_updates_subscribed`.

### What it does

- Messages to the company account arrive in the inbox as normal Telegram
  messages, so no CRM screen changes.
- Replies from staff on their own phone arrive too, marked outgoing — the CRM
  shows the whole conversation rather than half of it.
- Replies sent from the CRM leave **as the account**, so they land in the
  conversation the client is actually reading. `send-telegram` looks up the
  connection id stamped on the chat's last business message; with no connection,
  or one that is disabled or read-only, it falls back to sending as the bot.

`telegram-userbot/` stays in the repo for now but is no longer the intended
path. Once Business is confirmed working, that Railway process can be retired.

## When the inbox goes quiet

Telegram stopping is silent by design: nothing errors, the endpoint keeps
answering 200, and the inbox simply stops filling. It went unnoticed for weeks
once. Check in this order.

**1. Is Telegram still delivering to us?**

```
GET  /functions/v1/telegram-webhook?action=status     (staff JWT required)
```

Asks Telegram's own `getWebhookInfo` and reports what it says:

| Field | Meaning |
|---|---|
| `registered_url` | Where Telegram is currently delivering. `null` = nowhere. |
| `matches` | Whether that equals this function's URL. |
| `pending_update_count` | Updates Telegram is holding because delivery is failing. |
| `last_error_message` | Why the last delivery failed. |

`matches: false` or `registered_url: null` is the whole problem. Re-register:

```
POST /functions/v1/telegram-webhook   {"action":"register"}   (staff JWT required)
```

Both actions use the `TELEGRAM_BOT_TOKEN` the function already holds, so the
token never has to leave Supabase. Neither can be reached by a Telegram update —
updates carry no `Authorization` header, and both branches require a staff role.

The plain `GET` (no `action`) reports only `configured: true/false`, which says
the token exists and **nothing** about whether messages are arriving. It answers
200 during a total outage; do not read it as a health check.

**2. Is the userbot alive?**

Most inbound traffic does not come through this bot at all — it comes through
`telegram-userbot/`, which mirrors staff personal Telegram accounts and posts to
`telegram-ingest`. It is an always-on process on Railway, **not** a Supabase
function, so nothing in this project reports it being down. If `messages` has
rows with `external_id` shaped `chatId:messageId`, that is the userbot's, and a
gap in them means that process stopped. See `telegram-userbot/DEPLOY_RAILWAY.md`.

**3. Did a reply actually leave?**

`send-telegram` returns a real error on failure. The CRM surfaces it and removes
the optimistic row, so a message left in the thread is one Telegram accepted.
Before, the inbox marked replies `replied` regardless — undelivered replies were
indistinguishable from delivered ones, and 398 outbound rows from that period
cannot be trusted.

## Security notes

- `telegram-webhook` is public so Telegram can reach it; it only writes data and
  sends canned replies.
- `send-telegram` validates the caller's Supabase session and requires a staff
  role before sending anything as the business, preventing anonymous abuse.

## Future: AI auto-replies

The platform already has an AI brain (`hanguk-ai-chat`). To let the bot answer
automatically, bridge `telegram-webhook` → `hanguk-ai-chat` for free-form
messages and add a per-chat "human took over" pause flag. This was intentionally
left out (the bot is human-only for now).
