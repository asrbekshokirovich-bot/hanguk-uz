# uni_db — Deep-Dive Audit Plan

**Status:** Plan (pre-audit). Prepared 2026-09-01.
**Scope agreed with owner:** full audit — code + read-only production DB + controlled pipeline dry-runs.
**Priorities agreed with owner:** (1) data correctness & coverage, (2) automation reliability.
**Execution model agreed with owner:** phased sessions, each ending in a checkpoint the owner reviews before the next phase begins.

This document is the *plan*. It does three things:

1. **Short analysis** — what the system is, what it actually does today, and the single most important diagnosis (why Claude gets the answer right by hand but the automation does not).
2. **The audit plan** — eight phases, each with concrete methods, deliverables, and a checkpoint decision.
3. **What comes after** — how the audit feeds the "make it work perfectly" plan.

The analysis below is grounded in a structured read of every subsystem (discovery, parse, extract, translate, verify/HITL, workers/ops, DB schema, review UI, student-facing, Claude automation, git history) **and** a read-only snapshot of the live production database (project `lysjdtyanhdfphqyijsr`, "Hanguk 2026", as of 2026-09-01). File and line citations throughout point at real code so the audit can start from evidence, not from this summary.

---

## Part A — Short analysis

### A.1 What the system is meant to do

Automatically **discover** Korean university admission guidelines (모집요강 PDFs), **analyse** them with Claude, and **store the structured result** in a database so students can **compare universities** across tuition, deadlines, requirements, scholarships and required documents — in the languages Hanguk students read (Korean source → Uzbek / English / etc.). The owner's intent is that **scheduled "Claude routine tasks" are the brain** driving the whole loop hands-off.

### A.2 What the system actually is today

It is **already live in production**, not the "Phase 0, everything mocked" system the in-repo README chain still describes. Three things are true at once and they matter for the audit:

- **The pipeline runs continuously.** GitHub Actions crons run every 30 minutes (`uni-db-process-uploads`) and every 3 hours (`uni-db-drain-backlog`); a **Claude Code cloud routine that lives outside the repo** is the sole crawler/extraction driver. Discovery via GitHub Actions (`uni-db-auto-crawl.yml`) is manual-dispatch only and delegates its schedule to that routine.
- **The default "brain" is the Claude CLI backend** (`UNI_DB_LLM_BACKEND=claude_cli`, `config.py:31`), which shells out to the `claude` CLI on a subscription token — undocumented in any phase note and the source of several outages.
- **Three separate student surfaces have drifted apart:** a React web portal, a Flutter guest experience, and orphaned Flutter authenticated screens. Today a logged-out guest can see *more* real admission data than a logged-in student.

### A.3 Coverage reality (live DB, 2026-09-01)

The comparison dataset is thin, and the funnel is the headline:

```
408 institutions
 → 205 have any guideline document
 → 175 have a parsed guideline
 →  91 have a live admission cycle
 →  70 have requirements
 →  37 have scholarships
 →  14 have tuition            (3.4% of institutions)
```

Other load-bearing facts:
- **Zero admission cycles have ever reached a `verified`/published state** (485 `unverified`, 43 `superseded`). Every student surface that filters on `status='verified'` is therefore empty for real data — it only ever shows a 3-row demo seed.
- **64%** of cycles and **57%** of requirements carry `needs_attention`.
- **All 927 translations are machine-only, none reviewed.** There is no invalidation when the Korean source changes, so stale translations are served indefinitely.
- **Discovery has been frozen for months:** last crawl run 2026-07-13; announcement polling last ran 2026-05-26; 36 of 109 live sources are past due.
- **The student notification leg is 100% dead:** 411 outbox events pending, `attempts=0`, oldest queued 2026-05-23, zero delivered; 0 tracked universities, 0 push tokens.
- **Extraction is unstable:** 570 of 1,558 live extraction jobs failed (**36.6%**) — CLI timeouts, Anthropic 400s, "Credit balance is too low", session limits. An in-DB supervisor has raised `alert_claude_routine_stale` **79 times**. A dead-key incident in August burned **97,994** junk jobs before a human noticed.

### A.4 The central diagnosis — why manual Claude works but the automation doesn't

