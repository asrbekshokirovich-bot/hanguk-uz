# AI Voice Agent (Azure)

An AI that **answers inbound phone calls** and **places outbound calls itself**,
speaks with the caller in real time (Uzbek / Russian / Korean / English), and
logs every call into the existing Communication Intelligence pipeline so an AI
call looks exactly like a human Mediateka call in the CRM.

This is the architecture + how to run it. The code lives in `ai-voice-agent/`
(the always-on media bridge) plus two Supabase edge functions
(`ai-call-ingest`, `ai-place-call`).

---

## Why Azure

- **Azure Communication Services (ACS) — Call Automation** owns the *phone leg*:
  it answers incoming PSTN/SIP calls, dials outbound calls, and **media-streams**
  the raw audio to/from our server over a WebSocket.
- **Azure OpenAI — Realtime API** (`gpt-4o-realtime-preview`) owns the *brain*:
  speech-to-speech in one model, with server-side voice-activity detection
  (natural turn-taking, barge-in) and live transcription of both sides.

The two are bridged by a tiny always-on Node service. ACS speaks 24 kHz PCM16
mono; the Realtime API speaks the same, so audio passes through frame-for-frame
with no resampling.

```
                 inbound call                       outbound call
                      │                                   ▲
      PSTN / SIP ─────┼───────────  ACS  ────────────────┘  createCall()
                      ▼            (Call Automation)
             Event Grid: IncomingCall                 REST: answer / hangup
                      │                                   ▲
                      ▼                                   │
        ┌──────────────────────────  ai-voice-agent/ (always-on)  ─────────────┐
        │  server.mjs   Event Grid + ACS callback webhooks, /outbound trigger  │
        │  acs.mjs      answerCall / createCall with bidirectional media stream │
        │      ▲  ▼  (WebSocket, base64 PCM16 24k frames)                        │
        │  realtimeBridge.mjs  ⇄  Azure OpenAI Realtime (gpt-4o-realtime)        │
        │      │  captures both-side transcript, VAD barge-in                    │
        └──────┼─────────────────────────────────────────────────────────────────┘
               │  on CallDisconnected → POST final transcript + summary
               ▼
        ai-call-ingest (edge fn)  ──>  calls row (voip_provider='azure_ai')
               │                        + call_transcripts + call_analyses
               │                        + resolveIdentity() (student / lead link)
               ▼
        the exact same CRM timeline, CallIntelligence UI, embeddings as Mediateka
```

Outbound is triggered from the CRM: **`ai-place-call`** (JWT + role checked)
forwards `{ phone, goal, context }` to the worker's `/outbound` endpoint, which
`createCall()`s and runs the same bridge.

---

## Components

### `ai-voice-agent/` — the always-on media bridge
Node ≥20 service. Cannot be an edge function: a call holds a bidirectional
audio WebSocket open for its whole duration. Host it where the Telegram userbot
runs (Railway / Fly / Render / a small VM). Files:

| file | role |
|------|------|
| `server.mjs` | HTTP: ACS Event Grid webhook (`IncomingCall` + subscription validation), ACS call-lifecycle callbacks, the `/outbound` trigger, and the `/acs/media` WebSocket upgrade. |
| `acs.mjs` | Thin `CallAutomationClient` wrapper: `answerCall`/`createCall` with bidirectional media streaming, hangup. |
| `realtimeBridge.mjs` | One instance per call. Opens the Azure OpenAI Realtime WebSocket, configures the session (prompt, voice, server-VAD, input transcription), pumps audio both ways, forwards barge-in, and accumulates the transcript. |
| `prompt.mjs` | The agent persona + guardrails + the per-call goal/context injection. |
| `ingest.mjs` | On call end, POSTs the transcript/summary to `ai-call-ingest`. |

### `ai-call-ingest` (edge fn, `verify_jwt=false`)
Authenticated by the `AI_AGENT_INGEST_SECRET` header (same shape as
`telegram-ingest`). Given a finished call it:
1. `resolveIdentity('phone', …)` → student/lead link (persists new matches),
2. upserts a `calls` row (`voip_provider='azure_ai'`, `direction`, `status`,
   `duration`, `recording_url`),
