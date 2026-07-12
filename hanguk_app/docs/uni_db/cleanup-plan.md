# uni_db Cleanup Plan

> Status: **PLAN ONLY — nothing here is executed.** This document is the reviewed removal ledger for the Hanguk `uni_db` repo after an adversarial verify pass. Each row carries its own verification. A future cleanup PR should execute one phase at a time, in order, and stop at any red CI.

> _Reviewed 2026-07-11 by a multi-agent adversarial verification pass (6 identify agents across legacy edge/hooks, uni_db discovery layer, prod runtime, repo scratch, orphan modules, docs/config; each removal candidate then independently refuted, plus read-only Supabase MCP against prod `Hanguk 2026` / `lysjdtyanhdfphqyijsr`). 86 candidates verified: 60 delete, 24 owner-decision, 2 keep. `registry.py` was reclassified from delete → coupled/owner-decision after the refute pass found it wired into the deployed systemd path._

## Executive summary

After tracing imports across the whole repo and reading prod state, roughly **60 items are safely removable**: ~29 committed scratch/junk files (Phase 1), 13 dead legacy edge functions + orphaned frontend clients/hooks (Phase 2), a handful of genuinely dormant uni_db discovery/proposal modules (Phase 3), and ~11 prod-only edge functions + empty/backup DB tables (Phase 4). The **one big risk** is that several "old"-looking modules under `discovery/` are *not* dead — the new nightly finder reuses some of them directly (e.g. `discovery.models`, `naver_search_adapter`), and a larger cluster (board adapters, `discovery_worker`, `registry`) is still wired into a **deployed Hetzner systemd sync unit** and CI tests, so it must never be deleted as "obvious dead code." Everything ambiguous is parked in the **owner_decision** section (~24 items) rather than guessed. Again: this is a plan, not a change — no file is deleted, no table is dropped, no function is undeployed by this document.

---

## DO NOT TOUCH — reused by the live finder / approval path

These are on the live nightly `find-guidelines` → verify → parse → approval path (or transitively reused by it). A cleanup PR that trips over any of these breaks production. Every path below is **KEEP**.

| Path | Why it must stay |
|---|---|
| `hanguk_app/services/uni_db/src/uni_db/discovery/adapters/naver_search_adapter.py` | The finder instantiates `NaverSearchAdapter` (`guideline_finder_worker.py:305`). |
| `hanguk_app/services/uni_db/src/uni_db/discovery/models.py` (incl. `Announcement`) | Imported by the finder; core dataclasses for the live path. (Only the `CrawlRunSummary` *symbol* is unused by the finder — see owner_decision.) |
| `hanguk_app/services/uni_db/src/uni_db/workers/direct_ingest_worker.py` (`resolve_to_pdf`) | Reused by the finder to resolve announcement → PDF. |
| `hanguk_app/services/uni_db/src/uni_db/workers/fetch_worker.py` (`insert_guideline_document`, pdf helpers) | Reused by the finder for persistence + PDF handling. |
| `hanguk_app/services/uni_db/src/uni_db/workers/propose_worker.py` (`registrable_domain`) | Reused by the finder for domain checks. |
| `hanguk_app/services/uni_db/src/uni_db/parse/pdf_resolvers/generic_attachment.py` (`resolve`) | Live attachment resolution. |
| `hanguk_app/services/uni_db/src/uni_db/verify/**` (whole reliability gauntlet, incl. `agents.check_identity`) | New live reliability layer. |
| `hanguk_app/services/uni_db/src/uni_db/parse/extract_orchestrator.py` (`extract`) | Live extraction entry. |
| `hanguk_app/services/uni_db/src/uni_db/workers/parse_worker.py` (`parse_one_document`, `persist_outcome`, verify + require_approval) | Live parse/approval worker. |
| `hanguk_app/services/uni_db/src/uni_db/discovery/classifier.py` | **keep_live.** `classify()` is called by `discovery_worker` and its `classifier_label` is consumed downstream by `fetch_worker.py:129` (a KEEP module); also wired into the deployed systemd sync stage 1. High risk to remove. |
| `hanguk_app/services/uni_db/src/uni_db/parse/dates_ko.py` | **keep_reused.** Exercised by the live-pipeline integration tests (`test_pipeline_end_to_end.py`, `test_archetype_fixtures.py`) and referenced by the live extraction prompt `extract/prompts/calendar.md:38`. Deleting it breaks live-path tests and falsifies a live prompt contract. |
| `hanguk_app/services/uni_db/src/uni_db/cli.py` (`find-guidelines` subcommand) | Live CLI entry. (Note: `cli.py` *also* holds the fixture-only `crawl` subcommand that imports dormant modules — see owner_decision; edit, never delete this file.) |
| `hanguk_app/services/uni_db/src/uni_db/extract/prompt_assembler.py` | Live language-eligibility addendum. |
| `src/components/crm/pages/ReviewApprovalQueue.tsx`, `CrawlTargetPanel.tsx`, `reliability*.tsx`, `UniDbReviewContent.tsx`; `src/hooks/useReviewQueue.ts` | Live approval UI. |
| Prod DB: `institutions`, `guideline_documents`, `review_queue`, `intakes`, `v_review_queue_dashboard`, `v_needs_attention`, `fn_review_*` RPCs, `get-pdf-url` edge fn | Live data plane + approval RPCs. |
| Prod edge fn `notify-tracked-changes` (`hanguk_app/supabase/functions/notify-tracked-changes/`) | **Live** — scheduled every minute via pg_cron (`20260510112635_uni_db_v3_pg_cron_notify_tracked_changes.sql:76`). Do not confuse with legacy CRM functions. |