The owner's own observation is the most valuable clue in this whole audit: *when a staff member uploads the PDF to Claude by hand, the extraction is correct and complete; the automated pipeline is unreliable, and "all universities have different issues."* That pattern is not vague — it points at specific, findable causes, and the code confirms them. **Claude is not the weak link. The layers around Claude are.**

**Cause 1 — Claude never sees the PDF in the automated flow.** By hand, staff upload the actual PDF and Claude reads it *visually*: tables, columns, layout, stamps. The pipeline instead runs PDF → **text extraction** (PyMuPDF / EasyOCR) and sends Claude the **stripped text**. Korean guidelines are table-dense, and the OCR path runs in paragraph mode that **discards tabular structure** (`ocr_easyocr.py:127-129`). Because each university's PDF layout breaks text-extraction differently, "all universities have different issues" is exactly the fingerprint you would expect. This is the #1 hypothesis and the audit's central experiment (Phase 1) is designed to prove or disprove it.

**Cause 2 — the prompts claim structure the pipeline never delivers.** The extraction prompts tell the model it is receiving *stitched tables* and *pre-normalised dates/amounts* (`calendar.md:50`, `tuition.md:45`, `_archetype_c_few_shots.md:11`). In reality `parse/tables.py`, `parse/dates_ko.py`, `parse/numbers_ko.py` are **dead code imported only by tests** — the model gets raw reading-order text. The model is being told to trust structure that isn't there.

**Cause 3 — the automated agent sometimes reads the wrong thing entirely.** The `claude_cli` backend runs a full `claude -p` agent with a tool **denylist** (not an allowlist), and a documented incident shows the agent **reading the pipeline's own source files and answering from them** instead of the guideline (3 of 8 calls in one shard, `llm_cli.py:60-86`). The manual flow has no tools and no repo to wander into.

**Cause 4 — the automation kept dying and producing nothing.** Extraction produced **nothing for 11 days** (Aug 21 – Sep 1) because the "keyless" backend silently billed a drained API key (`config.py:54-65`, commit `1fd56ac`). "We don't have that much reliable information" is partly literal: the pipeline was dead for stretches. The 36.6% job-failure rate compounds it.

**Cause 5 — even correct extractions don't reach students.** The publish worker always writes cycles as `unverified` and **nothing ever promotes them to `verified`** (`publish_worker.py:338`), so verified-gated student surfaces stay empty. Translations never invalidate. So a perfectly-extracted fact can still be invisible or stale downstream.

The practical shape of the eventual fix is already visible in this diagnosis (let Claude read the original PDF directly, as the manual flow does; fix the publish→verified transition; add freshness alerting) — **but the audit measures the loss precisely before we commit to any fix.**

### A.5 Cross-cutting themes the audit must treat as first-class

- **Security is the most urgent item and it is not narrow.** A production **service-role JWT** (`scripts/_fix_env.py`) and a production **DB superuser password** `Hanguk2026!` (`scripts/legacy_merge/*.mjs`) are committed to git; a deployed **`db-exec` edge function runs arbitrary SQL**; the review RPCs let **any authenticated user act as any staff reviewer** (`coalesce(reviewer_user_id, auth.uid())`); and **`compare-universities` is fully unauthenticated**, leaking staff-only `institution_notes` and acting as an open metered LLM proxy. The DB is shared with the entire CRM (student PII, payments, Instagram tokens), so the blast radius is the whole business.
- **Two migration histories target one project and have provably diverged from it** — one migration references a column that does not exist; a fresh `db reset` cannot replay; `config.toml` even points at the *wrong* project id.
- **A third, undocumented LLM provider (Google Gemini)** powers reviewer-facing translation and the staff assistant — so reviewers approve Gemini-English while students read Claude-Uzbek for the same Korean source.
- **The "brain" is unversioned.** The scheduled Claude routine's prompt, schedule, and environment exist only in someone's Claude account — no `CLAUDE.md`, no run journal (`crawl_runs` is never written), no wired alerting (Sentry is dead config), no deadman check.

---

## Part B — The audit plan

### B.0 Method and guardrails

Every phase uses the same disciplined method so findings are evidence, not opinion:

