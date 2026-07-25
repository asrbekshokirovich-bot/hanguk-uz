# hanguk-ai-voice-agent

Always-on service that lets an AI **answer inbound** and **place outbound**
phone calls via **Azure Communication Services**, bridged to the **Azure OpenAI
Realtime API**, and logs every call into the Hanguk CRM.

Architecture and the full data flow live in [`../AI_VOICE_AGENT.md`](../AI_VOICE_AGENT.md).
This README is just how to run it.

## What it does

- **Inbound**: Event Grid delivers `IncomingCall` → we `answerCall` with
  bidirectional media streaming → audio is bridged to a `gpt-4o-realtime`
  session → the AI talks to the caller.
- **Outbound**: `POST /outbound` (from the `ai-place-call` edge function) →
  `createCall` → same bridge, agent speaks first with a goal.
- **On hang-up**: the transcript (both sides) + metadata are POSTed to the
  `ai-call-ingest` edge function, which writes a `calls` row and transcript so
  the call shows up in the CRM like any Mediateka call.

## Run locally

```sh
cp .env.example .env      # fill in Azure + Supabase values
npm install
npm run dev               # node --env-file=.env server.mjs
```

Health check: `GET /` → `{ ok: true, live: <#active calls> }`.

To receive real calls the worker must be reachable at a **public HTTPS/WSS**
URL (`PUBLIC_BASE_URL` / `PUBLIC_WS_URL`). Locally, tunnel with e.g.
`ngrok http 8080` and set those to the tunnel URL.

## Deploy (Docker)

```sh
docker build -t hanguk-ai-voice-agent .
docker run -p 8080:8080 --env-file .env hanguk-ai-voice-agent
```

Host it anywhere always-on with a public URL (Railway / Fly / Render / a VM) —
same as `telegram-userbot/`. Provide env vars via the host, not a baked-in `.env`.

## Azure wiring (one-time)

1. ACS resource + a calling-enabled phone number (or Direct Routing to
   Mediateka — see the architecture doc).
2. Azure OpenAI resource with a **deployed** `gpt-4o-realtime` model.
3. Deploy this worker publicly.
4. Event Grid → subscribe ACS **IncomingCall** to
   `POST {PUBLIC_BASE_URL}/acs/events` (self-validates the handshake).
5. Deploy the `ai-call-ingest` and `ai-place-call` edge functions and set their
   secrets (`AI_AGENT_INGEST_SECRET`, `AI_AGENT_URL`, `AGENT_SECRET`) to match
   this worker's `.env`.

## Endpoints

| method | path | purpose | auth |
|--------|------|---------|------|
| GET  | `/`             | health | — |
| POST | `/acs/events`   | Event Grid: validation + IncomingCall | Event Grid |
| POST | `/acs/callbacks`| ACS call-lifecycle callbacks | ACS (per-call `cid`) |
| POST | `/outbound`     | place a call | `x-agent-secret` |
| WS   | `/acs/media`    | ACS bidirectional audio | per-call `cid` |

## Caveats

- **Not yet run against live Azure.** Validate the ACS `MediaStreamingOptions`
  shape and `Pcm24KMono` audio format against your installed
  `@azure/communication-call-automation` version (see comments in `acs.mjs`).
- **Uzbek** realtime quality varies; see the language note in the architecture doc.
- ACS **Call Recording** is optional; without it the CRM stores the Realtime
  transcript we captured rather than an audio file.
