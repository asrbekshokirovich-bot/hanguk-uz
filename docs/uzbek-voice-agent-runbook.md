# AI Phone Agent (Uzbek) — Runbook

How to run the work that's landed so far for the autonomous Uzbek phone agent.
For the full research + architecture, see
[`research/uzbek-voice-agent.md`](./research/uzbek-voice-agent.md).

The build is staged so the riskiest thing — **does it speak natural, accent-free
Uzbek?** — is settled first, cheaply, before any telephony work.

## Phase 0 — Uzbek voice bake-off (do this first)

Speaking Uzbek is the make-or-break. There is essentially **one** production-grade
Uzbek voice (Microsoft Azure: `uz-UZ-MadinaNeural` / `uz-UZ-SardorNeural`), with
Yandex SpeechKit and Aisha AI (Tashkent) as native contenders. This step
synthesizes the same real Hanguk sentences with each and lets a **native Uzbek
speaker** pick the winner.

1. Get a **Microsoft Azure Speech** resource key (Azure portal → Speech service).
   Choose a region near users — **`westeurope`** is recommended (low latency from
   Tashkent; keep media + models in the EU, never the US — see the research doc).
2. Generate the samples (no install needed — Node 18+):

   ```sh
   AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=westeurope \
     node scripts/uzbek-voice-bakeoff.mjs
   ```

   Optionally also try Yandex (confirm the Uzbek voice names with Yandex first):

   ```sh
   AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=westeurope \
   YANDEX_API_KEY=<key> YANDEX_FOLDER_ID=<id> YANDEX_UZ_VOICES=<voice1,voice2> \
     node scripts/uzbek-voice-bakeoff.mjs
   ```

3. Open **`voice-samples/index.html`** in a browser. A native Uzbek speaker rates
   each voice across the rows on **accent, naturalness, clarity, and prosody** —
   watching numbers, dates, and Korean/Russian terms especially.
4. **Gate:** pick the voice. If none is good enough, escalate to a custom voice
   (Aisha clone, or train on the FeruzaSpeech corpus) before building further.

The sentences live in `scripts/uzbek-voice-bakeoff.sentences.json` — edit them to
match how Hanguk actually talks; they double as the agent's canned phrases.
Generated audio is git-ignored (`voice-samples/`).

> Aisha AI has no public API yet — generate its samples from aisha.group by hand
> and drop files into `voice-samples/aisha/<voice>/<sentence-id>.mp3`; the script
> picks them up into the comparison page on the next run.

## Phase 1 — the brain (`voice-agent-brain` edge function)

The real-time call loop (telephony + Uzbek STT + Uzbek TTS + turn-taking) runs on
a managed platform — **Vapi** for the demo, **LiveKit Agents** for production —
which calls **`supabase/functions/voice-agent-brain`** as a tool/webhook to:

- `get_caller` — identify the caller from their phone via the identity spine
  (`resolveIdentity`), so the agent can greet a known student/lead by name;
- `answer` — answer study-abroad questions with the Gemini brain (`gemini-2.5-flash`),
  **short and spoken, in the caller's language**, scoped to Hanguk topics with
  hand-off-to-human guardrails;
- `capture_lead` — save the caller into `leads` (`source = 'phone_ai'`), deduped
  by normalized phone, so it lands in **CRM → Leads** like any other lead.

Secrets (Supabase → Edge Functions → Secrets):

| Secret | Purpose |
|---|---|
| `VOICE_AGENT_SECRET` | Shared header (`x-voice-agent-secret`) the platform sends. |
| `GEMINI_API_KEY` | Already configured (used by `hanguk-ai-chat`). |

It's a public function (`verify_jwt = false`) authenticated by the shared secret,
same pattern as `telegram-webhook` / `voip-webhook`. Deploy with the rest of the
functions; then point the Vapi/LiveKit agent's tools at it.

### Wiring the platform (demo)

1. Pick the Phase-0 Azure voice as the agent's **TTS**; pick Uzbek **STT**
   (ElevenLabs Scribe — already integrated — or Azure `uz-UZ`).
2. Set the agent's first turn to the disclosure greeting (sentence `01` in the
   JSON): *"Assalomu alaykum! Men Hanguk Education'ning virtual yordamchisiman…"*
3. Register three tools pointing at `…/functions/v1/voice-agent-brain` with the
   `x-voice-agent-secret` header, bodies `{ "tool": "get_caller" | "answer" |
   "capture_lead", "args": { … } }`.
4. Provision a test number (EU region) and call it. Measure round-trip latency and
   confirm a captured lead appears in the CRM.

## Phase 2+ — real line, CRM logging, hardening

Bridge the sip.uz/Mediateka line (LiveKit/jambonz in Frankfurt) once the provider
confirms a SIP trunk; log AI calls into `calls` / `call_transcripts` /
`call_analyses` via the existing Communication Intelligence pipeline; then tune
endpointing/barge-in and guardrails. Details and open questions in the research doc.
