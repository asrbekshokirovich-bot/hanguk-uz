# Uni-DB Correction Plan

Status: living tracker. Created from a full code review + operational log review
(live DB on the `Hanguk 2026` project, Supabase advisors, GitHub Actions run +
job logs, git history, open PRs) + a deep-research pass on extraction accuracy & QC.

**Definition of "fixed":** the pipeline ingests fresh data on a schedule and
*fails loudly when it doesn't*; published data is correct, de-duplicated and
grounded in its source; the staff review screen works and low-confidence rows are
actually reviewed; accuracy is *measured*; the security/DB issues are closed.

**Guardrail:** test on `hanguk-staging` first; change prod via migrations, never
hand-edits. Do not widen auto-publish until the gate (P2.1) and eval set (P2.5)
exist.

Legend: ✅ done in the kickoff PR · ☐ pending · ⚠️ needs staging + live sources.

---

## Headline finding (the "why it looks fine but isn't")

The 6-hourly `uni-db-sync` GitHub Action reports **success on every run**, but
`crawl_runs` has not grown since **2026-05-26** and all 100 announcements are
still `classifier_label='unknown'`. The latest job log shows why:

- **Discover** runs in ~3s, logs `No adapter registered … skipping` for ~36 of 50
  sources, and prints `Done. Total new=0 changed=0`.
- **Fetch+parse** only has stale backlog candidates and the PDF resolvers fail:
  `korea_univ: no fileDown anchor in detail page`, `attachment served non-PDF
  (mime='text/html')`, `kaist: detail fetch failed … ConnectTimeout`.
- The run stays green because Discover/Ingest/Translate/Publish all set
  `continue-on-error: true`; only `run-pipeline` gates pass/fail, and with nothing
  new to fetch it exits 0.

Net: the system is **built but stalled**. Today: 50 institutions seeded, ~21 with
content, 11 with scholarships, **0 tuition**, **0 coordinates** (map off),
translations machine-only (en+uz), 543 sources awaiting approval, 125
auto-published rows flagged `needs_attention` but never reviewed, and a staff
review screen that crashes on open.

---

## P0 — Make truth visible & unblock ingestion

- ☐ **0.1 Stop the green-but-hollow CI.** `uni-db-sync.yml`: a run that crawls
  nothing must go ❌. Simplest: add a freshness/health gate step that fails when no
  new `crawl_runs`/announcements were produced this cycle (Discover already exits 0
  on `new=0`, so removing `continue-on-error` alone is insufficient).
