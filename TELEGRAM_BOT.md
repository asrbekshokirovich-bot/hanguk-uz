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
