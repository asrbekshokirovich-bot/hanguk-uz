# Phase 2 — Hybrid retrieval (pgvector + PGroonga, RRF)

> Status: **implemented as code on this branch** (not yet applied/deployed — the
> live Supabase apply + edge-function deploy are gated in the agent environment;
> see "Deploy" below). Builds on Phase 1 (typed structured tools).

## What this adds

Phase 1 made the staff agent answer **structured** questions (list/count/filter
rows). Phase 2 adds the **content** side — "what did we discuss / who asked about
X" over chats, call summaries/transcripts and documents — using **hybrid search**
(dense semantic ⊕ lexical full-text), not naive vector-only RAG.

## Pieces

| File | What |
|---|---|
| `supabase/migrations/20260614120000_phase2_hybrid_retrieval.sql` | New `content_embeddings` store (1536-dim), HNSW + PGroonga indexes, `hybrid_search_content()` RRF RPC, `content_embed` enqueue triggers, backfill |
| `supabase/functions/_shared/gemini.ts` | New `embedContent001()` — gemini-embedding-001 @ 1536, L2-normalised |
| `supabase/functions/embed-content/index.ts` | New worker: chunk + embed a message / document / call into `content_embeddings` |
| `supabase/functions/dispatch-comm-jobs/index.ts` | Registers the `content_embed` worker (passes `ref_table`) |
| `supabase/functions/hanguk-ai-chat/index.ts` | `search_communications` tool upgraded to hybrid (+ optional reranker, lexical fallback) |

## Design decisions

- **One consolidated store** `content_embeddings` covering calls + messages +
  documents, with **both** a dense HNSW index (`vector_cosine_ops`) and a
  PGroonga lexical index on the same `content` column, so **RRF fuses by row id**
  cleanly. (The legacy `communication_embeddings` was 768-dim, calls-only,
  vector-only — left intact, non-breaking; deprecate after backfill.)
- **Embedding model: `gemini-embedding-001` @ 1536 dims** (MRL-truncated +
  L2-normalised). Chosen over self-hosted BGE-M3 because the repo already sends
  content to Google embeddings and there is no GPU infra. `text-embedding-004` is
  deprecated.
- **`hybrid_search_content`**: RRF (`rrf_k=50`, the Supabase-official default),
  `SECURITY DEFINER` + `ai_is_staff(auth.uid())` gate (same contract as the
  Phase-1 `ai_*` tools), 8s statement timeout, pgvector **iterative scan** on so
  RLS/filter post-scan doesn't starve recall. Weights let either arm be biased.
- **Pipeline reuses the existing `comm_processing_jobs` queue**: triggers on
  `messages` / `document_extractions` / `call_analyses` enqueue a `content_embed`
  job (idempotent; re-queues on content change), drained by `dispatch-comm-jobs`
  → `embed-content`. All existing rows are back-filled (enqueued) by the migration.
- **Graceful degradation**: before the backfill completes (or on any embedding
  error), the `search_communications` tool falls back to the existing lexical
  `search_communications_text` over the source tables — **no regression** vs.
  Phase 1.
- **Optional reranker**: set `RERANKER_URL` to a TEI-style `/rerank` endpoint
  (`POST {query, texts[]} -> [{index, score}]`, e.g. bge-reranker-v2-m3) to
  reorder the fused candidates; unset = RRF order stands.

## ⚠️ Before production

- **PII / privacy**: `gemini-embedding-001` sends `content` to Google. Use a
  **paid Gemini / Vertex** key with a DPA + ZDR + region pinning — **not** the
  free AI Studio tier (which may train on inputs). (Research plan §13.7.)
- **Benchmark Uzbek recall** on real data before trusting semantic results —
  Uzbek is low-resource and unverified for this model.

## Deploy (when un-gated)

1. Apply the migration: `supabase db push` (or dashboard) — creates the table,
   RPC, triggers, and **enqueues the backfill** into `comm_processing_jobs`.
2. Deploy edge functions: `embed-content`, `dispatch-comm-jobs`, `hanguk-ai-chat`.
3. Drain the backfill: schedule `dispatch-comm-jobs` on pg_cron (it already
   targets the queue), or invoke it repeatedly until `content_embed` jobs reach
   `done`. Watch cost on the first full pass.
4. (Optional) set `RERANKER_URL` to enable cross-encoder reranking.
5. Verify: as staff, ask "what did we discuss with X about scholarships" → expect
   relevant snippets fused from chats/calls/docs with dates.
