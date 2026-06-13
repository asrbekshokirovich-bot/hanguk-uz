# Hanguk AI — Deep Research & Upgrade Plan

> Goal: turn the Hanguk AI assistant from a "prompt-stuffing" bot that knows
> *counts* but cannot *list / filter / cross-reference* data, into a genuinely
> capable agent that can answer (almost) anything in the system — correctly,
> safely, and in the user's language.
>
> Status: **Research + Plan** (no production code changed yet).
> Date: 2026-06-13. Model context: Gemini 2.5 Flash, Supabase/Postgres, Deno edge functions, React/TS.

---

## 0. How this research was produced (and its limits)

This document synthesizes **14 independent web-research reports** (fan-out
agents, each running 6–10 searches against 2025–2026 sources, with per-claim
confidence levels). Topics covered with full findings:

1. SQL tool-calling safety · 2. Gemini function-calling · 3. Hybrid RAG +
multilingual embeddings · 4. Multi-tenant RLS isolation · 5. Agent eval/UX ·
6. MCP vs inline tools · 7. Semantic/metrics layer · 8. Cost/latency ·
9. "Chat-with-database" production case studies · 10. Conversational UX ·
11. Observability/guardrails · 12. Safe write-actions · 13. Uzbek/Korean/Russian
NLP · 14. RAG/agent evaluation (deep).

**Not yet completed** (a batch of adversarial *verification* agents and some
implementation-detail agents were cut off by an API rate limit and should be
re-run): independent re-verification of Gemini streaming-shim bugs, text-to-SQL
benchmark numbers, Supabase RLS specifics, embedding leaderboard, and the
code-level agents for native-Gemini Deno tool loops, user-scoped Supabase
client, RPC design, pgvector tuning, embedding pipeline, schema dictionary,
React UX, frameworks, caching, rate limits, FTS, views, date/time, fine-tuning,
voice, proactive AI, omnichannel, intent routing, document AI, memory, model
choice, structured output, privacy/compliance, and rollout. Their conclusions
below are drawn from the completed reports and are flagged where a claim still
needs first-party confirmation.

A "Confidence" tag (high/medium/low) follows the load-bearing claims. Vendor
self-reported numbers are explicitly marked.

---

## 1. Why the assistant fails today (root-cause diagnosis)

The current edge function (`supabase/functions/hanguk-ai-chat/index.ts`) is a
**retrieval-augmented prompt builder, not an agent**:

- `lightStats()` injects only **aggregate counts** into the system prompt
  (`Docs pending review: 593`). The actual rows are never sent.
- `formatBundle()` includes detailed data **only for students whose name/phone
  the user already mentioned** (matched via `search_students`).
- There are **no tools/function declarations** — the model cannot fetch anything
  it wasn't pre-handed. It calls `gemini-2.5-flash` once, with `stream:true`,
  through the **OpenAI-compatibility endpoint**, and pipes the text back.
- Isolation is **prompt-only** ("Only discuss THIS student") and the DB client
  uses the **service-role key**, which bypasses Row-Level Security entirely.

So "list the documents pending review with student names" is **impossible by
construction**: the model has the number 593 but no list and no way to ask for
one. This is the exact screenshot failure. The same applies to every
"list/filter/aggregate/cross-reference everything" question.

**This is the single most important finding: the problem is architectural, not a
prompt-wording problem.** No amount of prompt editing fixes it; the model needs
*tools* that fetch real rows on demand.

---

## 2. The core architectural decision: typed tools, not raw text-to-SQL

**Recommendation: give the model a small set of typed, parameterized query
tools (Postgres RPCs) — a "lightweight semantic layer" — rather than letting it
write arbitrary SQL.** Add a single guarded read-only `SELECT` escape hatch only
later, if the typed tools prove insufficient. (Confidence: high — converged
across the SQL-safety, semantic-layer, and production case-study reports.)

Why:

- **Production "chat-with-database" systems that work all do the same things**
  (Uber QueryGPT, Pinterest, LinkedIn SQL Bot, Snowflake Cortex Analyst,
  Databricks Genie, Looker): decompose into specialized steps, ground in a
  **governed semantic layer / curated metrics** (not raw schema), seed accuracy
  with **verified query libraries**, **defer access control to the platform**
  (not the LLM), and add **human confirmation, clarifying questions,
  self-correction, and audit logs**. Trust/adoption — not raw accuracy — is the
  make-or-break factor. (Confidence: high.)
- **The benchmark-to-production accuracy cliff is real.** Top systems hit ~71–76%
  execution accuracy on BIRD and ~87% on Spider 1.0, but GPT-4 solves only
  **6%** of Spider 2.0 (enterprise-schema) tasks; best methods ~30%. Human expert
  on BIRD ≈ 93%. Raw text-to-SQL over a messy real schema is not reliable enough
  for an end-user CRM. (Confidence: high for the cliff; medium on exact numbers,
  pending re-verification — note benchmarks also contain annotation errors.)
- **A semantic/metrics layer is the single highest-leverage accuracy lever.**
  A paired benchmark across three frontier models found **+17 to +23 percentage
  points** from adding a semantic layer (p ≤ 0.0015); vendor claims go higher
  (Snowflake "90%+", Looker "two-thirds fewer errors") — treat the exact vendor
  numbers as directional, but the **direction and ~20pp magnitude are
  independently corroborated**. Crucially, a *stronger model does not recover the
  gap* — it's about context, not model size. (Confidence: high for direction.)
- The **dangerous failure mode is silent semantic error**: SQL that runs and
  returns a confident, wrong number (bad join fan-out double-counts; missing
  filter). Typed RPCs with the joins/filters baked in eliminate whole classes of
  these. (Confidence: high.)
- For a single first-party app, **inline tools beat MCP** (lower latency, simpler,
  keeps secrets server-side). Supabase explicitly says **don't connect its hosted
  MCP server to production or expose it to customers** — it runs with developer
  permissions. Build inline tools in the edge function instead. (Confidence: high.)

**Concrete shape of the typed-tool layer** (each is a Postgres function exposed
via `supabase.rpc(...)`, one "metric/query" per function, with the joins,
filters and ranking baked in):

- `list_documents(status, student_id?, from_date?, to_date?, limit, offset)` →
  rows with `{document_name, status, student_name, uploaded_at}` + total count.
- `list_students(filters…)`, `list_leads(filters…)`, `list_payments(filters…)`,
  `list_tasks(filters…)` — each with optional, `COALESCE(NULL ⇒ any)` filters,
  enum-constrained values (good for the LLM tool schema), pagination, and a
  `{total, rows}` envelope.
- `count_*` / `aggregate_*` for "how many", "sum", "by status/city/intake".
- `get_student_bundle(student_id)` — the existing rich per-student view.
- `search_communications(query, student_id?)` — the existing semantic/text search
  over calls + chats + docs (keep this for content questions).
- (Later) `run_readonly_sql(sql)` — SELECT-only escape hatch, validated with an
  AST parser (sqlglot-style), forced `LIMIT`, `statement_timeout`, allow-listed
  tables, executed under a read-only role. Only if typed tools leave real gaps.

Design notes from the research (Confidence: high unless noted):

- **Curated reporting VIEWS** that pre-join the normalized schema into
  agent-friendly, well-named, `COMMENT`-documented views raise accuracy (simpler
  joins ⇒ fewer errors). Expose pre-computed CRM signals as columns:
  `days_since_last_contact`, `is_overdue`, `needs_follow_up`, `is_stalled`.
- **Verified-query / few-shot library**: store `question → tool-call` (or
  `question → SQL`) pairs and retrieve the most similar at query time (dynamic
  few-shot). This is how Vanna/Uber/Snowflake raise accuracy.
- **A few broad, flexible tools** (with optional filters) generally beat many
  narrow ones for tool-selection accuracy — but keep the total tool count modest
  (descriptions cost tokens and dilute selection).

