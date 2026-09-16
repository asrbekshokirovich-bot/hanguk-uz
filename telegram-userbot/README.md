# Hanguk Telegram userbot

Carries the CRM's Telegram traffic for a **personal account** — the company
account or a staff one — in both directions, by signing in as that account over
MTProto.

| Direction | What happens |
|---|---|
| Inbound | Every 1:1 message, incoming and the account's own replies, is POSTed to `telegram-ingest`, which links the chat to a student/lead and stores it. |
| Outbound | Replies written in the CRM inbox are claimed from the `telegram-outbox` queue and sent **as the account**. |
| Liveness | A heartbeat every minute, so a dead session shows up as an alert instead of a silent inbox. |

**Why not a bot.** Telegram's supported route, a chatbot connected via Telegram
Business, makes Telegram's Android app open the **bot** when anyone adds the
account's phone number as a contact
([bugs.telegram.org/c/65751](https://bugs.telegram.org/c/65751)). Disconnecting
the bot is the only cure, and then the Bot API cannot see those chats at all.
No bot is connected on this path. See [`../TELEGRAM_BOT.md`](../TELEGRAM_BOT.md)
for the full comparison and the switch-over order.

> This is an **always-on** process and **cannot** run as a Supabase Edge
> Function (it needs a persistent connection). Host it on a small VM / Railway /
> Fly.io / Render / a `systemd` service.

> **Easiest path: Railway, no terminal needed → see [`DEPLOY_RAILWAY.md`](./DEPLOY_RAILWAY.md).**
> It uses the built-in browser login (`LOGIN_MODE=1`) so you log in from a web
> page instead of a command line. The rest of this README is the CLI route.

## How it links chats to students
`telegram-ingest` resolves each chat via the identity spine:
1. an existing `(telegram, user_id)` mapping, else
2. the contact's **phone** (if visible) matched against a known student/lead —
   and it remembers the mapping, so it's instant next time, else
3. left unlinked for staff to attach in the CRM (Messages → ⋯ → **Link to Student**).

Because most students are saved contacts (their phone is already in the CRM),
the majority of chats link automatically.

## Setup

### 1. Telegram API credentials
Create an app at <https://my.telegram.org> → **API development tools**. Copy the
**api_id** and **api_hash**.

### 2. Configure
```bash
cd telegram-userbot
cp .env.example .env
npm install
# fill in TELEGRAM_API_ID, TELEGRAM_API_HASH, INGEST_URL, TELEGRAM_INGEST_SECRET
```
Set the **same** `TELEGRAM_INGEST_SECRET` here and on the Supabase function
(Supabase → Edge Functions → secrets).

Sending needs no extra variable: the queue endpoint is derived from
`INGEST_URL`, because a second URL can only ever be wrong if it differs from
the first. Override it with `OUTBOX_URL` only if they really are on different
hosts. Two more knobs exist and rarely need touching:

| Variable | Default | What it does |
|---|---|---|
| `OUTBOX_POLL_MS` | `3000` | How often the send queue is polled. |
| `HEARTBEAT_MS` | `60000` | How often liveness is reported. Keep it well under the 5-minute staleness threshold that `send-telegram` and `infra-health-check` both use. |

For the CRM to route replies here at all, set `TELEGRAM_SEND_VIA_USERBOT=1` in
the Supabase function secrets. Until then `send-telegram` keeps using the Bot
API and this queue stays empty.

### 3. Log in each staff account (one-time)
```bash
npm run login
```
Enter the phone, the code Telegram sends, and the 2FA password (if any). It
prints a **session string** — paste it into `.env` as `TG_SESSION` (single
account) or into `TG_ACCOUNTS` (multiple). Sessions are **credentials** — store
them as secrets, never commit them.

### 4. (Optional) Backfill recent history, once
```bash
npm run backfill   # imports recent messages from your chats, then runs live
```
Tune `BACKFILL_DIALOGS` / `BACKFILL_LIMIT` in `.env`.

### 5. Run
```bash
npm start
```

## Multiple accounts
Set `TG_ACCOUNTS` (JSON, takes precedence over `TG_SESSION`):
```json
[
  {"label":"reception","staffUserId":null,"session":"1Ab..."},
  {"label":"dilnoza","staffUserId":"<profiles.user_id>","session":"1Cd..."}
]
```

## Deploy (Docker)
```bash
docker build -t hanguk-userbot .
docker run -d --restart=always --env-file .env --name hanguk-userbot hanguk-userbot
```
On Railway/Fly/Render: deploy this folder, set the env vars in the dashboard
(don't ship `.env`), no exposed ports needed.

## Scope & notes
- **1:1 chats only** — groups, channels, bots and Saved Messages are skipped.
- Mirrors text and **voice messages**: a voice note's audio is downloaded and
  inlined (base64, capped at 10MB) on the event; `telegram-ingest` stores it in
  the private `chat-media` bucket so staff can play it back in the CRM. Other
  media (photos, documents, video) is still mirrored as a placeholder
  (`[photo]`, `[document]`, …) — download for those is a later enhancement.
- Sending replies *from the CRM* is not wired yet; staff reply in their Telegram
  app as usual and those outgoing messages are mirrored.
- You are logging into **your own** accounts to mirror **your own** business
  conversations. Keep session strings and the ingest secret confidential.