- **Read-only against production.** All live-DB work is `SELECT`/`count`/advisor lints only — never DDL/DML, never `apply_migration`, never `deploy`. The Supabase MCP read path and the existing `scripts/uni_db_audit.sql` harness are the tools.
- **Controlled dry-runs are sandboxed.** Pipeline re-runs (Phase 1/3) run against a **staging branch or a throwaway Supabase branch**, never writing to production tables. Where a dry-run needs the real PDFs, it reads them read-only from storage.
- **Reproduce before concluding.** For every "this is broken" claim, produce the failing query/test and the exact rows/inputs. For every quality claim, measure against a labelled sample.
- **Each phase ends with a written findings note + a checkpoint question** (multiple-choice where a decision is needed), and a separate PR. The owner steers between phases. No fixes are applied inside audit phases except the Phase 0 security actions the owner explicitly approves.

Phases are ordered by urgency and by the two agreed priorities. Phase 0 is a safety gate that should happen immediately; Phases 1–3 and 5 are the deep passes (correctness/coverage + automation reliability); Phases 4, 6, 7 are substantial but can follow.

---

### Phase 0 — Safety & secret containment (urgent, do first)

**Why first:** committed live credentials and an arbitrary-SQL endpoint mean the audit itself, and the repo, are sitting on a live compromise path. This phase is *contain the bleeding*, not *redesign security* (that is Phase 7).

**Targets & method**
- Confirm exposure and blast radius, read-only: decode the committed JWT (`scripts/_fix_env.py`) for ref/exp; locate the pooler password `Hanguk2026!` (`scripts/legacy_merge/check_partners.mjs:3`, `find_all_orphans.mjs:3`, `fix_sync_relations.mjs:3`); confirm `db-exec` is deployed (`list_edge_functions`).
- Search full git history for both secrets (`git log -p --all -S`), since purging the working tree is not enough.
- Enumerate what each credential can reach (it is the *whole* shared DB, not just uni_db).

**Deliverable:** a containment checklist for the owner — rotate the service-role key and the `postgres` password, purge both from git history, re-key or lock down `db-exec` (statement allowlist / read-only role / kill it), and confirm `compare-universities` auth. These are **owner-executed or owner-approved actions** — the audit surfaces and sequences them; it does not rotate live secrets unilaterally.

**Checkpoint:** owner confirms which containment actions to take now vs. fold into Phase 7.

---

### Phase 1 — Ground truth & the manual-vs-automated experiment  ⭐ (priority: correctness)

**Why:** this is the phase that answers the owner's core question and calibrates everything else. It isolates *where* quality is lost between the PDF and the student.

**The controlled experiment.** Take a labelled sample of **20–30 real guideline PDFs** spanning the failure space (text-layer PDF, vector-table PDF, full scan, HWP/HWPX, combined undergrad+grad, multi-round 1차/2차). For each, produce a hand-verified "gold" record of the key fields. Then run the same PDF **four ways** and diff field-by-field against gold:

1. **A — PDF straight to Claude** (mimics the manual flow: give Claude the actual PDF).
2. **B — pipeline text → Claude** (what the automation feeds today: PyMuPDF/OCR text through the real prompts).
3. **C — full pipeline** through normalize → validators → publish payload (adds post-processing loss).
4. **D — full pipeline + translation** (adds ko→en→uz loss).

The A-vs-B gap measures **Cause 1** (Claude not seeing the PDF). B-vs-C measures normalization/schema loss. C-vs-D measures translation loss. The result is a quantified loss ledger per stage, per field group.

**Supporting live-DB measurements**
- Field-level accuracy vs reviewer corrections: join `extraction_jobs.accuracy_self_score` to review outcomes; is the self-score calibrated at all?
- The coverage funnel (A.3) reproduced as a repeatable query, per field group.
- `documents_required` (1,894) dwarfs `requirements` (338) — is extraction lopsided toward one group, and why?

**Deliverable:** "Where the quality is lost" report — the four-way diff, the loss ledger, and a ranked list of the highest-leverage fixes (with an early read on whether "send Claude the PDF directly" closes most of the gap).

**Checkpoint (multiple-choice for owner):** given the measured loss, which fix direction to pursue first — PDF-native extraction vs. better table extraction vs. post-processing hardening.

---

### Phase 2 — Coverage & discovery audit  ⭐ (priority: coverage)

**Why:** the product's premise is comparing *all* universities; today discovery is frozen and coverage is 3.4% on tuition.