---

## Phase 1 — Zero-risk scratch / junk files ✅ EXECUTED 2026-07-11

> **Done** on branch `claude/hanguluk-cloud-sync-scheduler-r6bmy1` (this PR). All 29 files below were `git rm`'d after a final re-check confirmed their only references were the two `diff_status*.txt` dumps listing each other (both removed) and a store-submission *cleanup* checklist that lists them as junk to remove. Includes removing the checked-in PII dump `hanguk_app/identity_dump.json`.

Committed-by-accident debug dumps at repo root and under `hanguk_app/`. Every one is referenced only by the two `diff_status*.txt` git-status dumps (which are themselves scratch) or by the throwaway writer script that produced it — never by code, build, CI, or the live path.

| Path | Kind | Why safe | Verification done |
|---|---|---|---|
| `diff_status.txt` | scratch | `git diff --stat` dump; no importer | rg `diff_status` → self only |
| `diff_status2.txt` | scratch | git status dump (dup size) | rg `diff_status2` → 0 code hits |
| `reflog.txt` | scratch | `git reflog` dump | rg `reflog` → 0 hits |
| `git_log_out.txt` | scratch | raw `git log` | rg → only diff_status dumps |
| `git_show_out.txt` | scratch | `git show 759087c` dump | rg → only diff_status dumps |
| `db_out.txt` | scratch | one-off query dump | rg → no reader |
| `db_out2.txt` | scratch | one-off query dump | rg → only diff_status dumps |
| `db_out3.txt` | scratch | written by `scripts/legacy_merge/test_db.mjs`, never read | rg → writer only |
| `db_help.txt` | scratch | `supabase db --help` dump | rg → diff_status only |
| `db_query_help.txt` | scratch | `supabase db query --help` dump | rg → diff_status only |
| `prof_db.txt` | scratch | `profiles` column list literal | rg → diff_status only |
| `supabase_tables.txt` | scratch | table-listing dump | rg → diff_status only |
| `assign_out.txt` | scratch | assignment-script console log | rg → diff_status only |
| `test_codes_out.txt` | scratch | written by `scripts/legacy_merge/test_db_codes.mjs`, never read | rg → writer only |
| `test_db_apps_out.txt` | scratch | written by `test_db_apps.mjs` (queries dropped `universities`) | rg → writer only |
| `test_db_codes2.txt` | scratch | written by `test_db_codes2.mjs`, never read | rg → writer only |
| `test_db_magic_all_out.txt` | scratch | 27-byte dump | rg → diff_status only |
| `test_db_priorities.json` | scratch | written by `test_db_prio.mjs`, never read | rg → writer only |
| `test_db_rooms_out.json` | scratch | written by `test_db_rooms.mjs`, never read | rg → writer only |
| `test_db_sugs_out.txt` | scratch | written by `test_db_sugs.mjs`, never read | rg → writer only |
| `test_sugs2.json` | scratch | suggestions row dump | rg → diff_status only |
| `unis.json` | scratch | dump of dropped `universities` table | rg → diff_status only |
| `old.pdf` | scratch | 76-byte JSON 404 error, not a PDF | rg → diff_status only |
| `forma_tijoriy_taklif.html` | scratch | standalone commercial-offer HTML; not a Vite entry | rg → 0 hits; `vite.config.ts` has no extra input |
| `crm_page.html` | scratch | 15-byte "Redirecting…" snapshot; not a Vite entry | rg → diff_status only |
| `hanguk_app/dump.json` | scratch | intake-row debug dump | rg → only cleanup-checklist docs |
| `hanguk_app/identity_dump.json` | scratch | **PII** profile/identity dump; deleting also removes checked-in PII | rg → only cleanup/gitignore docs |
| `hanguk_app/tmp_query.cjs` | scratch | `tmp_`-prefixed throwaway hitting dropped `universities` w/ hardcoded key | rg → only audit docs |
| `legacy_export_v2.json` | scratch | 2.6MB one-off export read only by un-wired `scripts/legacy_merge/*` | rg → legacy_merge scripts only; not in package.json/CI |

