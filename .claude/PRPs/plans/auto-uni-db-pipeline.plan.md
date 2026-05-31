# Plan: Fully-Automated University DB Pipeline (remove human review)

## Summary
The Korean-university data pipeline (`hanguk_app/services/uni_db/`, a Python
service driven by the `uni-db-sync` GitHub Action) extracts admissions data into
`extraction_jobs.parsed_output`, then routes each field group through a
**human-review gate** before `publish_worker.py` writes the applicant-facing
public tables (`admission_cycles`, `requirements`, `tuition`, `scholarships`,
`documents_required`, `university_admission_periods`). This plan **removes the
human gate** so the funnel runs unattended end to end.

## User Story
As the platform owner, I want the university database to populate and stay fresh
**without anyone reviewing rows by hand**, so applicants always see current
admissions data and staff are never the bottleneck.

---

## TRUE root cause (verified in code + prod)

The gate is `parse_worker.parse_one_document()` → `validators.evaluate()`
(`extract/validators.py`). `evaluate()` returns **both** `auto_publish` and
`requires_hitl`, but the worker (`parse_worker.py:149`) acts on **only
`requires_hitl`**:

```
requires_hitl == True   → enqueue review_queue(status='open')   → waits for a human (never comes)
requires_hitl == False  → (nothing)                              → extraction_jobs row orphaned, never published
```

So there are **two leaks**, not one:

1. **Orphaned auto-publish path.** When `evaluate()` says auto-publish
   (`requires_hitl=False`), parse_worker writes the `extraction_jobs` row and
   does nothing else. `publish_worker` only drains `review_queue` rows with
   `status='approved'`, so these high-confidence extractions are **never
   published**. The `auto_publish=True` branch is wired to a dead end.
2. **Always-HITL fields.** `FIELD_DIFFICULTY` marks `scholarships`,
   `documents_required`, `gpa_floor`, `recruitment_unit` (D4) and
   `scholarship_topik_tier_table` (D5) as **ALWAYS HITL**. Those tables can
   never fill without a human.

**Evidence (prod `lysjdtyanhdfphqyijsr`):** `extraction_jobs` 438 succeeded
(calendar 68, tuition 86, requirements 89, scholarships 76, documents_required
50) but `review_queue` only 147 rows; published content = requirements 6,
admission_cycles 6, scholarships 3, **tuition 0, documents_required 0**. The
gap = the two leaks above.

The publisher itself is solid: `publish_worker.publish_pending()` already does
cycle get-or-create, year/term inference, a stale-past-cycle hold, empty-card
guards, per-item error isolation, and is idempotent via
`review_queue.published_at`. **We reuse it unchanged in spirit** — we just feed
it everything, automatically.

## Auto-gate policy (chosen: "Auto + non-blocking flag")
Nothing waits on a human. At parse time, for each **non-empty, non-failed**
extraction:

| Condition | Action | needs_attention |
|---|---|---|
| empty extraction / `_extraction_failed` | skip (error/refetch lane, unchanged) | — |
| `evaluate().auto_publish` is True (high confidence) | auto-approve → publish | `false` |
| would have been HITL (low conf, or D4/D5) | auto-approve → publish **flagged** | `true` |
| past-cycle / wrong-year (publisher's `is_stale_cycle`) | held by publisher (unchanged) | — |

Flagged rows publish anyway and surface on a **read-only "Needs attention"**
dashboard. Nothing blocks. Re-ingestion (hash diff) refreshes data each cycle.

## Metadata
- **Complexity**: Medium (reuses the existing publisher; the core change is the parse-time enqueue decision)
- **Source**: User directive — "no human detection at all, everything automated"
- **Tree**: `hanguk_app/services/uni_db/` + `hanguk_app/supabase/migrations/`
- **Estimated files**: ~8 (1 new migration, ~5 modified, tests)

---

## Current vs target

```
NOW:    extract → parse ─┬─ requires_hitl  → review_queue(open) → [HUMAN] → publish
                         └─ auto_publish    → (orphaned, never published)

TARGET: extract → parse → auto-decide → review_queue(approved, +needs_attention?) → publish
```

The `fn_review_*` RPCs and the CRM page stay as an **optional manual override**;
they're no longer required for data to flow.

---

## Files to change

| File | Action | Why |
|---|---|---|
| `services/uni_db/src/uni_db/workers/parse_worker.py` | UPDATE | In `parse_one_document`, decide per extraction via `evaluate()`; enqueue **every** non-empty/non-failed result as an auto-approval carrying `needs_attention` + `reason`, instead of only enqueuing `requires_hitl` items as `open`. Keep the dedup/supersede + empty/failed skips. |
| `hanguk_app/supabase/migrations/2026XXXX_uni_db_auto_publish.sql` | CREATE | (a) add `needs_attention boolean not null default false` + `attention_reason text` to `admission_cycles, requirements, tuition, scholarships, documents_required, university_admission_periods`; (b) widen `review_queue.status` check / reason to allow direct `approved` inserts with a synthetic reason if constrained; (c) `v_needs_attention` read-only view. |
| `services/uni_db/src/uni_db/workers/publish_worker.py` | UPDATE | Read `needs_attention`/`attention_reason` off the queue row (the auto decision in `reviewer_decision`) and pass into every `_publish_*` upsert + the `get_or_create_cycle`. |
| `services/uni_db/src/uni_db/config.py` | UPDATE | Add `auto_publish_enabled: bool=True` (`UNI_DB_AUTO_PUBLISH`) so the gate removal is reversible by env. |
| `hanguk_app/.github/workflows/uni-db-sync.yml` | UPDATE | No new step needed (parse now auto-approves, publish already runs at step 5). Bump the publish `--limit` for the backlog drain; add a one-line comment that review is automated. |
| `services/uni_db/tests/unit/test_parse_worker_dedup.py` (+ maybe new) | UPDATE | Assert every non-empty result is enqueued `approved`; low-conf/D4/D5 carry `needs_attention=true`; empty/failed still skipped. |
| `services/uni_db/tests/unit/test_publish_worker.py` | UPDATE | Assert `needs_attention` carries through to the inserted rows. |
| `src/components/crm/pages/UniDbReviewContent.tsx` | UPDATE | Make read-only "Needs attention": list flagged published rows from `v_needs_attention`; drop accept/edit/reject actions. |

## NOT building
- A separate `gate_worker` (unnecessary — the decision lives at parse time and the existing publisher drains it).
- Removing `fn_review_accept/edit/reject` (kept as manual override).
- Touching the legacy `supabase/functions/` `universities` system (dead parallel track; separate cleanup).
- A second LLM cross-check pass (policy is single-pass + flag).

---

## Step-by-step tasks

### Task 1 — Migration: flag columns + needs-attention view
- ADD `needs_attention bool NOT NULL DEFAULT false` + `attention_reason text` to the six public content tables.
- CREATE `v_needs_attention` = published rows where `needs_attention` (institution, section, reason, source link, created_at) for the dashboard.
- If `review_queue.status`/`reason` CHECKs block inserting `approved` directly with an auto reason, widen them (mirror `20260517183000_..._widen_review_queue_reason.sql` / `20260524010000_..._superseded_status.sql`).
- VALIDATE: `supabase db lint`.

### Task 2 — parse_worker auto-approve (the core change)
- For each non-empty/non-failed result, call `evaluate(...)`; build a queue entry with `status='approved'`, `needs_attention = requires_hitl_or_low_conf`, `reason` (e.g. `auto_clean` / `auto_low_confidence` / `auto_difficult_field`), and stash `{needs_attention, attention_reason}` in `reviewer_decision`.
- Keep the supersede-dedup and the empty/failed skips exactly as-is.
- Set `resolved_at = now()` on insert so the publisher's `order by resolved_at` works.
- MIRROR the existing insert in `persist_outcome`.

### Task 3 — publisher carries the flag
- In `_FETCH_SQL`, also select the auto decision; in each `_publish_*` and `get_or_create_cycle`, set `needs_attention`/`attention_reason`.

### Task 4 — config switch
- `auto_publish_enabled` (default true). When false, fall back to today's `open`-enqueue behavior (so the change is reversible without a revert).

### Task 5 — tests
- parse_worker: every non-empty result enqueued `approved`; flags set on low-conf/D4/D5; empty/failed skipped; dedup preserved.
- publish_worker: `needs_attention` reaches the inserted row args.
- `pytest services/uni_db` green.

### Task 6 — read-only dashboard
- `UniDbReviewContent.tsx` → list `v_needs_attention`, no actions. `tsc`/`vite build` clean.

### Task 7 — backfill + enable (LIVE — owner action)
- One-off to drain the existing 438 succeeded extractions: a small backfill that auto-approves every succeeded `extraction_jobs` without a terminal queue row, then `uni-db publish --limit 1000`.
- Set `vars.UNI_DB_SYNC_ENABLED='true'` + secrets (`UNI_DB_SUPABASE_DB_URL`, `UNI_DB_ANTHROPIC_API_KEY`, optional `UNI_DB_DEEPL_API_KEY`) so the 6-hourly cron runs unattended.

---

## Testing strategy
- **Unit**: parse-time decision (clean/flagged/skip) + publisher flag carry-through.
- **Idempotency**: re-run publish → no dup rows (`published_at` guard).
- **Static**: `pytest services/uni_db`, `supabase db lint`, `tsc`/`vite build`.
- **Backfill dry-run**: count would-be auto-approvals before writing.

## Acceptance criteria
- [ ] No code path requires a human to publish admissions data.
- [ ] Every non-empty/non-failed extraction auto-approves and publishes (clean or flagged).
- [ ] `tuition` and `documents_required` populate from the backlog.
- [ ] Published rows carry `needs_attention`/`attention_reason`.
- [ ] CRM page is read-only (no accept/reject), shows flagged rows.
- [ ] `auto_publish_enabled=false` restores the old human-gated behavior.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Wrong admission data reaches applicants | Med | High | `needs_attention` flag + read-only dashboard; publisher's stale/empty guards stay; re-ingest refreshes; `auto_publish_enabled` kill-switch. |
| Backlog floods content tables with low-conf rows | Med | Med | Flag (not block); dashboard triage; tune the confidence bar in `evaluate()`. |
| Schema drift (RPCs/views applied outside repo) | High | Med | Phase 0 `supabase db pull` before migrating; ship all new objects as migrations. |
| LLM spend from unattended cron | Med | Med | `UNI_DB_SYNC_ENABLED` gate + per-step `--limit`. |