---

## 3. Gemini integration: move the tool loop to the native API

**Finding (Confidence: high):** Tool calling works on Gemini 2.5 Flash both
natively and through the OpenAI-compat shim **for non-streaming single calls**.
But the **OpenAI shim + streaming + tools** path (what we'd be extending) has
documented bugs:

- `finish_reason` returns `"stop"` instead of `"tool_calls"` when streaming with
  tools, breaking OpenAI-style clients.
- Streamed `tool_call` deltas can arrive with `index = null` (client crashes).
- The shim rejects a `type` field nested inside `function` (HTTP 400).
- Gemini 2.5 **"thought signatures"** (encrypted reasoning state returned with
  tool calls when thinking is on) are not round-tripped by the shim in streaming,
  degrading multi-turn tool loops.

**Therefore: implement the agentic tool loop against the native Gemini API**
(`generateContent` / `streamGenerateContent` with `tools.functionDeclarations`,
reading `functionCall` parts and returning `functionResponse` parts), using the
official `@google/genai` SDK (the SDK round-trips thought signatures
automatically). Stream only the **final** assistant text to the client; run the
tool turns server-side. (Confidence: high; the exact Deno/`@google/genai` code
sketch agent was rate-limited — confirm import + streaming-with-tools mechanics
against `ai.google.dev/gemini-api/docs/function-calling` before coding.)

Gemini facts to exploit (Confidence: high):

- **Parallel function calling** (multiple `functionCall` parts in one turn) and
  **compositional/sequential** chaining are supported → collapse round-trips.
- Modes `AUTO` / `ANY` / `NONE` + `allowed_function_names` to force/narrow tool
  selection when intent is known.
- Max **128** function declarations/request (plenty).

Cost/latency (Confidence: high, some figures pending re-verification):

- **Pricing** ≈ $0.30 / 1M input, $2.50 / 1M output; cached input ≈ $0.15/1M.
- **Context caching**: implicit (auto, ~75% off cached input) and explicit
  (~90% off) for 2.5 models; min ~1,024 tokens for Flash; static-first/
  variable-last prompt ordering. **Put the system prompt + tool schemas + schema
  dictionary at the very start, identical byte-for-byte, so they cache** across
  turns and tool iterations.
- **Thinking tokens are billed as output ($2.50/1M)** — the main hidden agentic
  cost. Set a **low/zero thinking budget for routing/simple turns**, reserve
  budget for genuinely hard steps. (`thinking_budget` 0–24,576 for 2.5 Flash.)
- **Cap tool iterations** (3–5 simple, ≤10–15 complex) with hard stops + no-
  progress detection; verbose tool results are the #1 cause of context blowup —
  return compact, paginated results.

---

## 4. Security & multi-tenant isolation (do this *with* the tools, not after)

**Finding (Confidence: high):** Prompt-based isolation ("only discuss THIS
student") is not a security control — LLMs don't separate instructions from data,
and the CRM ingests **untrusted content** (Telegram messages, OCR'd docs, call
transcripts) that can carry injected instructions. This is OWASP LLM01 (Prompt
Injection), LLM02 (Sensitive Info Disclosure, now #2), LLM06 (Excessive Agency).

Enforce authorization in the **database/tool layer**:

- **Stop using the service-role key for user-facing queries** — it *always*
  bypasses RLS. (Confidence: high.) Create a **user-scoped Supabase client** in
  the edge function that forwards the caller's JWT, so queries run as the
  `authenticated` role and `auth.uid()` + RLS apply. Keep a separate admin client
  only for genuinely privileged, non-user reads (e.g. global staff stats), gated
  by a server-side role check.
- **Enable RLS on every table the agent can reach** and rely on it as the
  backstop — even a maliciously broad `SELECT *` then returns only permitted
  rows. RLS even survives pgvector similarity search (the "RAG with permissions"
  pattern). Use `security_invoker = true` on views and `SECURITY INVOKER`
  functions so RLS isn't silently bypassed; read roles from JWT `app_metadata`
  (never user-editable `user_metadata`). (Confidence: high.)
- The codebase **already has** `has_role()`, `user_roles`, RLS policies, and
  `security definer` RPCs — so the building blocks exist; the AI path just isn't
  using them. (Verified in-repo.)
- **Least privilege for the read-only SQL escape hatch** (if added): dedicated
  read-only role (no write/DDL grants — physically can't mutate), per-role
  `statement_timeout`, forced `LIMIT`, AST validation (SELECT-only + allow-list)
  before execution. (Confidence: high; sqlglot specifics pending re-verification.)
- **Defense-in-depth vs prompt injection**: wrap tool/DB results with anti-
  injection framing, keep tools least-privileged, and *do not rely on this alone*
  (it's not foolproof — prompt injection has no clean "escaping" fix). For the
  **staff** assistant (trusted users) the bar is lower; for any **student-facing**
  assistant treat all retrieved content as hostile.

---

## 5. Hybrid retrieval: structured tools + semantic search, routed by intent

**Finding (Confidence: high):** Naive vector RAG is fundamentally wrong for
count/list/filter/aggregate questions (top-k returns a *sample*, not a complete
set; vector DBs can't `GROUP BY`). Structured querying is required for those;
semantic search is for content/topic/"what did we discuss" questions. **Build
one agent with both tool families and route by question type.**

- **Route:** aggregation / count / list / filter / status → structured RPC tools;
  content / entity / "what did we discuss about X" → `search_communications`
  (semantic); compound → both, then merge. A lightweight intent step or the
  model's own tool-choice can do this.
- **Keep & strengthen the existing semantic layer**: the repo already uses
  **PGroonga** (multilingual FTS incl. Korean/CJK — a sound choice) and
  `pg_trgm`. Add **pgvector dense search** and fuse lexical+dense with
  **Reciprocal Rank Fusion (RRF)**, then optionally a **cross-encoder reranker**
  (`bge-reranker-v2-m3`, multilingual). (Confidence: high.)
- **Embeddings for Uzbek/Russian/Korean/English**: a single multilingual model
  avoids per-language pipelines. **BGE-M3** is a strong default (100+ languages,
  8K context, does dense+sparse+multi-vector in one model); **multilingual-e5**
  and **Qwen3-Embedding** are alternatives. **Benchmark on your own Uzbek/Korean
  data before committing** — Uzbek is low-resource and no source validated it
  specifically. (Confidence: high for the shortlist; the leaderboard-verification
  agent was rate-limited.)
- **Cross-lingual retrieval degrades sharply** (~30–50 pt Hits@20 drop), largely
  a score-calibration/language-dominance problem. Mitigate with hybrid lexical in
  each language + a multilingual reranker; consider translating code-mixed queries
  to a pivot (English) before embedding. **Detect language per message, not per
  session** (users code-switch). (Confidence: high.)

---

## 6. Trust, correctness & conversation UX

(Confidence: high unless noted.)

- **Answer only from returned rows.** Never let the model synthesize a value not
  present in tool output. Add a faithfulness/entailment check that each number in
  the prose maps to a returned cell. Provide explicit "no rows matched / I don't
  have that field" responses and an **abstention path** — models are trained to
  bluff; abstention must be rewarded, not penalized.
- **Ask clarifying questions on detected ambiguity** (prefer **multiple-choice**)
  instead of guessing — this *increases* task success and can *reduce* turn count.
  (AmbiSQL-style ambiguity detection reported large exact-match gains; magnitudes
  medium-confidence, single benchmark family.)
- **Track the active entity/filters across turns** ("what about her IELTS?")
  separately from raw chat history; rewrite each follow-up into a self-contained
  query (decontextualization) before tool selection. Summarize old turns but
  *pin the active-entity slots* so coreference survives compaction. Current
  "last 10 flat messages" memory is too naive.
- **Present results as prose lead + table**: "12 students match; here are the top
  5 by IELTS" + a rendered table, with "showing 5 of 12 — show all?" progressive
  disclosure. Narration of numbers is the lossy step — keep it grounded.
- **Show the work, verifiably**: surface the tool/query that ran (collapsed,
  expandable to raw rows) and cite sources (date + channel for comms; row ids for
  records). But "transparency ≠ trust" — make verification *one click away*, not
  an evidence firehose, and **never fabricate a citation/value**.
- **Large results**: push `COUNT`/`GROUP BY`/`LIMIT` into SQL; return "N of M" +
  preview + aggregates; never dump thousands of rows into context.

---

## 7. Write-actions (later phase): let it *do* things, safely

When the assistant graduates from read to actions (create task, update status,
send message, schedule follow-up):

- **Classify by reversibility/externality** (Confidence: high): reversible
  internal writes (update status, create task) → auto-execute **with audit log +
  undo**; external/low-reversibility (send message, schedule) → **preview-then-
  confirm (human-in-the-loop)**.
- **Idempotency**: derive keys from stable structural context
  `(agent_run_id, step_id, tool_name)` + a business id — **never from LLM
  output** (non-deterministic) — backed by a dedup table; wrap decide+write in a
  transaction/outbox.
- **Least privilege + audit**: run in the user's security context, minimum tools,
  authorization in the DB; bind every write to an identity and log tool/args/
  result/reasoning. Apply Meta's "Rule of Two" (an agent shouldn't combine
  untrusted input + sensitive data access + state-change in one session).
- Salesforce Agentforce / HubSpot Breeze / Dynamics Copilot all gate writes this
  way (per-action confirmation flags, permission inheritance, audit cards).

---

## 8. Evaluation, observability, rollout (how we avoid regressions)

(Confidence: high.)

- **Build a golden eval set** from real past questions (include list/count/filter
  + "I don't know" cases). Score **execution accuracy** (does the tool/query
  return the correct row set — multiset compare, mind column/row order), plus
  **tool-call correctness** (right tool, right args) and **trajectory** checks.
  ~30 examples minimum, ~100 for reliable signal.
- **Gate in CI** with **promptfoo** (`--fail-on-regression`) and/or **DeepEval**;
  pin the judge-model version (judges drift when providers update silently).
- **Observability**: Deno 2.x has **native OpenTelemetry** → export to
  **Langfuse** (free tier ~50K obs/mo). Capture trace id + per-tool-call spans +
  token/cost; wire 👍/👎 into Langfuse scores; LLM-as-judge on ~5–10% sampled
  traffic.
- **Rollout**: shadow mode (run new agent beside old, compare, don't show) →
  canary/percentage behind a feature flag → full. Keep a kill-switch/fallback to
  the current prompt-stuffing path. Grow the eval set from captured failures
  (data flywheel).

---

## 9. Proposed phased plan

Effort tags are rough. Each phase is independently shippable.

### Phase 0 — Foundation & safety (do first)
- Create a **user-scoped Supabase client** in the edge function; reserve the
  service-role client for explicit, role-checked global reads. Enable/verify RLS
  on all agent-reachable tables. *(Security; unblocks everything.)*
- Stand up **Langfuse** tracing + a **golden eval set** of ~50 real questions
  (the current failures, incl. the screenshot case) with expected row sets.
- Add a **feature flag** so the new agent can run in shadow/canary.

### Phase 1 — Make it answer "list / filter / count" (the screenshot fix)
- Build the first **typed RPC tools**: `list_documents`, `list_students`,
  `list_leads`, `list_payments`, `list_tasks`, `count_*`/`aggregate_*`, with
  optional filters, enums, pagination, `{total, rows}` envelope; `SECURITY
  INVOKER` + RLS. Add curated reporting **views** with pre-computed signals.
- Implement the **native-Gemini tool loop** (`@google/genai`, `generateContent`
  with `functionDeclarations`, parallel calls, iteration cap, low thinking budget
  for routing), streaming only the final answer. Cache the static system prompt +
  tool schemas + schema dictionary (context caching).
- Answer-only-from-rows + "N of M" + prose-lead-plus-table rendering in the React
  client; show the tool that ran.
- **Exit criteria**: "list documents pending review with student names" and a
  dozen similar list/filter/count questions pass the eval set.

### Phase 2 — Hybrid retrieval & multilingual quality
- Add **pgvector** + an **embedding pipeline** (pick BGE-M3 / multilingual-e5 /
  Gemini embeddings after benchmarking on Uzbek/Korean; keep embeddings fresh via
  a job/queue on insert/update). Fuse PGroonga lexical + pgvector with **RRF**;
  add a multilingual **reranker**. Route content questions to
  `search_communications`, structured questions to RPC tools.
- **Normalize Uzbek** (canonical apostrophe `oʻ/gʻ`, optional Cyrillic↔Latin via
  UzTransliterator) on ingest and in name search; **detect language per message**.
- Robust **date/time** handling: inject current date + user timezone
  (Asia/Tashkent / Asia/Seoul); compute relative ranges ("this week", "overdue")
  in SQL, not in the model.

### Phase 3 — Trust, memory, evaluation hardening
- Clarifying-question flow (multiple-choice) on ambiguity; abstention path;
  faithfulness check on numeric prose.
- Better **conversation memory**: active-entity/filter state + rolling summary
  (replace the flat last-10).
- Expand eval set; add **trajectory** + LLM-as-judge evals; wire CI gate
  (promptfoo/DeepEval) on prompt/tool changes.

### Phase 4 — Actions & proactivity (optional, higher risk)
- Write tools with reversibility classification, HITL confirm for external
  actions, idempotency keys, audit log.
- Proactive features via **pg_cron** + edge function: daily staff briefing
  (overdue payments, stalled leads, docs pending review, follow-ups due),
  next-best-action, lead prioritization — facts computed in SQL, LLM only
  summarizes.

---

## 10. Key risks & open questions (re-run the verification agents)

- **Exact Gemini streaming-shim behavior in 2026** — confirm before deciding how
  much native-API work is required (the shim may have been partially fixed).
- **Embedding model quality on Uzbek/Korean** — no source validated Uzbek; must
  benchmark on real data.
- **Text-to-SQL benchmark numbers** and **semantic-layer +%** figures — several
  came from vendor/analyst blogs; direction is solid, exact magnitudes pending.
- **Supabase RLS user-scoped client + pooler `set_config` nuances** — confirm the
  exact Deno pattern (the code-level agent was rate-limited).
- **PII/compliance** (Uzbekistan data-localization, Korea PIPA, Google data-use
  for the Gemini API tier in use) — needs first-party confirmation before sending
  student PII; may warrant legal review.
- Implementation-detail agents (RPC design, pgvector tuning, embedding pipeline,
  schema dictionary, frameworks, voice, proactive, omnichannel, intent routing,
  document AI, memory, model choice, structured output, rollout) were
  rate-limited and should be re-run to add code-level specifics.

---

## 11. One-paragraph executive summary

The assistant can't list/filter/aggregate because it has **no tools** — it only
receives pre-computed counts in its prompt. The fix is to make it an **agent with
a small set of typed, parameterized Postgres query tools** (a lightweight
semantic layer of RPCs + curated views), run the **tool loop on Gemini's native
API** (the OpenAI streaming shim mishandles tool calls), and enforce **per-user
isolation in the database via RLS + a user-scoped client** instead of trusting
the prompt (the service-role key currently bypasses all security). Keep the
existing PGroonga text search, add **pgvector hybrid retrieval + a multilingual
reranker**, route structured vs. content questions, normalize Uzbek scripts and
detect language per message, and ground every answer in returned rows with
clarify/abstain behavior. Wrap it in **evals + tracing + a shadow/canary
rollout** so it improves without regressing. Actions and proactive briefings come
later, gated by human-in-the-loop confirmation and audit logging.