**Execute later (Phase 1):**
```bash
git switch -c cleanup/phase1-scratch
git rm diff_status.txt diff_status2.txt reflog.txt git_log_out.txt git_show_out.txt \
       db_out.txt db_out2.txt db_out3.txt db_help.txt db_query_help.txt prof_db.txt \
       supabase_tables.txt assign_out.txt test_codes_out.txt test_db_apps_out.txt \
       test_db_codes2.txt test_db_magic_all_out.txt test_db_priorities.json \
       test_db_rooms_out.json test_db_sugs_out.txt test_sugs2.json unis.json old.pdf \
       forma_tijoriy_taklif.html crm_page.html \
       hanguk_app/dump.json hanguk_app/identity_dump.json hanguk_app/tmp_query.cjs \
       legacy_export_v2.json
# Optional same-PR: git rm -r scripts/legacy_merge  (the writers of several of the above; see owner_decision if unsure)
npm run build && npm test   # sanity
git commit -m "chore(cleanup): remove committed scratch/debug dumps (phase 1)"
```

---

## Phase 2 — Dead legacy edge functions + orphaned frontend clients/hooks ✅ REPO-SIDE EXECUTED 2026-07-11

> **Done** on branch `claude/hanguluk-cloud-sync-scheduler-r6bmy1` (this PR): deleted the 3 orphaned frontend files + all 10 legacy edge-function dirs, and pruned their 10 `[functions.*]` stanzas from `supabase/config.toml` (surgical — live functions kept). Re-verified: the 3 frontend files had zero importers (only two prose comments in `UniversitiesContent.tsx`, updated); the 10 functions form a closed cluster with no live external caller. `vite build` green.
> **Still owner-run:** undeploy the functions from prod (`supabase functions delete <slug>` per slug) — the repo no longer defines them, but they linger in the prod project until removed.

The legacy Firecrawl/Gemini "application-form / university-import" family (system A). All read or write the **dropped** `public.universities` table, and their only frontend entry points (`applicationFormsApi`, `useAdmissionSync`) have **zero importers** in `src/`. None is in the live edge set (`get-pdf-url` + `notify-tracked-changes` only).

| Path | Kind | Why safe | Verification done |
|---|---|---|---|
| `src/lib/api/applicationForms.ts` | file | `applicationFormsApi` imported nowhere in `src/`; no barrel re-export; targets only legacy edge fns | rg module + `applicationFormsApi` → 0 importers; handoff patch 0002 shows import already removed |
| `src/hooks/useAdmissionSync.ts` | file | `useAdmissionSync` mounted by no component | rg → 0 importers |
| `src/lib/api/koreanUniversities.ts` | file | Neutered stub; every method throws `disabled()`; 0 importers | rg → 0 imports; only prose comments in `UniversitiesContent.tsx` |
| `supabase/functions/sync-admission-forms` | edge_fn | Firecrawl orchestrator writing dropped `universities`; only caller is dead `useAdmissionSync` | rg invoke → self-chain only; no cron |
| `supabase/functions/find-application-form` | edge_fn | Firecrawl finder on dropped `universities`; both invoke sites dead | rg → dead callers only |
| `supabase/functions/analyze-application-form` | edge_fn | Gemini analyzer on dropped `universities`; both invoke sites dead | rg → dead callers only |
| `supabase/functions/discover-university-websites` | edge_fn | Firecrawl crawler writing dropped `universities`; frontend invokes removed in cutover patch | rg → self-chain + removed lines only |
| `supabase/functions/find-faculty-forms` | edge_fn | Legacy faculty-form finder on dropped `universities`; only caller is dead `applicationForms.ts` | rg → self-recursion + dead caller |
| `supabase/functions/search-university` | edge_fn | Firecrawl+Gemini search writing dropped `universities`; sole invoker `applicationForms.ts:331` is dead | rg → dead caller only |
| `supabase/functions/check-search-job` | edge_fn | Poller for legacy `search_jobs`; sole invoker `applicationForms.ts:342` is dead | rg → dead caller only |
| `supabase/functions/validate-application-data` | edge_fn | Validates legacy form data vs dropped `universities`; sole invoker dead | rg → dead caller only |
| `supabase/functions/import-academyinfo` | edge_fn | Bulk seeder writing dropped `universities`; no invoke caller | rg → config + legacy export only |
| `supabase/functions/seed-gks-data` | edge_fn | One-shot GKS seeder reading dropped `universities`; no caller (target tables `gks_*` preserved, untouched) | rg → config + legacy export only |