- ⚠️ **0.2 Fix the PDF resolvers.** `parse/pdf_resolvers/korea_univ.py` ("no
  fileDown anchor" — markup changed; attachments returning HTML), `kaist.py`
  (ConnectTimeout → retry + timeout + UA), and `fetch_worker.py` non-PDF skip path.
- ⚠️ **0.3 Onboard the ~36 adapter-less sources** (or route via the generic /
  direct-ingest path) — `discovery/adapters/configs/`. Currently every
  auto-discovered university is skipped.
- ☐ **0.4 Backfill `classifier_label`** (100/100 stuck `unknown`; code is already
  fixed, it just never re-ran).
- ☐ **0.5 Drain 543 `proposed_sources` (`pending_review`).** Decide policy:
  auto-promote trusted `.ac.kr`, else human approval.
- ☐ **0.6 Freshness alarm** off `v_uni_db_health` — alert when last crawl / last
  publish is older than N hours. Would have caught the 2-week stall.

## P1 — Correctness bugs

- ✅ **1.1 Review screen crash.** `UniDbReviewContent.tsx` had only a named export
  but `CRMPortal.tsx:60` lazy-imports it as default (→ "Element type is invalid"),
  and it destructured `{ allowed }` while the hook returns `{ canReview }` (→ always
  "Access restricted"). Fixed both: added the default export and renamed the field.
- ✅ **1.4 Calendar `program_level` CHECK violation.** `publish_worker.program_level_for`
  returned `'both'`, but the live CHECK allows only
  `undergraduate|graduate|phd|all` → the period failed to publish. Now maps
  `'both'`→`'all'`; added a unit test. (This is one of the 20 failed `calendar`
  extraction/publish jobs.)
- ⚠️ **1.2 Non-idempotent publish (duplicates on reparse).** `_publish_requirements
  /_scholarships/_documents/_tuition` do plain INSERTs with no de-dup, and the
  supersede only touches *unpublished* review items, so `uni-db reparse` re-inserts
  the same rows. *Correction to an earlier note:* `tuition` is **not** a special
  "poison-pill" — its UNIQUE includes `recruitment_unit_id`, which the worker leaves
  NULL, so Postgres treats rows as distinct and it silently *duplicates* like the
  others (no UniqueViolation). Fix = MERGE/upsert on a stable business key (or
  supersede-published-before-insert), tested on staging.
- ⚠️ **1.5 Migrations not replayable.** The `20260510*` "fix" batch ALTER/REVOKEs
  objects created in later-dated June/July migrations, so `supabase db reset` aborts.
  Re-timestamp/reorder; verify a clean reset on staging.
- ✅ **1.6 Retired the dead legacy edge fns.** `compare-universities` and
  `import-korean-universities` both targeted the dropped `public.universities`
  table → deleted both functions + their `config.toml` registration. **Follow-up:**
  the student `UniversityComparisonChat` UI (mounted in `UniversityMapKakao`) called
  `compare-universities` and is now orphaned — but it was already non-functional
  (dropped table), so nothing regressed. Decide: remove the compare feature, or
  rebuild it on `institutions`. Left intact for now; the build stays green because
  the generated `types.ts` still carries the stale `universities` type.
- **1.7 Smaller bugs:**
  - ✅ `translate_worker.run_jobs` now wraps each job in try/except, so one
    provider/DB error skips that row instead of aborting the language batch
    (added `test_translate_worker.py`).
  - ☐ `v_uni_db_health` counts `status='promoted'` (never happens → "published"
    always 0) — needs a corrective view migration (untestable here; staging).
  - ☐ calendar `needs_attention` overwrite (line ~414) clears flags vs the
    sticky-OR used for cycles (debatable — verify intent before changing).
- ⚠️ **1.8 `fn_delete_my_account`** deletes by `user_id` but the PII tables key on
  `student_id` → deletion fails / leaves PII (store-compliance). Migration + staging.

## P2 — Trust & quality (the deep-research blueprint)

- ☐ **2.1 Replace "flag-but-never-review" with a real gate.** `confidence ≥ τ AND
  validators pass → publish`, else → review queue (not live). Depends on **1.1**.
- ☐ **2.2 Send Claude the native PDF (image+text hybrid), not text-only**, for the
  table-heavy groups. Highest-ROI accuracy lever; directly targets the
  documents_required (38) / calendar (20) / scholarships (12) failures.
- ☐ **2.3 Grounding:** null-if-absent + quote-then-extract + Anthropic Citations
  (each field linked to a source span). Also powers "source is wrong".
- ☐ **2.4 Calibrate confidence** with self-consistency (sample N, vote), not the
  model's self-reported number; set τ per field-group from the gold set.
- ☐ **2.5 Eval harness:** 150–300 doc gold set (2 annotators, per-field P/R/F1,
  Cohen's κ); Promptfoo/DeepEval as a CI gate (pass-rate < threshold blocks deploy);
  ~10% online-eval sampling for drift.

## P2b — Translation QC (wire the dormant module)

- ☐ **2.6 Placeholder-mask** numbers/dates/fees/TOPIK/proper-nouns before MT,
  restore after (LLMs don't reliably obey glossary/DNT).
- ☐ **2.7 Wire back-translation QC** (`back_trans_distance` is always NULL) + add
  reference-free QE (COMETKiwi **XL/XXL** for Uzbek). High-distance → review.
- ☐ **2.8 Add ru + ko**; require human sign-off on high-stakes facts (deadlines,
  fees, eligibility). Uzbek is the weakest link — gate it hardest.

## P3 — Security, DB hardening, coverage, ops

- ☐ **3.1 Close unauth edge fns / SSRF:** require auth + `.ac.kr` allow-list on
  `search-university`, `discover-*`, `import-*` (currently `verify_jwt=false` +
  service-role, URL fetched unvalidated).
- ☐ **3.2 Security advisor:** enable leaked-password protection; tighten `leads`
  public-insert; lock `legal` bucket listing + `voip_webhook_captures`; review
  anon-executable SECURITY DEFINER funcs; move `pg_net`/`vector`/`pgroonga` out of
  `public`.
- ☐ **3.3 Performance advisor (799 warnings):** wrap RLS `auth.uid()` as
  `(select auth.uid())` (318×); consolidate multiple-permissive policies (475×); add
  37 missing FK indexes; drop 6 duplicate indexes.
- ☐ **3.4 Dead `uni_db_admin` role** in the `change_event_outbox` policy → admins
  can't see the 82 stuck push rows. (Push is also inert: 0 device tokens, 0 sent.)
- ⚠️ **3.5 Coverage:** point **tuition** at the right source (등록금 pages /
  data.go.kr — admission-guideline PDFs don't contain tuition); backfill
  **coordinates** to re-enable the map; investigate **recruitment_units/programs = 0**.
- ☐ **3.6 Move the 4 dead workflows** (`uni-db-{discover,ingest,probe,reparse}.yml`)
  from `hanguk_app/.github/workflows/` to the **repo-root** `.github/workflows/` so
  GitHub actually runs them.
- ☐ **3.7 Docs truth-up:** fix the stale `services/uni_db/README.md` ("Phase 0 / no
  live writes"), reconcile the two automation narratives, note the VPS is
  unprovisioned.

---

## Suggested sequence

1. **Week 1 (P0):** 0.1 → 0.2 → 0.4 → 0.6, then 0.3 / 0.5 — get data flowing *and
   visible*.
2. **Week 1–2 (P1):** 1.1 ✅ and 1.4 ✅ shipped; then 1.2 (idempotency) and 1.5
   (replayability) on staging; 1.8 before the next store submission.
3. **Week 2–4 (P2):** 2.2 (native-PDF) early — biggest accuracy win; 2.1 needs 1.1;
   2.4 needs the 2.5 gold set.
4. **Ongoing (P3):** 3.1 (security) alongside P1; the rest as capacity allows.

## Owner actions (not code)

- Provision or formally retire the Hetzner VPS (systemd units are files only).
- Decide the source-approval policy (0.5).
- Staff human review / high-stakes sign-off (2.1, 2.8).
