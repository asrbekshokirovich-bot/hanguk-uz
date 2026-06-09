# Voice Chat (Push‑to‑Talk) — Runbook

How the staff Voice Chat works today and how to switch on reliable audio for users
behind firewalls/NAT. For the deeper design discussion (and the LiveKit option),
see [`docs/research/livekit-1to1-ptt-intercom.md`](./research/livekit-1to1-ptt-intercom.md).

## How it works now

- **Presence ("who's online")** — driven by **Supabase Realtime Presence** on the
  `staff-presence` channel (`src/contexts/StaffPresenceContext.tsx`). It's tied to the
  live WebSocket, so a staffer shows online whenever the CRM is open and drops off the
  moment they disconnect. (The old `staff_presence` table is still written best‑effort
  for the System Health dashboard, but it no longer gates the UI.)
- **Audio** — a peer‑to‑peer WebRTC mesh (`src/hooks/useVoiceChannel.ts`) signalled over
  a Supabase Realtime channel. It uses STUN by default and **optionally a TURN relay**
  so users behind symmetric NAT / corporate firewalls can connect.

## Status

- ✅ Presence fix — **live, no config needed.**
- ✅ TURN wiring — shipped, **STUN‑only until you configure a relay** (zero‑regression).
- ✅ `turn-credentials` Edge Function — **deployed & ACTIVE**, returns STUN‑only until
  `TURN_SECRET` + `TURN_URLS` are set.

## Activate TURN (recommended: self‑hosted coturn + the Edge Function)

The Edge Function (`supabase/functions/turn-credentials`) mints **short‑lived,
auth‑gated** credentials so static secrets never ship in the browser bundle.

### 1. Stand up coturn (≈$5/mo VM)

Minimal `/etc/turnserver.conf`:

```
listening-port=3478
tls-listening-port=5349
use-auth-secret
static-auth-secret=YOUR_LONG_RANDOM_SECRET
realm=turn.yourdomain.com
external-ip=YOUR_VM_PUBLIC_IP
# TLS (the turns: port is what gets through strict corporate firewalls)
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
min-port=49152
max-port=65535
```

Open UDP/TCP 3478 and 5349 (and the 49152–65535 UDP media range) on the firewall.

### 2. Set the Edge Function secrets

Supabase → Edge Functions → `turn-credentials` → Secrets (or `supabase secrets set`):

| Secret | Value |
|---|---|
| `TURN_SECRET` | the **same** string as coturn's `static-auth-secret` |
| `TURN_URLS` | `turn:turn.yourdomain.com:3478,turns:turn.yourdomain.com:5349` |
| `TURN_TTL` | `3600` (seconds; optional, defaults to 3600) |

No function redeploy needed — it reads these at runtime. (`SUPABASE_URL` /
`SUPABASE_ANON_KEY` are provided automatically; don't set them.)

### 3. Point the frontend at the function

Set in **Vercel → Project → Settings → Environment Variables** (and local `.env`),
then **redeploy** (Vite inlines `VITE_*` at build time):

```
VITE_TURN_FUNCTION=turn-credentials
```

## Alternative: Metered (no server to run)

Skip coturn and the function entirely — use a managed TURN provider that returns
ICE servers from a URL:

```
VITE_TURN_ICE_ENDPOINT=https://<subdomain>.metered.live/api/v1/turn/credentials?apiKey=<APIKEY>
```

Simpler, but the credentials it returns are visible to the client (fine for low‑stakes
internal use). Redeploy the frontend after setting it.

## Client env var reference (all optional)

The ICE resolver in `useVoiceChannel.ts` tries these in order; with **none** set it
falls back to STUN‑only (previous behavior):

| Var | Purpose |
|---|---|
| `VITE_TURN_FUNCTION` | Name of a Supabase Edge Function returning `{ iceServers }` (most secure; auth attached automatically). |
| `VITE_TURN_ICE_ENDPOINT` | URL returning `{ iceServers }` or a bare array (e.g. Metered). |
| `VITE_TURN_URLS` | Comma‑separated TURN URL(s) for static creds. |
| `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | Static TURN username/credential (used with `VITE_TURN_URLS`). |

## Verify it's working

1. Two people (or two browser **profiles**), signed in as different staff — each should
   see the other go **online** in the Voice Chat panel within a second or two.
2. Press‑and‑hold a colleague's card to talk; release to stop.
3. To confirm TURN: open `chrome://webrtc-internals` during a call and look for `relay`
   ICE candidates (used when a direct path isn't possible). The console also logs
   `Loaded N ICE server(s) from function` / `Using static TURN server(s)`.
