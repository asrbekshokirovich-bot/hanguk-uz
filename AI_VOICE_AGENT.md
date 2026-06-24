# AI Voice Agent — Architecture & Plan

A conversational AI that **answers incoming phone calls** and **places outbound
calls itself**, talking to the caller in **Uzbek** (and Russian), using
**Azure AI Speech** for speech‑to‑text + text‑to‑speech, your existing
**Mediateka** PBX for the phone line, and your existing **Gemini** LLM as the
brain.

This document is the design + roadmap. **Nothing here is built yet** — it is the
plan we agreed to write before any code. Decisions in this session:

- **Azure's role:** Speech only (STT + TTS). Telephony stays on Mediateka; the
  brain stays on Gemini.
- **First deliverable:** this document.
- **Target:** a working **end‑to‑end tech demo** (prove the loop), not a
  production rollout.

It extends the roadmap in `COMMUNICATION_INTELLIGENCE.md` — think of it as
**Phase 6: the agent that *speaks*, not just *listens*.**

---

## 1. What we already have (and reuse for free)

The current system is **passive call intelligence**: it analyses a call *after*
the humans hang up.

| Piece | What it does | Reused by the voice agent as… |
|-------|--------------|-------------------------------|
| `voip-webhook` | Receives Mediateka call **events** (`cmd=event/history/contact`) → upserts the `calls` row, resolves identity | Still logs every AI call; `cmd=contact` already returns the caller's name |
| `_shared/identity.ts` `resolveIdentity()` | (channel, phone) → student/lead, persists the mapping | The agent's **"who is calling?"** lookup — same spine |
| `calls` table | One row per call (direction, status, duration, recording_url, student/lead) | The agent's calls land here too |
| `process-call-recording` + `_shared/recording.ts` | Post‑call: fetch recording (Mediateka key) → ElevenLabs Uzbek transcript → Gemini analysis → embeddings | Runs unchanged on AI calls → **free summary/intent/sentiment of every AI call** |
| `mediateka-recording` | Auth'd proxy that streams a call's MP3 to staff | Listen back to AI calls in the CRM |
| `hanguk-ai-chat` | Retrieval‑augmented Gemini brain over student data | The agent's **knowledge tool** ("what's this student's status / next deadline?") |
| `telegram-userbot/` | An **always‑on, off‑platform** worker (Node + Docker + Railway) that Edge Functions can't be | The **deployment precedent** for the new voice gateway (see §4) |

**Key insight:** the only genuinely new capability is the **real‑time** part —
talking *during* a live call. Everything around it (identity, logging, post‑call
analysis, CRM knowledge) already exists.

---

## 2. The core challenge: live media

Today `voip-webhook` sees two things, both **too late** for a conversation:

1. Call **events** (a call started / ended) — control‑plane signalling.
2. A **recording URL** — only after the call completes.

A conversation needs the **live, bidirectional audio stream** (RTP) of the call,
in real time, with sub‑second turnaround. That has two hard consequences:

- **Supabase Edge Functions cannot host the media loop.** They are stateless,
  short‑lived, HTTP‑only, and have no UDP/RTP or long‑lived socket budget. They
  stay the **control plane** (start a call, log a turn) — never the media plane.
- We need a new **always‑on AI Voice Gateway** — exactly the shape of the
  existing `telegram-userbot` (persistent process, its own host). This is the
  one substantial new component.

The good news: **Mediateka is a SIP PBX** (`hanguk.sip.uz`). SIP/RTP *can* be
bridged live. A post‑call recording URL never could.

---

## 3. Target architecture