> **Note on `search-university` / `check-search-job`:** the `supabase/config.toml` candidate flags these as "live" because `applicationForms.ts` invokes them — but that file is itself dead (zero importers), so the functions are effectively unreachable. Delete verdict holds; the point matters only for pruning `config.toml` (see owner_decision on that file).

**Execute later (Phase 2):**
```bash
git switch -c cleanup/phase2-legacy-edge-hooks
git rm src/lib/api/applicationForms.ts src/hooks/useAdmissionSync.ts src/lib/api/koreanUniversities.ts
git rm -r supabase/functions/{sync-admission-forms,find-application-form,analyze-application-form,\
discover-university-websites,find-faculty-forms,search-university,check-search-job,\
validate-application-data,import-academyinfo,seed-gks-data}
# Prune the matching [functions.*] stanzas from supabase/config.toml (surgical EDIT — do NOT delete the file):
#   lines ~99 (find-application-form), 105 (validate-application-data), 111 (search-university),
#   120 (discover-university-websites), 123 (find-faculty-forms), 126 (check-search-job),
#   138 (seed-gks-data), 141 (import-academyinfo), + sync/analyze stanzas.
# Undeploy from prod (owner-run, after repo merge):
#   supabase functions delete sync-admission-forms  (repeat per slug)
npm run build && npm test
git commit -m "chore(cleanup): remove dead legacy application-form edge fns + orphaned hooks (phase 2)"
```
Fix the two prose-only comments in `src/components/crm/pages/UniversitiesContent.tsx` (lines 6, 20) that mention `koreanUniversities`. The architecture-graph seed rows in migration `20260217204752_*.sql` and `legacy_export_v2.json` nodes are dead wiring — clean up in an owner-reviewed follow-up, they don't block removal.

---

## Phase 3 — Retire the board-polling discovery cluster ✅ EXECUTED 2026-07-11 (per decision A)

> **Done** on branch `claude/hanguluk-cloud-sync-scheduler-r6bmy1` (this PR). Owner decision A confirmed the cloud Routine (`find-guidelines`) has replaced the Hetzner `uni-db-sync` timer, so the whole board-polling crawl cluster was retired as one coordinated change:
> - **Removed (src):** `workers/discovery_worker.py`; `discovery/{change_detection,registry,classifier,canonical_sources,attachment_downloader}.py`; the board adapters `discovery/adapters/{html_list,json_api,playwright,rss}_adapter.py` + the whole `discovery/adapters/configs/` dir. Kept: `naver_search_adapter.py`, `_adapter_base.py`, `keywords_ko.py`, `models.py` (finder reuses these), and the entire `propose_*` path (`propose_worker.registrable_domain` is finder-reused).
> - **Removed (scripts/tests/infra):** `scripts/{run_discovery_once,_remote_test,_cbnu_adapter_debug}.py`; 7 coupled test files + 2 fixtures (`snu_list.html`, `sample_rss.xml`); `infra/systemd/uni-db-sync.{service,timer}`.
> - **Edited:** dropped the `crawl` subcommand from `cli.py`; removed the two orphaned fixtures from `tests/conftest.py`; `infra/deploy.sh` now disables `uni-db-sync` and enables only `uni-db-adiga-calendar` (the separate weekly Adiga fetch, kept). `run-pipeline` + `fetch_worker.fetch_candidates` were **left intact** (not in decision A; they read the still-present `announcements` tables).
> - **Verified:** `524 uni_db tests pass`, `ruff check src tests` clean.
>
> **⚠️ Deploy sequencing:** merging this PR does **not** touch the Hetzner box — the old units keep running there until someone runs `deploy.sh`. Once the updated `deploy.sh` is run it will *stop* the Hetzner crawl, so the cloud Routine must be confirmed working (its secrets set — see go-live prerequisite) **before** that deploy, or there will be a coverage gap.
>
> **Still owner-run (Phase 4):** drop the now-unfed prod tables `crawl_findings` / `announcement_sources` (+ the unused `classifier_label` column) after a backup. Not removed here: `upstream/data_go_kr.py` and `extract/cost_estimator.py` (deferred — the latter is owner_decision F).

