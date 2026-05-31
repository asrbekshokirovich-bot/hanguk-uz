-- ============================================================================
--  uni_db v3 — widen review_queue.reason CHECK constraint
--
--  Audit 2026-05-17 §3 (Phase 3 — Extraction Quality):
--  > Widen `review_queue.reason` CHECK constraint (currently 5 values;
--  > loses signal on what kind of failure occurred)
--
--  Current parse_worker.py emits only 2 of the 5 existing values
--  (low_confidence, high_difficulty_field). Operators want richer
--  diagnostic categories so the HITL queue can be sliced by failure
--  mode rather than treating every error as "low_confidence".
--
--  Strategy: keep the existing 5 + add 8 well-named error categories
--  that cover the failure modes already observed in production logs
--  and the obvious ones future workers will need.
--
--  Idempotent — drops the existing CHECK if present then re-adds.
-- ============================================================================

set local search_path = public, pg_catalog;

alter table public.review_queue
    drop constraint if exists review_queue_reason_check;

alter table public.review_queue
    add constraint review_queue_reason_check
    check (reason = any (array[
        -- Existing (preserved)
        'low_confidence',
        'correction_notice',
        'high_difficulty_field',
        'translation_low_confidence',
        'user_reported',
        -- New: extraction-pipeline failure categories
        'parse_error',              -- PyMuPDF/EasyOCR couldn't extract text
        'schema_violation',         -- LLM JSON failed JSON-schema validation
        'extraction_failed',        -- generic catch-all for unhandled extractor errors
        'field_hallucination',      -- self-check flagged the LLM invented data (see KAIST requirements case 2026-05-17)
        -- New: infrastructure/transport failure categories
        'network_error',            -- httpx timeout / 5xx / DNS failure mid-fetch
        'pdf_unreachable',          -- attachment URL 404/403/410 after retries
        'cost_circuit_breaker',     -- skipped because Anthropic budget projection exceeded
        'mime_mismatch'             -- attachment served HTML/HWP when PDF expected (pre-resolver-chain failure mode)
    ]::text[]));

comment on constraint review_queue_reason_check on public.review_queue is
    'Widened 2026-05-17: 5 → 13 reason values. Adds parse/schema/network/cost categories so HITL operators can slice the queue by failure mode. See migration file header for full rationale and audit reference.';