**Targets & method**
- **Is discovery running at all?** Cross-check the out-of-repo Claude routine against DB freshness: `max(fetched_at)` on `guideline_documents`, `max(started_at)` on `crawl_runs` (frozen 2026-07-13), `max(last_polled_at)` on `announcement_sources` (frozen 2026-05-26). Confirm with the owner whether the routine exists, is enabled, and what its prompt/schedule are — and get that captured into the repo.
- **Recall measurement:** sample 30 institutions known (by manual check) to have published a 2027 모집요강; measure how many the pipeline found vs missed, and via which path (`find-guidelines` / routine research / not at all).
- **The dead announcement-board layer:** confirm `public.announcements` is stale and that no worker writes it — correction-notice (정정공고) detection can never fire.
- **Blocklist hygiene for the next cycle:** `blocked_link_hosts` reasons (`not_2027`, `already_have`) are permanent and will wrongly suppress 2028 links; the `site_dead` batch was ~33% false-positive.
- **Domain-filter gaps:** non-`.ac.kr` institutions (George Mason Korea, NCC) and 2-label domains (`skku.edu`) are structurally invisible to the Naver search filter.

**Deliverable:** coverage map (which of 408 institutions have trustworthy current data and which are missing/why) + a discovery-health note.

**Checkpoint:** owner decides target coverage for the 2027 season and whether to resurrect board polling vs. lean on search + manual upload.

---

### Phase 3 — Extraction & parse fidelity audit  ⭐ (priority: correctness)

**Why:** this is where "all universities have different issues" is rooted; Phase 1 quantifies the gap, Phase 3 finds the mechanisms.

**Targets & method**
- **Table/structure loss:** confirm `parse/tables.py` et al. are dead; measure table-heavy fields (tuition rows, per-department quotas) accuracy specifically.
- **Scanned-PDF failure on the drain runner:** `uni-db-drain-backlog.yml` installs no OCR stack, so scanned PDFs hard-fail on that lane — correlate `parse_status='failed'` with drain-run timestamps.
- **HWP/HWPX path:** no working HWPX→PDF conversion exists on any CI runner; confirm whether such payloads simply die.
- **Degree-level splitting** (the most-churned, least-stable module — 5 fixes in 3 weeks): measure false-positive/negative rate on real combined guidelines; check `grad_foreign` cycles that were auto-created but **never re-extracted** (they publish undergrad data or sit empty).
- **1차/2차 round detection is entirely LLM-side** and keyed to an upsert conflict target by first-digit extraction — mislabeled rounds overwrite each other. Measure collisions.
- **Confidence/HITL gating is largely vestigial** (evaluated on one representative field per group; priors never passed; auto-publish publishes "always-HITL" verdicts anyway). Measure calibration against reviewer outcomes.
- **Mock/stub sentinels in real data:** search stored outputs for `easyocr stubbed`/`naver-clova-ocr stubbed` strings.
- **Model provenance:** the CLI lane records `claude-sonnet-4-6` but actually runs a floating `sonnet` alias — provenance is unreliable.

**Deliverable:** parse/extract defect ledger ranked by student-facing impact, with a real-PDF regression corpus proposed (the sample from Phase 1 becomes permanent fixtures).

**Checkpoint:** owner prioritizes which field groups must be right first (deadlines vs tuition vs requirements vs documents).

---

### Phase 4 — Verify / HITL / publish integrity audit

**Why:** the reliability gauntlet and the review→publish path decide what students actually see; several paths bypass the gauntlet or corrupt provenance.