### (original analysis) Dormant uni_db discovery modules NOT reused by the live path

These are genuinely un-wired: the finder imports only `naver_search_adapter` + `discovery.models`, never these. Cleanly removable **except** `registry.py`, which is coupled to the dormant crawl cluster and can only go as part of that cluster's retirement (owner_decision).

| Path | Kind | Why safe | Verification done |
|---|---|---|---|
| `hanguk_app/services/uni_db/src/uni_db/discovery/attachment_downloader.py` | file | `download_attachment` has zero importers; finder resolves attachments via `fetch_worker`/`generic_attachment` | rg module + symbol → self + stale README tree line only |
| `hanguk_app/services/uni_db/src/uni_db/discovery/canonical_sources.py` | file | `CANONICAL_SOURCES`/`canonical_source_for` imported only by its own test; feature never wired | rg → paired test only |
| `hanguk_app/services/uni_db/tests/unit/test_canonical_sources.py` | test | Guards the above; remove together | tests only its subject |
| `hanguk_app/services/uni_db/src/uni_db/discovery/adapters/rss_adapter.py` | file | Not in `ADAPTER_REGISTRY`; CLI `crawl` hardcodes `HtmlListAdapter`; finder uses only Naver; `feedparser` imported nowhere else | rg → self + own fixture test |
| `hanguk_app/services/uni_db/tests/integration/test_rss_adapter_fixture.py` | test | Self-test of `rss_adapter`; remove together | tests only its subject |
| `hanguk_app/services/uni_db/src/uni_db/upstream/data_go_kr.py` | file | `DataGoKrDataset`/`fetch_page` never called; `upstream/__init__.py` exports nothing from it; probe script reads config not module | rg `import data_go_kr` → 0 |
| `hanguk_app/services/uni_db/tests/unit/test_cost_estimator.py` | test | Guards `extract/cost_estimator.py`, which has zero production importers | rg `cost_estimator` → tests only (see owner_decision on the module itself) |

**Coupled — list here but gate on the discovery-subsystem decision:**

| Path | Kind | Constraint |
|---|---|---|
| `hanguk_app/services/uni_db/src/uni_db/discovery/registry.py` | file | Verdict *delete*, but `RegistrySource` is imported by `discovery_worker.py`, the fixture-only `cli.py:242` `crawl` subcommand, and `run_discovery_once.py`. Removing it alone makes `uni-db crawl --fixture` raise `ImportError`. Only remove **together with** `discovery_worker.py` + `run_discovery_once.py` + the `crawl` subcommand + their 2 tests — i.e. as part of retiring the dormant crawl cluster (owner_decision). |

**Execute later (Phase 3, clean subset only):**
```bash
git switch -c cleanup/phase3-dormant-discovery
git rm hanguk_app/services/uni_db/src/uni_db/discovery/attachment_downloader.py \
       hanguk_app/services/uni_db/src/uni_db/discovery/canonical_sources.py \
       hanguk_app/services/uni_db/tests/unit/test_canonical_sources.py \
       hanguk_app/services/uni_db/src/uni_db/discovery/adapters/rss_adapter.py \
       hanguk_app/services/uni_db/tests/integration/test_rss_adapter_fixture.py \
       hanguk_app/services/uni_db/src/uni_db/upstream/data_go_kr.py
# test_cost_estimator.py: remove only if the cost_estimator owner_decision resolves to "delete".
cd hanguk_app/services/uni_db && python -m pytest   # must stay green
git commit -m "chore(cleanup): remove un-wired dormant discovery modules (phase 3)"
```
Update the doc-only references (README file-tree line 59, two markdown design docs) as follow-up; they are not callers.

---

## Phase 4 — Prod DB tables + prod-only edge functions (needs owner sign-off + backup)

These live only in prod (not in the repo, or a repo table with data). All are empty, backup, or confirmed-orphaned via read-only Supabase MCP on project `Hanguk 2026` (`lysjdtyanhdfphqyijsr`). **Do not run without owner sign-off and a verified backup.**

