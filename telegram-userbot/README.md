# Hanguk Telegram userbot

Mirrors **staff personal-account** Telegram chats into the Hanguk CRM. Students
message staff on their personal Telegram, so we log in as those accounts over
MTProto and forward every 1:1 message (incoming **and** the staff's own
outgoing replies) to the `telegram-ingest` edge function, which links each chat
to a student/lead and stores it.

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
- Mirrors text + a placeholder for media (`[photo]`, `[voice]`, …). Media file
  download/storage is a later enhancement.
- Sending replies *from the CRM* is not wired yet; staff reply in their Telegram
  app as usual and those outgoing messages are mirrored.
- You are logging into **your own** accounts to mirror **your own** business
  conversations. Keep session strings and the ingest secret confidential.