3. writes the Realtime transcript into `call_transcripts`
   (`provider='azure_openai_realtime'`),
4. if a summary was produced, writes a `call_analyses` row; **or**, if ACS Call
   Recording produced a `recording_url`, nudges `process-call-recording` so the
   existing transcribe→analyse→embed pipeline runs verbatim.

### `ai-place-call` (edge fn, `verify_jwt=true`)
Staff-facing. Role-checked (`owner` / `admin` / `call_operator`). Accepts a
`phone` or a `leadId` / `studentId` (it looks up the number), plus a `goal` and
free-form `context`, and forwards them to the worker's `/outbound`. Returns
immediately; the call happens on the worker.

---

## Secrets

Worker (`ai-voice-agent/.env`, see `.env.example`):

| var | what |
|-----|------|
| `ACS_CONNECTION_STRING` | ACS resource connection string. |
| `ACS_CALLER_ID` | The ACS-owned E.164 number used as caller-id for outbound. |
| `PUBLIC_BASE_URL` | Public HTTPS origin of this worker (for ACS callbacks). |
| `PUBLIC_WS_URL` | Public `wss://` origin for media streaming (usually the same host). |
| `AZURE_OPENAI_ENDPOINT` | e.g. `https://<res>.openai.azure.com`. |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI key. |
| `AZURE_OPENAI_REALTIME_DEPLOYMENT` | Deployment name of a `gpt-4o-realtime` model. |
| `AZURE_OPENAI_REALTIME_VOICE` | Voice (e.g. `alloy`, `shimmer`). |
| `AGENT_SECRET` | Shared secret the edge fn presents to `/outbound`. |
| `INGEST_URL` | URL of the `ai-call-ingest` edge function. |
| `AI_AGENT_INGEST_SECRET` | Secret `ai-call-ingest` requires. |

Supabase (function secrets):

| var | on function | what |
|-----|-------------|------|
| `AI_AGENT_INGEST_SECRET` | `ai-call-ingest` | matches the worker. |
| `AI_AGENT_URL` | `ai-place-call` | the worker's public origin. |
| `AGENT_SECRET` | `ai-place-call` | matches the worker's `AGENT_SECRET`. |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are already present for edge fns.

---

## Azure one-time setup (outside this repo)

1. Create an **ACS** resource; buy/assign a **phone number** with calling
   enabled. (Note: +998 Uzbek numbers are generally **not** sold by Azure — you
   will get a foreign/toll number, **or** connect Mediateka's SIP trunk via
   **ACS Direct Routing** to keep your existing lines. See "Bridging Mediateka".)
2. Create an **Azure OpenAI** resource and **deploy** a `gpt-4o-realtime`
   model; note the deployment name.
3. Deploy `ai-voice-agent/` somewhere always-on and public over HTTPS/WSS.
4. **Event Grid**: subscribe the ACS resource's `IncomingCall` event to
   `POST {PUBLIC_BASE_URL}/acs/events` (the endpoint self-validates the Event
   Grid handshake).
5. Set the secrets above; deploy the two edge functions.

## Bridging Mediateka (optional, keeps your current numbers)

ACS **Direct Routing** can terminate a SIP trunk. If Mediateka exposes a SIP
trunk you can point calls for the AI at ACS while keeping the same DIDs, so the
AI shares the lines staff already use and the whole existing Mediateka
call-intelligence path is untouched for human calls. This is a config exercise
in Azure, not code here.

---

## Language note

The Realtime API's speech quality is strongest in English/Russian; **Uzbek**
recognition and TTS quality vary and should be validated with real callers.
`prompt.mjs` instructs the agent to open in Uzbek, mirror the caller's language,
and fall back to Russian. If Uzbek quality is insufficient, the fallback path is
ACS media streaming → **Azure AI Speech** (Uzbek STT/TTS) → a text LLM; the
bridge is structured so only `realtimeBridge.mjs` would change.

---

## Status

**Scaffold.** The code is real and structured for production, but has **not**
been run against live Azure/ACS yet — it needs the Azure resources and secrets
above. Validate the ACS media-streaming frame shape and audio format
(`Pcm24KMono`) against your ACS SDK version before going live; both are called
out in `acs.mjs`.