### 4a. Prod-only edge functions (delete)

| Slug (prod) | Why safe | Verification done |
|---|---|---|
| `process-guideline` (v4) | Absent from repo; emits `entity_type='crawl_finding'` which appears in **0** `review_queue` rows; superseded by live Python `parse_worker` | rg → 0; MCP: 255 review_queue rows are `extraction_jobs`+`guideline_documents` only |
| `import-korean-universities` (v31) | Legacy Firecrawl+Gemini writing dropped `universities`; sole caller `koreanUniversities.ts` neutered | rg invoke → 0; MCP: not in repo |
| `voice-bakeoff-tmp` (v7) | Self-labeled temporary TTS bake-off; untracked; zero callers/cron. **Tear down with `voice_bakeoff_results` table (owner_decision) since it is the table's sole writer.** | rg `bakeoff` → 0; MCP: no cron/view/RPC |
| `diagtranslate` (v18) | Deployed twice within 88s (2026-05-19) then abandoned; real translate fns updated through July | rg → 0; MCP: no cron/proc/view |

### 4b. Prod DB tables (drop)

| Table | Why safe | Verification done |
|---|---|---|
| `public.application_form_cache` | Legacy crawler cache, **0 rows**; only dead frontend/edge refs | MCP: 0 rows, 0 views, 0 fns. **Has FK children `application_form_changes`+`application_form_validations` — drop in one CASCADE** |
| `public.application_form_changes` | Legacy change-tracking, **0 rows**; only dead refs | MCP: 0 rows, no view/fn/FK/cron |
| `public.admission_sync_jobs` | Superseded by `extraction_jobs`; **47 stale rows** (since 2026-04-02); only writer is dead `sync-admission-forms`, only reader dead `useAdmissionSync` | MCP: no view/RPC/trigger/FK/cron. **Back up 47 rows first** |
| `public.crawl_page_cache` | Orphan; **8 rows**; described writer (`crawl-worker`/`ai_crawl_config`) does not exist in repo; live change-detection uses content-hash not ETag | rg → 0; MCP: no view/RPC/trigger/FK |
| `public.tasks_backup_20260612` | Ad-hoc backup snapshot, **58 rows**, RLS **disabled** (security exposure); no dependents | rg → 0; MCP: no view/fn/FK |
| `public.task_comments_backup_20260612` | Backup snapshot, **5 rows**, RLS disabled; no dependents | rg → 0; MCP: no view/fn/FK |
| `public.mig_contract_to_receipt` | One-time migration mapping (`mig_` prefix), **49 rows**; not created by any tracked migration; no dependents | rg → 0; MCP: no FK/view/trigger/fn |

**Execute later (Phase 4 — owner-run, after backup):**
```sql
-- 0. BACKUP FIRST (pg_dump or per-table snapshot of the non-empty ones):
--    admission_sync_jobs (47), crawl_page_cache (8), tasks_backup_20260612 (58),
--    task_comments_backup_20260612 (5), mig_contract_to_receipt (49)
--    e.g.  CREATE TABLE _archive.admission_sync_jobs_20260711 AS TABLE public.admission_sync_jobs;

-- 1. Tables (single migration, reviewed):
DROP TABLE IF EXISTS public.application_form_cache CASCADE;   -- takes form_changes + form_validations
DROP TABLE IF EXISTS public.admission_sync_jobs;
DROP TABLE IF EXISTS public.crawl_page_cache;
DROP TABLE IF EXISTS public.tasks_backup_20260612;
DROP TABLE IF EXISTS public.task_comments_backup_20260612;
DROP TABLE IF EXISTS public.mig_contract_to_receipt;
```
```bash
# 2. Prod-only edge fns (owner-run):
supabase functions delete process-guideline
supabase functions delete import-korean-universities
supabase functions delete diagtranslate
# voice-bakeoff-tmp: delete together with dropping voice_bakeoff_results (owner_decision below)
```
Do Phase 4 as an owner-approved migration PR so the drop is captured in `hanguk_app/supabase/migrations/`, not applied ad-hoc.

---

## owner_decision — needs a human call

Each item below **failed the "zero live references" bar** and cannot be mechanically deleted. Grouped by the decision that unblocks it.

