# Plan: Fully-Automated University DB Pipeline (remove human review)

## Summary
Today the Korean-university data pipeline is **human-gated**: extractions land in
`review_queue` as `open` and a staff reviewer must `fn_review_accept` / edit /
reject each one before `publish_worker.py` can write the normalized public tables
(`admission_cycles`, `requirements`, `tuition`, `scholarships`,
`documents_required`). Because that human step rarely runs — and the publisher
itself only runs from a `main`-gated GitHub Action — the applicant-facing content
tables are near-empty (`tuition`=0, `documents_required`=0, `requirements`=6,
`scholarships`=3 in prod). This plan **removes the human entirely** and replaces
the review gate with an automated **auto-gate** stage, so the funnel runs
unattended end to end.

## User Story
As the platform owner, I want the university database to populate and stay fresh
**without anyone reviewing rows by hand**, so applicants always see current
admissions data and staff never become the bottleneck.

## Problem → Solution
Human review between `parse` and `publish` (never runs → nothing publishes) →
**Auto-gate worker** that decides accept/flag/reject by extractor confidence +
validity, so every succeeded extraction flows straight to the public tables.

## Auto-gate policy (chosen: "Auto + non-blocking flag")
Nothing ever waits on a human. For each queued extraction:

| Condition | Decision | published_outcome | needs_attention |
|---|---|---|---|
| empty extraction (no rows / no events+periods) | AUTO-REJECT | `rejected_empty` | — |
| wrong intake year (parsed ≠ guideline_document year) | AUTO-REJECT | `rejected_wrong_year` | — |
| confidence ≥ `high_confidence` (0.85) | PUBLISH clean | `published` | `false` |
| confidence < 0.85 (incl. no score) | PUBLISH flagged | `published` | `true` |

Flagged rows are **published anyway** and surfaced on a **read-only**
"Needs attention" dashboard — they do not block visibility. Auto-rejects are
re-tried automatically next cycle when the source document changes (hash diff).

## Metadata
- **Complexity**: Large
- **Source**: User directive — "no human detection at all, everything automated"
- **Primary tree**: `hanguk_app/services/uni_db/` (Python) + `hanguk_app/supabase/migrations/`
- **Estimated files**: ~10 (3 new, 7 modified)

---

## Current architecture (verified)

```
discover → extract → parse(enqueue 'open') → [HUMAN: fn_review_accept/edit/reject] → translate → publish
```

- **Orchestrator**: `hanguk_app/.github/workflows/uni-db-sync.yml` — daily 03:17 UTC,
  gated on `vars.UNI_DB_SYNC_ENABLED=='true'`; 6 steps = the CLI subcommands.
- **Enqueue**: `parse_worker.py` inserts `review_queue(entity_type='extraction_jobs',
  status='open', priority, reason)`; `_priority_for(score)` →
  `high_confidence|low_confidence|high_difficulty_field|no_confidence_score`.
- **Gate (human today)**: `fn_review_accept`/`fn_review_edit_accept`/`fn_review_reject`
  in `20260701001000_uni_db_v3_review_action_rpcs.sql` — **only flip
  `review_queue.status`**; they never write content tables.
- **Publish**: `publish_worker.py` — `_FETCH_SQL` pulls `status='approved' AND
  published_at IS NULL`, dispatches by `field_group` to idempotent upserts
  (`ON CONFLICT`), anchors each row to an `admission_cycles` row
  (`status='unverified'`), stamps `published_at`/`published_outcome`.
- **Thresholds**: `config.py` `high_confidence=0.85`, `low_confidence=0.60`
  (`UNI_DB_HIGH_CONFIDENCE` / `UNI_DB_LOW_CONFIDENCE`).
- **Live counts**: review_queue 147 (87 open, 37 rejected, 15 superseded, 8 approved/all published);
  extraction_jobs 438 succeeded across calendar/requirements/tuition/scholarships/documents_required.

## Target architecture

```
discover → extract → parse(enqueue) → AUTO-GATE(accept/flag/reject) → translate → publish(+needs_attention)
```

The human RPCs stay in place (manual override still possible) but are no longer
required for data to flow.

---

## Files to change

| File | Action | Why |
|---|---|---|
| `hanguk_app/supabase/migrations/2026XXXX_uni_db_v9_auto_gate.sql` | CREATE | Add `needs_attention bool` + `attention_reason text` to `admission_cycles`, `requirements`, `tuition`, `scholarships`, `documents_required`; add `fn_auto_gate_accept(job_id, needs_attention, reason)` SECURITY DEFINER that sets `review_queue.status='approved'` + records flag; add `fn_auto_gate_reject(job_id, reason)`. |
| `hanguk_app/supabase/migrations/2026XXXX_uni_db_v9_needs_attention_view.sql` | CREATE | `v_needs_attention` read-only view unioning flagged published rows for the dashboard. |
| `services/uni_db/src/uni_db/workers/gate_worker.py` | CREATE | The auto-gate: fetch `open`/`in_review` items + extraction, apply policy, call the gate RPCs. Pure decision logic in a testable `decide(...)`. |
| `services/uni_db/tests/test_gate_worker.py` | CREATE | Unit-test `decide()` across all bands + empty/wrong-year edges. |
| `services/uni_db/src/uni_db/cli.py` | UPDATE | Wire `uni-db gate` subcommand. |
| `services/uni_db/src/uni_db/config.py` | UPDATE | Add `auto_gate_enabled` (default true) + reuse confidence thresholds. |
| `services/uni_db/src/uni_db/workers/publish_worker.py` | UPDATE | Read `needs_attention`/`attention_reason` from the queue decision and pass into every publisher upsert; set on `admission_cycles` too. |
| `services/uni_db/src/uni_db/normalize.py` | UPDATE | Accept + thread `needs_attention`/`attention_reason` into each normalized row dict. |
| `hanguk_app/.github/workflows/uni-db-sync.yml` | UPDATE | Insert `uni-db gate` step between `parse` and `translate`. |
| `src/components/crm/pages/UniDbReviewContent.tsx` | UPDATE | Convert to a **read-only** "Needs attention" view (drop accept/edit/reject buttons); read `v_needs_attention`. |