```
                         ┌──────────────────────── PSTN ────────────────────────┐
   Lead / Student  ☎ ───►│   Mediateka cloud PBX  (hanguk.sip.uz, SIP/RTP)       │◄─── ☎ AI dials out
                         └───────────────┬───────────────────────┬──────────────┘
                       inbound: dialplan │                       │ outbound: SIP INVITE
                       routes a DID/queue │                       │ (or PBX "originate" API)
                       to the AI extension▼                       ▼
        ┌───────────────────────────────────────────────────────────────────────────┐
        │             AI VOICE GATEWAY   (always‑on, off‑platform — §4)              │
        │                                                                             │
        │   SIP UA + RTP  ◄──── 8 kHz μ‑law ────►  audio bridge / resampler           │
        │        │                                      │            ▲                │
        │        │ caller speech (PCM 16 kHz)           │            │ agent speech    │
        │        ▼                                      ▼            │ (μ‑law 8 kHz)    │
        │  ┌──────────────┐   partial+final text  ┌──────────────────────────┐         │
        │  │ Azure STT    │ ────────────────────► │  Conversation Orchestrator│         │
        │  │ uz‑UZ stream │                        │  - endpointing / barge‑in │         │
        │  │ PushAudioIn  │                        │  - Gemini 2.5 (the brain) │         │
        │  └──────────────┘                        │  - tools → Supabase (§6)  │         │
        │        ▲                                  └─────────┬────────────────┘         │
        │        │ TTS audio (μ‑law 8 kHz)                    │ reply text (SSML)         │
        │  ┌──────────────┐                                   ▼                          │
        │  │ Azure TTS    │ ◄─────────────────────────────────┘                          │
        │  │ uz‑UZ‑Madina │                                                              │
        │  └──────────────┘                                                              │
        └───────────────┬───────────────────────────────────────────┬──────────────────┘
                        │ control‑plane (HTTPS)                       │ live session + turn logs
                        ▼                                             ▼
            voip-webhook  ──►  calls row  ──►  process-call-recording   ai_call_sessions / turns
            (events, recording)   (post‑call analysis, unchanged)        (new — §5)
```

**Two control directions, one media loop:**

- **Inbound (answer):** a Mediateka dial‑plan rule routes a chosen DID / queue /
  extension to the AI's SIP extension. The gateway answers and the loop runs.