**Targets & method**
- **Auto-approve paths ignore the reliability colors** — quantify whether any RED extractions were published (`review_queue` where `reviewer_notes ilike '[RED]%'` and published; count `backfill_auto_approve.sql`'s ~409 items).
- **`fn_review_accept` nulls `reviewer_notes` on approve**, destroying the verifier's findings before the audit trigger copies them — measure `review_decisions` with null notes.
- **CLI backend caps verification to "balanced"** (no consensus/critics) yet renders GREEN "checks passed" — count green cards with zero cross-checking.
- **Publish is non-transactional with no natural keys** on `requirements`/`tuition`/`scholarships` — measure duplicate published rows; this is a direct student-facing correctness bug.
- **The `verified` dead-end** (Phase A.3) — confirm no promotion path and decide the fix (wire a transition vs. migrate views to `status <> 'superseded'`).
- **RPC/edit path** publishes reviewer-edited JSON with no schema re-validation.

**Deliverable:** publish-integrity report (duplicate counts, RED-published counts, the verified-status decision) + the review-UI trust bugs (bulk-reject blast radius, impersonation, silent no-op dismissals).

**Checkpoint:** owner decides the human-gate posture (keep `require_approval=true`, or move toward auto-publish with a hardened gauntlet).

---

### Phase 5 — Automation reliability & the "Claude routine brain" audit  ⭐ (priority: automation)

**Why:** the owner wants Claude routines to run this hands-off; today the brain is unversioned, unmonitored, and the sole point of failure.

**Targets & method**
- **Does the routine exist and is it healthy?** List the owner's Claude routines; reconcile with `pipeline_watchdog_log` (79 stale alerts) and extraction-freshness histograms. Capture its prompt/schedule/env into the repo.
- **Concurrency & double-spend:** the `claude` single-flight lock is host-local, but three schedulers share one subscription and there is **no DB-level work claiming** (no `FOR UPDATE SKIP LOCKED`). Measure overlapping runs double-extracting the same `pending` documents.
- **Silent-failure detection:** there is no run journal (`crawl_runs` never written), no wired alerting (Sentry dead), no deadman check, and `find-guidelines` returns exit 0 even on partial failure. This is the gap that hid the 11-day outage.
- **Backend fragility:** unpinned `claude` CLI install; broad usage-limit substring matching can spin a fatal error for 2h; OAuth-token expiry unmonitored; scheduled lane silently runs weaker verification than its pinned env claims.
- **Compliance question for the owner:** running a commercial pipeline's extraction through a personal Claude subscription token in CI — is that within terms? (Policy question the code never addresses.)

**Deliverable:** an automation-reliability scorecard and a concrete "what it takes to run hands-off" gap list (job claiming, run journal, freshness deadman + alert sink, routine-in-repo, token monitoring).

**Checkpoint:** owner decides the automation target — keep GitHub Actions as the spine, lean fully on Claude routines, or a hybrid — which shapes the Phase 8 fix plan.

---

### Phase 6 — Student-facing delivery & translation audit

**Why:** correct data is worthless if students can't see it correctly; today guests see more than logged-in students and localization is thinner than the UI implies.

**Targets & method**
- Confirm the `verified` dead-end blanks the authed Flutter screens and the web News tab (queries the RLS-locked base table, not the fix view).
- Confirm orphaned authed routes (nothing navigates to `/institutions/:id` etc.) and the dropped-`universities`-schema drift (charts never render; "Unknown" application history).
- **Translation integrity:** stale translations (no invalidation when Korean changes), orphaned rows (no FK), placeholder artifacts from a mis-described glossary token, dead back-translation QC, and the ko→en→uz pivot for the primary cohort language with confidence hardcoded to 0.40 and no native reviewer.
- **Reviewer-vs-student divergence:** Gemini-English in review vs Claude-Uzbek to students, from the same source.

**Deliverable:** student-experience gap report; which single fix (most likely the `verified` transition) unlocks the most.

**Checkpoint:** owner picks the canonical student surface (React web vs Flutter) to invest in.

---

### Phase 7 — Security & data governance audit (full)

**Why:** Phase 0 contains the fires; Phase 7 is the systematic pass.

**Targets & method**
- The `reviewer_user_id` impersonation hole across all review RPCs; `compare-universities` unauthenticated + staff-note leak; `db-exec` arbitrary SQL; `get-pdf-url` broad access to copyrighted PDFs; `upload-guideline` hash-collision rebinding across institutions.
- Supabase security advisors: 10 SECURITY DEFINER views bypassing RLS, 14 anon-executable definer functions (anyone can trigger crawls / mutate watchdog state), mutable search paths, disabled leaked-password protection.
- **Migration replayability & repo↔prod drift:** two histories, a nonexistent-column migration, wrong `config.toml` project id — establish which history production actually contains and make a fresh `db reset` green.
- **Governance:** no backup/PITR/rollback runbook despite two mass-corruption incidents; robots.txt/ToS/licensing posture for crawling and re-serving ac.kr PDFs; plaintext lead passwords in the shared DB; Korean-language QA (all reviewers are Uzbek staff reviewing English cards — no native-Korean verification anywhere).

**Deliverable:** prioritized security & governance remediation list with severities.

**Checkpoint:** owner approves the remediation ordering and any that must ship immediately.

---

## Part C — After the audit: the "make it work perfectly" plan (Phase 8, sketch)

The audit produces measurements; Phase 8 turns them into a build plan. Based on the diagnosis, the likely spine of that plan is:

1. **Close the correctness gap at the source** — feed Claude the original PDF (as the manual flow does) instead of stripped text, wherever Phase 1 shows that recovers the loss; delete or wire the prompts' false structure claims; add a real-PDF regression corpus.
2. **Fix the delivery dead-ends** — the `verified` transition, translation invalidation, and the student surface, so correct data actually reaches students fresh.
3. **Make the automation trustworthy** — DB-level job claiming, a run journal, a freshness deadman + real alert sink, the routine captured in the repo, pinned CLI, token monitoring.
4. **Restore & measure coverage** — resurrect discovery for the 2027 season with blocklist hygiene and the domain-filter fixes.
5. **Contain & harden security/governance** — the Phase 0/7 remediations, plus backup/rollback.

Each becomes its own checkpointed session, in the order the audit's measured impact dictates.

---

## Appendix — Severity-ranked findings already established (audit starting line)

The deep read already surfaced concrete issues with evidence. The audit's job is to **measure, confirm, and prioritize** these — not rediscover them.

| # | Severity | Finding | Evidence anchor |
|---|---|---|---|
| 1 | Critical | Production service-role JWT committed to repo | `scripts/_fix_env.py:4-9` |
| 2 | Critical | Production DB superuser password `Hanguk2026!` committed | `scripts/legacy_merge/check_partners.mjs:3` |
| 3 | Critical | `db-exec` runs arbitrary SQL with service-role power | `supabase/functions/db-exec/index.ts` |
| 4 | Critical | Any authenticated user can act as any reviewer (`reviewer_user_id` override) | `…/20260701001000_…:51`, `20260823120000` |
| 5 | Critical | `compare-universities` fully unauthenticated, leaks staff `institution_notes` | `supabase/config.toml:114`, `compare-universities/index.ts:118-162` |
| 6 | High | Automated Claude gets stripped text, not the PDF (core quality gap) | `ocr_easyocr.py:127-129`; prompts vs dead `parse/tables.py` |
| 7 | High | Extraction dead 11 days (drained key); 36.6% live job failure rate | commit `1fd56ac`; live `extraction_jobs` |
| 8 | High | No admission cycle ever reaches `verified`; student surfaces empty | `publish_worker.py:338` |
| 9 | High | Discovery frozen (crawl 2026-07-13, polling 2026-05-26) | live `crawl_runs`, `announcement_sources` |
| 10 | High | Student notification leg 100% dead (411 pending, 0 delivered) | live `change_event_outbox` |
| 11 | High | No DB-level job claiming; overlapping schedulers double-spend | grep: no `SKIP LOCKED` in `src/` |
| 12 | High | No alerting / run journal / deadman for the routine | `crawl_runs` never written; Sentry dead config |
| 13 | High | Migration history not replayable; provably diverged from prod | `20260921000000` (nonexistent column); `20260924000000:166-174` |
| 14 | High | Publish non-transactional, no natural keys → duplicate student rows | `publish_worker.py` bare INSERTs |
| 15 | High | Undocumented 3rd LLM provider (Gemini) in reviewer translation & staff chat | `translate-parsed-output/index.ts:8` |
| 16 | High | Coverage: 14/408 institutions have tuition; 64% cycles `needs_attention` | live funnel |
| 17 | Med | Auto-approve paths bypass the reliability gauntlet | `parse_worker.py:547-576`, `backfill_auto_approve.sql` |
| 18 | Med | Degree-split module unstable (5 fixes/3 weeks); `grad_foreign` cycles never re-extracted | `degree_level.py`, `parse_worker.py:635-656` |
| 19 | Med | Translations never invalidate on source change; uz is unreviewed ko→en→uz pivot | `translate_worker.py:36-119` |
| 20 | Med | `config.toml` points at the wrong Supabase project | `supabase/config.toml:1` vs `.env:1` |

*Full per-subsystem evidence (risks, audit targets, open questions for all 13 analysts) is retained in the audit working notes and can be attached to the Phase reports as each phase begins.*