## NOT building
- Removing the `fn_review_*` RPCs (kept as optional manual override).
- Rewriting the legacy `universities` edge functions (separate cleanup track).
- A second LLM cross-check pass (policy chosen is single-pass + flag, not accuracy-first).

---

## Step-by-step tasks

### Task 1 — Schema: flag columns + auto-gate RPCs (migration v9)
- ADD `needs_attention boolean NOT NULL DEFAULT false`, `attention_reason text`
  to `admission_cycles`, `requirements`, `tuition`, `scholarships`, `documents_required`.
- CREATE `fn_auto_gate_accept(p_job_id uuid, p_needs_attention bool, p_reason text)`:
  set the job's queue row `status='approved'`, `reviewer_decision = jsonb_build_object('auto', true, 'needs_attention', p_needs_attention, 'attention_reason', p_reason)`, `assigned_to = null`.
- CREATE `fn_auto_gate_reject(p_job_id uuid, p_reason text)`: `status='rejected'`,
  `published_outcome` left null, reason stored. Both `SECURITY DEFINER`, idempotent
  (`status in ('open','in_review')`).
- VALIDATE: `supabase db lint`; columns exist; RPCs callable.

### Task 2 — `gate_worker.py` + pure `decide()`
- `decide(field_group, parsed_output, accuracy_self_score, gd_intake_year, cfg) -> Decision`
  implementing the policy table. `Decision = {action: 'accept'|'reject', needs_attention, reason}`.
- Empty test mirrors `parse_worker` shapes: `requirements/tuition/...` → `rows==[]`;
  `calendar` → `events==[] and periods==[]`.
- Worker loop: fetch open items (join extraction_jobs + guideline_documents), call
  `fn_auto_gate_accept`/`fn_auto_gate_reject`, count outcomes, log summary.
- MIRROR `publish_worker.py` connect/fetch/loop structure.

### Task 3 — CLI `uni-db gate`
- Add subparser `gate` with `--limit` + `--dry-run`; call `gate_worker.run(...)`.

### Task 4 — Publisher carries the flag
- In `_publish_one`, read `needs_attention`/`attention_reason` from
  `reviewer_decision` (the auto decision) and pass to each `_publish_*`.
- Each publisher upsert sets `needs_attention`, `attention_reason` (and on the
  `admission_cycles` get-or-create for calendar).

### Task 5 — Orchestrator step
- In `uni-db-sync.yml`, add between "Parse" and "Translate":
  `- name: Auto-gate queued items` → `uni-db gate`. `continue-on-error: true` to match siblings.

### Task 6 — Read-only dashboard
- `v_needs_attention` view + rewrite `UniDbReviewContent.tsx` to list flagged
  published rows (institution, section, reason, source link) with **no actions**.

### Task 7 — Backfill + enable (LIVE — owner action)
- One-off: `uni-db gate` (drains the 87 open) then `uni-db publish` (writes content tables).
- Set `vars.UNI_DB_SYNC_ENABLED='true'` + secrets (`UNI_DB_SUPABASE_DB_URL`,
  `UNI_DB_GEMINI_API_KEY`/`UNI_DB_ANTHROPIC_API_KEY`, `UNI_DB_FIRECRAWL_API_KEY`)
  so the daily cron runs unattended.

---

## Testing strategy
- **Unit**: `test_gate_worker.decide()` — high→accept/clean, mid→accept/flag,
  low→accept/flag, none→accept/flag, empty→reject, wrong-year→reject.
- **Idempotency**: run `gate` twice → second run is a no-op (status already terminal).
- **Publish carry-through**: flagged item → published row has `needs_attention=true`.
- **Static**: `pytest services/uni_db`, `supabase db lint`, `tsc`/`vite build` for the dashboard.

## Acceptance criteria
- [ ] No code path requires a human to publish admissions data.
- [ ] `uni-db gate` auto-accepts/flags/rejects every open item per the policy table.
- [ ] Published content tables carry `needs_attention`/`attention_reason`.
- [ ] Daily workflow runs discover→extract→parse→**gate**→translate→publish.
- [ ] CRM review page is read-only (no accept/reject), shows flagged rows.
- [ ] Backfill drains the 87 open items into the content tables.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auto-publishing wrong admission data to applicants | Med | High | `needs_attention` flag + read-only dashboard; auto-reject empty/wrong-year; idempotent re-publish on source change. |
| LLM spend from unattended cron | Med | Med | `UNI_DB_SYNC_ENABLED` gate + per-step `--limit`. |
| Schema drift (RPCs/views applied outside repo) | High | Med | Phase 0 `supabase db pull` before migrating; all new objects shipped as migrations. |
| Mid-band noise floods "needs_attention" | Med | Low | Tune `UNI_DB_HIGH_CONFIDENCE`; flag is non-blocking. |