- **Outbound (call out):** staff/automation hits an Edge Function
  (`ai-call-initiate`); the gateway originates a call (SIP `INVITE` via the
  trunk, or Mediateka's "originate" API) and, on answer, runs the same loop.

The media loop itself is identical in both directions — only *who starts the
call* differs.

---

## 4. Where each part runs (and why)

| Component | Runs as | Why there |
|-----------|---------|-----------|
| **AI Voice Gateway** (SIP/RTP + Azure STT/TTS + Gemini orchestration) | **Always‑on service** (Docker on Railway / Fly / a small VM) — same pattern as `telegram-userbot/` | Needs persistent UDP/RTP + sockets + the Azure Speech SDK. Edge Functions can't. |
| `ai-call-initiate` | New Supabase **Edge Function** | Staff‑facing, JWT + role‑checked trigger to start an outbound AI call. Hands the job to the gateway. |
| `ai-call-events` | New Supabase **Edge Function** | Gateway → CRM: persist session start/end, per‑turn transcript, tool calls, outcome. (`x-ingest-secret`, like `telegram-ingest`.) |
| `voip-webhook` | **Existing** Edge Function | Unchanged; keeps logging call state + firing post‑call analysis. |
| Azure Speech | **Azure cloud**, called from the gateway | STT + TTS only (the agreed scope). |
| Gemini | **Google cloud**, called from the gateway | The brain (existing `GEMINI_API_KEY`). |

### Build vs. buy the SIP↔audio bridge

Writing raw SIP + RTP + jitter buffering by hand is a project in itself. Three
options, cheapest‑effort first:

1. **jambonz** (recommended) — open‑source voice‑AI platform purpose‑built for
   *"SIP call ⇄ your speech vendor ⇄ your LLM."* It speaks SIP to Mediateka,
   has **first‑class Azure STT/TTS connectors**, and calls a **custom LLM**
   webhook (Gemini). It collapses most of the gateway box into config + a small
   webhook app. Self‑host (Docker) or cloud.
2. **FreeSWITCH / Asterisk (ARI) + `mod_audio_fork`/`mod_azure`** — maximum
   control, more ops burden. Pick this only if jambonz can't meet a constraint.
3. **Raw SIP UA library** (`drachtio`, `sip.js`, `pjsip`) + hand‑rolled RTP —
   most flexible, most code. Avoid unless 1 and 2 are ruled out.

> For the **demo** we can skip SIP entirely first (Phase 0 below) and add it once
> the speech‑to‑speech brain is proven.

---

## 5. Data model additions

Reuse `calls` for the call record; add tables for the **agent's** view of the
conversation. Migration sketch (Postgres / Supabase):

```sql
-- A single AI-handled call session (1:1 with a calls row when telephony is live)
create table ai_call_sessions (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid references calls(id) on delete set null,
  direction       text not null check (direction in ('inbound','outbound')),
  student_id      uuid references profiles(user_id),
  lead_id         uuid references leads(id),
  phone_number    text,
  language        text default 'uz-UZ',
  status          text not null default 'active'   -- active|completed|failed|no_answer|handoff
                    check (status in ('active','completed','failed','no_answer','handoff')),
  outcome         text,                            -- short machine label: 'booked','callback','not_interested'…
  summary         text,                            -- filled post-call (reuse the analysis pipeline)
  started_at      timestamptz default now(),
  ended_at        timestamptz,
  meta            jsonb default '{}'::jsonb,        -- latency stats, model versions, gateway id
  created_at      timestamptz default now()
);

-- Turn-by-turn transcript as the conversation happens
create table ai_call_turns (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references ai_call_sessions(id) on delete cascade,
  seq         int  not null,
  role        text not null check (role in ('user','agent','system','tool')),
  text        text,
  tool_name   text,                               -- when role='tool'
  tool_args   jsonb,
  latency_ms  int,                                -- STT/LLM/TTS timing for tuning
  at          timestamptz default now()
);

-- Optional, for outbound campaigns / reminder runs (Phase 2+)
create table ai_call_tasks (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,                     -- 'lead_followup'|'payment_reminder'|'appointment'
  lead_id      uuid references leads(id),
  student_id   uuid references profiles(user_id),
  phone_number text not null,
  goal         text,                              -- natural-language objective for the agent
  scheduled_at timestamptz,
  status       text not null default 'queued',    -- queued|calling|done|failed|cancelled
  session_id   uuid references ai_call_sessions(id),
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);
```

RLS mirrors the existing `calls` policies (owner/admin/assigned staff read;
service‑role writes from the gateway/edge functions). `calls.voip_provider`
gains the value `'ai'` (or add a boolean `ai_handled`) so AI calls are filterable
in the existing call list.

---

## 6. The conversation (brain + tools)

The orchestrator runs a tight real‑time loop per call:

1. **STT (Azure, streaming):** `PushAudioInputStream`, continuous recognition,
   locale **`uz-UZ`** (optionally auto‑detect `uz-UZ` + `ru-RU`). Use **partial**
   results for **barge‑in** (stop talking when the caller starts) and **finals**
   for the LLM turn. A short **endpointing** silence (~500–700 ms) closes a turn.
2. **LLM (Gemini):** system prompt + rolling transcript + **tools**. Keep replies
   short and spoken‑style. Tools are thin HTTPS calls to Supabase:
   - `identify_caller(phone)` → `resolveIdentity` (name, student/lead, status).
   - `get_student_brief(id)` → reuse `hanguk-ai-chat` retrieval (deadlines, docs,
     last contact).
   - `book_or_route(...)` / `create_task(...)` / `log_outcome(...)`.
   - `handoff_to_human()` → transfer the SIP leg to a staff extension.
3. **TTS (Azure, streaming):** `SpeakSsmlAsync`, voice **`uz-UZ-MadinaNeural`**
   (or `uz-UZ-SardorNeural`), output format **`raw-8khz-8bit-mono-mulaw`** so it
   drops straight onto the RTP leg with no transcoding. Stream audio out as it's
   synthesised to cut perceived latency.

**System prompt skeleton** (Uzbek‑first, identity‑aware, honest about being AI):

> You are Hanguk's AI assistant calling on behalf of a Korean‑education
> consultancy in Uzbekistan. Speak natural, warm Uzbek; switch to Russian if the
> caller does. Say you're an AI assistant if asked. Keep turns short. Use tools to
> look up the caller and their status before answering specifics. Never invent
> deadlines, prices, or admissions facts — if unsure, offer a human callback.

**Latency budget** (target end‑of‑caller‑speech → first agent audio **< ~1.5 s**):
native 8 kHz μ‑law in/out (no resample tax where avoidable), streaming STT,
streaming TTS, partial‑result barge‑in, and a fast Gemini model for turns.

---

## 7. Secrets / config

Already present: `GEMINI_API_KEY`, `MEDIATEKA_API_KEY`, `MEDIATEKA_WEBHOOK_SECRET`,
`ELEVENLABS_API_KEY`, the `SUPABASE_*` set.

New:

| Secret | Where | Purpose |
|--------|-------|---------|
| `AZURE_SPEECH_KEY` | Gateway | Azure AI Speech resource key |
| `AZURE_SPEECH_REGION` | Gateway | e.g. `westeurope` |
| `AZURE_TTS_VOICE` | Gateway | default `uz-UZ-MadinaNeural` |
| `MEDIATEKA_SIP_*` | Gateway | SIP trunk/extension creds (user, pass, host, DID) |
| `AI_GATEWAY_INGEST_SECRET` | Gateway + `ai-call-events` | authenticate gateway→CRM posts |
| `AI_GATEWAY_URL` / token | `ai-call-initiate` | reach the gateway to start outbound calls |

---

## 8. Phased plan

Each phase is independently demoable; **Phase 0 is the agreed tech demo.**

### Phase 0 — Speech‑to‑speech brain (the demo)  ⟵ *start here*
Prove **Azure STT → Gemini → Azure TTS** end‑to‑end in **Uzbek**, with **no PBX
risk**:
- A small gateway service exposing a **WebSocket** (mic audio in / agent audio
  out) + a minimal web page (or reuse the Flutter voice screen) as the client.
- Implements the full §6 loop: streaming STT, Gemini turn, streaming TTS,
  barge‑in.
- **Success:** you speak Uzbek into a browser, the AI answers in Uzbek, with
  identity/knowledge tools working against real CRM data.
- *Deliverable: a clickable demo + the orchestrator that every later phase reuses.*

### Phase 1 — Inbound: the AI answers a real call
- Stand up the SIP bridge (jambonz recommended) against `hanguk.sip.uz`.
- Route **one** dedicated extension/DID to the AI; it answers and converses.
- Log the session to `ai_call_sessions`/`ai_call_turns`; `voip-webhook` records
  the `calls` row; post‑call analysis runs unchanged.

### Phase 2 — Outbound: the AI calls out
- `ai-call-initiate` (staff‑triggered) → gateway originates a call → runs the loop.
- First use case: a single **lead follow‑up** or **reminder** call you trigger by
  hand.

### Phase 3 — CRM tools & outcomes
- Wire the full tool set (identify, brief, book/route, create task, handoff).
- Write structured `outcome`/`summary` back; surface AI calls in the CRM call list
  and the student 360.

### Phase 4 — Scale & guardrails (pre‑production)
- Outbound campaigns/queue (`ai_call_tasks`), rate limiting, retry/no‑answer.
- Human handoff (warm SIP transfer), monitoring/alerting, cost dashboard.
- **Compliance:** AI disclosure, recording consent, opt‑out, calling‑hours, and
  do‑not‑call handling.

---

## 9. Open questions / prerequisites

Blocking items to confirm before Phase 1 (none block the Phase 0 demo):

1. **Mediateka SIP access.** Does the `hanguk.sip.uz` plan expose a **SIP
   trunk / extension** an external UA can register to, and an **originate API**
   for outbound? This determines the bridge design. *(Provider question.)*
2. **Azure region + Uzbek quality.** Pick a region (`westeurope` likely);
   pilot‑test **`uz-UZ` STT accuracy** on real Uzbek call audio — it's a
   lower‑resource locale, so expect higher word‑error rate than ElevenLabs
   Scribe. Mitigations: phrase lists / custom speech, and **keep ElevenLabs in
   the post‑call analysis pipeline** as the record‑of‑truth transcript.
3. **Concurrency.** How many simultaneous AI calls? Sizes the gateway host and
   Azure quota.
4. **Default voice + persona** (`MadinaNeural` vs `SardorNeural`) and how the
   agent must identify itself.

### Rough cost (order of magnitude, per call‑minute)
Azure STT ≈ \$0.016–0.02/min · Azure TTS neural ≈ \$0.016/min (≈ \$16/1M chars) ·
Gemini tokens ≈ cents/call · Mediateka per its plan · gateway host ≈ a small fixed
VM/Railway fee. Ballpark **a few US cents per minute** of conversation, dominated
by Azure speech.

---

## 10. What I'd build first (concrete next step)

On approval, **Phase 0**: a `voice-gateway/` service (Node + Docker, sibling to
`telegram-userbot/`) that:

1. Accepts a WebSocket audio stream.
2. Streams it to **Azure STT (`uz-UZ`)**.
3. Runs the **Gemini** orchestration loop with the `identify_caller` /
   `get_student_brief` tools against real CRM data.
4. Streams **Azure TTS (`uz-UZ-MadinaNeural`)** audio back.
5. Ships a one‑page web client to talk to it.

That single artifact proves the entire speech‑to‑speech brain in Uzbek and
becomes the core every later phase wraps with SIP telephony.

---

### Sources
- Azure Speech language support (STT `uz-UZ`, `ru-RU`, `ko-KR`; TTS
  `uz-UZ-MadinaNeural` / `uz-UZ-SardorNeural`):
  <https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support>
- Azure Speech streaming / push‑audio + low‑latency synthesis:
  <https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-lower-speech-synthesis-latency>
- jambonz (SIP ⇄ speech vendor ⇄ custom LLM): <https://www.jambonz.org/>