> **Owner decisions received 2026-07-11:**
> - **A (two schedulers):** the cloud Claude Routine (`find-guidelines`) has **fully replaced** the Hetzner `uni-db-sync` timer → **retire the entire board-polling discovery cluster** as one coordinated PR.
> - **B (AI edge-crawl):** **abandoned → tear it down** (unschedule cron job #5, drop the RPC + `ai_crawl_config`, delete `crawl-dispatcher`/`crawl-worker`).
> - **C (`compare-universities`):** **rebuild on `institutions`** (keep the feature; repoint fn + UI) — a feature-fix task, scoped separately from cleanup, not a delete.
> - **D/E/F and the rest remain open** (see below).
>
> These convert A and B into executable retirement PRs (still owner-run for the prod-teardown steps + backups) and reclassify C as a rebuild, not a removal. Phase 1 (scratch/junk) has been **executed** on this branch.

### A. The dormant board-polling discovery subsystem — ✅ RESOLVED: retire as a unit

`discovery_worker.py`, `change_detection.py`, `registry.py`, `html_list_adapter.py`, `json_api_adapter.py`, `playwright_list_adapter.py`, `discovery/adapters/configs/**` (dir), `scripts/run_discovery_once.py`, `discovery/models.py::CrawlRunSummary`, `crawl_findings` (prod table), `uni-db-sync.service`, `uni-db-sync.timer`, plus the `crawl` subcommand in `cli.py`.

- **Why parked:** none of these is on the finder/verify/parse path, and `docs/uni_db/auto-crawl-revival.md` says the revival deliberately does **not** use per-site adapters. But the whole cluster is still coherent, CI-tested, and **wired into a deployed systemd unit**: `infra/systemd/uni-db-sync.timer` (`OnCalendar=hourly`) → `uni-db-sync.service:20` runs `scripts/run_discovery_once.py`, and `infra/deploy.sh:69,72` enables/starts it on every deploy. `crawl_findings` is written by `discovery_worker.write_run_to_db` and preserved in prod (~100 rows).
- **Question for the owner:** Is the Hetzner `uni-db-sync` hourly timer still the live scheduler in prod, or has the cloud Claude Routine (`find-guidelines`) fully replaced it? If replaced → retire the entire cluster in one coordinated PR (modules + configs + `crawl` subcommand + tests + `run_discovery_once.py` + `uni-db-sync.{service,timer}` + `deploy.sh` enable/start lines + README/runbook + drop `crawl_findings`/`announcement_sources`). If still live → keep all of it and mark it "dormant-but-deployed" so future audits stop flagging it.
- **Do not** delete any single file here in isolation — each deletion cascades to `ImportError` in the others, in `run_discovery_once.py`, and in the `uni-db crawl` subcommand, and reddens the offline uni-db CI workflow.

### B. The prod edge-crawl cluster (`ai_crawl_config` gate) — ✅ RESOLVED: tear it down

`crawl-dispatcher` (v5), `crawl-worker` (v6) prod edge fns; `public.ai_crawl_config` table; pg_cron job #5 `ai-crawl-dispatcher`; RPC `fn_invoke_crawl_dispatcher()`.

- **Why parked:** functionally inert (`ai_crawl_config.enabled=false`, `last_run_at=NULL`, 0 `crawl_finding` rows) and absent from the repo — but **pg_cron job #5 is ACTIVE** (`0 */4 * * *`) and calls `fn_invoke_crawl_dispatcher()` → `crawl-dispatcher` → `crawl-worker`. It only no-ops because of the `enabled` gate.
- **Question:** Confirm the AI edge-crawl experiment is abandoned. If yes → coordinated prod teardown: unschedule cron job #5, `DROP FUNCTION fn_invoke_crawl_dispatcher()`, `supabase functions delete crawl-dispatcher crawl-worker`, drop `ai_crawl_config`. Dropping any one alone leaves a dangling cron → RPC → 404 or a `relation does not exist` error every 4h.

### C. `compare-universities` (prod edge fn v31) — ✅ RESOLVED: rebuild on `institutions`

- Prod fn is non-functional (reads dropped `universities`/`university_notes`), but the **student-facing compare UI is still routed live**: `/portal` → `StudentPortal` → `UniversityMapKakao` → `UniversityComparisonChat.tsx:172` fetches `/functions/v1/compare-universities`. The repo's own `correction-plan.md:84` leaves this open.
- **Question:** Remove the compare feature entirely, or rebuild it on `institutions`? A blind delete leaves a mounted page calling a deleted endpoint. Coordinate the fn removal with the UI.

### D. `orbit-*` prod edge fns (`orbit-read/write/signal/app/ask/telegram-webhook`) — foreign system

- Zero repo references, but all 6 are **ACTIVE and brand-new (2026-07)** in the shared prod project, with `entrypoint_path` pointing at an external source tree not in this monorepo. Likely a separate live "orbit" product sharing this database.
- **Question:** Confirm ownership of the external orbit codebase before touching prod. From this repo's scope there is nothing to delete — do **not** unilaterally undeploy.

### E. `voice_bakeoff_results` table + `voice-bakeoff-tmp` fn

- Table (24 rows) has no repo/DB dependents, but its **sole writer is the still-deployed `voice-bakeoff-tmp` fn** (secret-gated, manual).
- **Question:** Is the Uzbek TTS bake-off concluded? If yes → drop the table and delete the fn **together** (they're in Phase 4a/4b conditionally). If it may still be run, leave both.

### F. `extract/cost_estimator.py` + its test — wire in the cost gate, or drop it?

- Zero production importers (not called by finder / orchestrator / parse_worker), but it's a **documented, intended** feature (`PHASE_1_NOTES.md`, `full_sync_and_automation_plan.md` describe the "skip LLM → HITL" cost gate) and is exercised by `test_pipeline_end_to_end.py` + `test_cost_estimator.py`.
- **Question:** Still planning to wire the cost gate into the orchestrator? If yes → keep both. If abandoned → delete module + `test_cost_estimator.py` (the Phase-3 test row) and update the two design docs.

### G. `test_dates_ko.py` — coupled to a keep_reused module

- Guards `parse.dates_ko` (**keep_reused** — see DO NOT TOUCH). `iter_dates_in` is imported by two live-path integration tests and internally calls `parse_korean_date` (the exact fn this unit test covers).
- **Question:** None unless retiring `dates_ko` wholesale — which would also break the live integration tests and `calendar.md:38`. Default: **keep**.

### H. `supabase/config.toml` — surgical edit, never delete

- The **file is live** (registers ~40 edge functions). Only the stale stanzas listed in Phase 2 should be removed line-by-line.
- **Question:** Approve the surgical edit as part of the Phase 2 PR. Do not delete the file.

### I. Stale docs to update, not delete

`gemini-deploy-prompt.md`, `CURRENT_STATUS.md`, `UNIVERSITY_DB_BUILD_PLAN.md`, `runbooks/hanguk-uz-staff-crm-architecture.md`.

- All are cross-linked by other live docs/handoff patches, so deleting them dangles references. Each has confirmed stale content (obsolete branch pins, non-existent per-stage systemd units, "discovery worker" phrasing superseded by the finder). Note: `hanguk-uz-staff-crm-architecture.md`'s `notify-tracked-changes` reference is **accurate** (that fn is live) — only the "discovery worker" wording is stale.
- **Question:** Assign an owner to refresh (fix branch refs, correct the systemd layout to `uni-db-sync.{service,timer}` / `uni-db-ocr` / `uni-db-adiga-calendar`, drop Gemini-deploy delegation) or mark them archived. Do not delete.

---

## Verification method

Every verdict above was produced by three independent checks; a candidate had to survive all three:

1. **Ripgrep import trace.** For each path, searched the whole repo (`src/`, `hanguk_app/services/uni_db/src/uni_db`, `supabase/`, migrations, CI, configs) for the module path, every exported symbol, barrel/`__init__` re-exports, and dynamic dispatch (`invoke('…')`, `importlib`, `getattr`, `__subclasses__`, CLI-name strings). A path was eligible for `delete` only with zero live importers.
2. **Adversarial refute pass.** For each "dead" claim we actively tried to *disprove* it — looking specifically for non-obvious callers: systemd units and `deploy.sh`, pg_cron jobs, self-recursive edge-fn fan-out, test-only vs live-path tests, and doc/prompt contracts. Several candidates flipped from `delete` to `owner_decision`/`keep_*` here (e.g. `classifier.py`, `dates_ko.py`, the discovery cluster wired into `uni-db-sync`).
3. **Supabase read-only (prod) MCP.** For prod tables and prod-only edge functions on project `Hanguk 2026` (`lysjdtyanhdfphqyijsr`), confirmed row counts, RLS state, and — via `information_schema` / `pg_depend` / `pg_rewrite` / `pg_constraint` / `cron.job` — the absence (or presence) of dependent views, RPCs, triggers, FKs, and cron schedules. No writes were performed.

Confidence is carried per-candidate (`identifier_confidence`) and reflected in the phase ordering: Phase 1 = `high` confidence / `none` risk, escalating to Phase 4 = prod changes requiring backup + sign-off.
