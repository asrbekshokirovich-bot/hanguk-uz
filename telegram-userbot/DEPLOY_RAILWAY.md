# Deploy the Telegram userbot on Railway (no terminal needed)

You'll do ~10 minutes of clicking. You only ever paste secrets into Railway's
private **Variables** page — never anywhere else.

## Before you start, get 3 things
1. **Telegram api_id + api_hash** — go to <https://my.telegram.org> → log in →
   **API development tools** → create an app → copy `api_id` and `api_hash`.
2. **The ingest secret** — invent any random text (e.g. `hanguk-tg-7H2k9Q`).
   Set it in **Supabase → Edge Functions → Secrets** as `TELEGRAM_INGEST_SECRET`.
   You'll use the *same* text in Railway below.
3. **A login password** — invent another random text (guards the login page).

---

## Step 1 — Create the Railway service
1. Go to <https://railway.app> → **New Project** → **Deploy from GitHub repo** →
   pick **`hanguk-uz`**.
2. Open the service → **Settings**:
   - **Root Directory**: `telegram-userbot`
   - (Builder auto-detects the Dockerfile — nothing to change.)

## Step 2 — Add variables (Settings → Variables)
Paste these in. Start in **login mode**:

| Name | Value |
|------|-------|
| `TELEGRAM_API_ID` | your api_id |
| `TELEGRAM_API_HASH` | your api_hash |
| `INGEST_URL` | `https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/telegram-ingest` |
| `TELEGRAM_INGEST_SECRET` | the same secret you set in Supabase |
| `LOGIN_MODE` | `1` |
| `LOGIN_PASSWORD` | your login password |

Deploy.

## Step 3 — Log in (in your browser)
1. Settings → **Networking** → **Generate Domain** to get a public URL.
2. Open `https://<your-domain>/?k=<LOGIN_PASSWORD>`.
3. Enter the **phone number** of the staff Telegram account → the **code**
   Telegram texts you → the **2FA password** if it asks.
4. It shows a long **session string**. Copy it.

## Step 4 — Switch to live mode
In **Variables**:
- Add `TG_SESSION` = the session string you copied.
- Add `TG_LABEL` = a name for this account (e.g. `reception`).
- Change `LOGIN_MODE` to `0`.
- (Optional, first run only) add `BACKFILL_ON_START` = `1` to import recent
  history; remove it after the first successful run.

Redeploy. Check the **Logs** — you should see `connected as …` and
`Userbot running`. Send yourself a test message and watch it appear in the CRM
**Messages** tab.

---

## More accounts
Repeat Step 3 for each staff phone (toggle `LOGIN_MODE=1`, log in, copy session,
`LOGIN_MODE=0`). Put them all in `TG_ACCOUNTS` instead of `TG_SESSION`:
```json
[{"label":"reception","session":"1Ab..."},{"label":"dilnoza","session":"1Cd..."}]
```

## Rotating / replacing a session
Set `LOGIN_MODE=1`, log in again → new session string → paste over the old
`TG_SESSION` → `LOGIN_MODE=0` → redeploy. (Revoke old sessions any time in
Telegram → Settings → Devices.)

## Safety
- Variables in Railway are private to your project — that's the right place.
- The **session string is full access** to that account. Never paste it into
  chat, email, or code. Keep a backup in a password manager only.
- Turn `LOGIN_MODE` back to `0` after logging in so the login page is off.
