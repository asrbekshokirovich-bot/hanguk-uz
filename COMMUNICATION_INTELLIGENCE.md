# Communication Intelligence

A unified system that ties **every** communication (phone calls, Telegram,
Instagram, …) to a single student or lead, understands what was said — including
**Uzbek phone calls** — and lets Hanguk AI answer anything about a student and
find any of their documents.

This document is the architecture + roadmap. **Phase 1 (the foundation +
Uzbek call analysis) is implemented**; later phases are scoped below.

---

## The spine: one identity per person, across every channel

`communication_identities` maps `(channel, identifier)` → a student or lead:

| channel | identifier (canonical key) |
|---------|----------------------------|
| `phone` | normalised E.164-ish number (`+998…`, see `normalize_phone`) |
| `telegram` | Telegram chat id |
| `instagram` | Instagram-scoped user id |

Every webhook calls `resolveIdentity()` (`_shared/identity.ts`) to answer *"whose
conversation is this?"*. When it discovers a new phone→person match it persists
the mapping, so the link is reused next time and is visible/editable by staff.

**Staff attach** unmatched conversations by hand (the *"or staff will attach it"*
requirement) — see `LinkContactDialog`. Attaching also back-links existing calls
from that number.

Phone normalisation lives in three places that **must stay in lock-step**:
`normalize_phone()` (SQL), `normalizePhone()` (`_shared/identity.ts`),
`normalizePhone()` (`src/lib/phone.ts`).

---

## Phase 1 — Call intelligence (implemented)

```
Mediateka PBX ──> voip-webhook ──> calls row (linked via identity spine)
                                      │  (DB trigger enqueues a job)
                                      ▼
                          comm_processing_jobs ──> process-call-recording
                                                      │
        ┌─────────────────────────────────────────────┼───────────────────────┐
        ▼                         ▼                     ▼                       ▼
  fetch recording        ElevenLabs Scribe        Gemini 2.5 analysis     Gemini embeddings
  (Mediateka key)        (Uzbek, diarized)        (UZ + EN summary,       (text-embedding-004)
                          └─ Gemini audio          intent, sentiment,           │
                             fallback              action items, …)              ▼
        │                         │                     │              communication_embeddings
        ▼                         ▼                     ▼                  (pgvector / HNSW)
   call_transcripts        call_transcripts       call_analyses
```

**Tables:** `call_transcripts`, `call_analyses`, `comm_processing_jobs`,
`communication_embeddings` (+ `match_communication_embeddings` RPC).

**Functions:**
- `process-call-recording` — the worker: transcribe → analyse → embed (internal,
  service-key auth).
- `dispatch-comm-jobs` — drains the queue (retries / backfill); internal.
- `request-call-analysis` — staff-facing trigger (JWT + role checked) used by the
  CRM "Analyze" button.

**Live path:** `voip-webhook` nudges the worker the moment a recorded call
completes (background `EdgeRuntime.waitUntil`). The DB trigger guarantees a
durable job either way; `dispatch-comm-jobs` is the safety net.

**UI:** `CallIntelligence` shows the bilingual summary, intent/sentiment, action
items, follow-up flag, risk flags and the diarized transcript on the call detail.

### Secrets used (all already configured)
`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `MEDIATEKA_API_KEY`, plus the standard
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY`.

### Optional: drain the queue on a schedule (pg_cron)
The webhook handles live calls; enable this so pending/failed jobs always retry.
Store the service-role key in Vault first, then:

```sql
select cron.schedule('drain-comm-jobs', '* * * * *', $$
  select net.http_post(
    url     := 'https://<project>.supabase.co/functions/v1/dispatch-comm-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := jsonb_build_object('limit', 5)
  );
$$);
```

---

## Roadmap

### Phase 2 — Telegram (staff personal accounts)
Students message staff's **personal** Telegram, so an always-on **userbot**
(MTProto/GramJS) mirrors messages into our system — it cannot run as an Edge
Function. Plan:
- A small Node worker (hosted off-platform) holds a session per staff account and
  POSTs each message to a new `telegram-ingest` Edge Function.
- `telegram-ingest` reuses `resolveIdentity('telegram', chatId)` → `messages` /
  `message_threads` (the linking is already wired into `telegram-webhook` today).
- One-time login per account (phone + code + 2FA → session string).

### Phase 3 — Per-student conversation brain
- Unified `communications` timeline (calls + Telegram + IG) on the student 360.
- A rolling "relationship state" summary per student, updated after each contact.

### Phase 4 — Document intelligence (≈595 docs)
- `process-document`: OCR/parse (Gemini multimodal handles UZ/RU/KO + scans) →
  `document_extractions` (text, type, key fields) → embed. Backfill all docs.
- Document finder + Q&A for staff.

### Phase 5 — Hanguk AI upgrade (retrieval, not prompt-dump)
- Give `hanguk-ai-chat` real tools: `search_communications`, `search_documents`,
  `get_student_360`, `find_document` — answer anything about a student and cite
  the exact call / message / document. Keep the existing student-facing guards.

### Later — Instagram
Schema + inbox already tolerate `source='instagram'`. Add an `instagram-webhook`
(Meta Graph API) once a Business/Professional account + Facebook Page exist.
