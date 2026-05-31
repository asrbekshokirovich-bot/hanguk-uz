# Phase 2 — what's done, what's still mocked, what changed from §I

> Paired with [`UNIVERSITY_DB_BUILD_PLAN.md` §I-Phase-2](../../UNIVERSITY_DB_BUILD_PLAN.md)
> and the 10 ADRs at [`docs/decisions/`](../../docs/decisions/). Phase 0
> notes are in `services/uni_db/README.md`; Phase 1 in `PHASE_1_NOTES.md`.
> This file is the diff Phase 2 introduces and the active source of
> truth for "what runs how today".

## Headline change — Phase 2 reframes around the §O ADRs

The plan's Phase 2 (§I) was written for a public consumer product. The
10 §O ADRs landed in commit `83cc097` and reframed the project as an
**internal tool for contracted students** (ADR-007). Phase 2 here is
the §I scope **filtered through those ADRs** — meaningful deferrals are
documented inline below.

## Components added / promoted in Phase 2

| Area | Phase 1 → Phase 2 |
|---|---|
| **OCR (ADR-002)** | Naver Clova stub → `parse/ocr_easyocr.py`. Provider-swap shim in `run_ocr()` so `UNI_DB_OCR_PROVIDER=naver_clova` flips the path back if ADR-002's reversal trigger fires. EasyOCR pulled in via `pyproject.toml` `heavy` extras (transitively pulls torch ~2 GB; only paid for when `pip install -e .[heavy]`). |
| **Extract orchestrator** | New `parse/extract_orchestrator.py` — picks PyMuPDF text layer when chars/page ≥ 80, else routes to OCR. Pure decision logic + decision record so HITL can debug routing. |
| **Blob storage (ADR-009)** | Single `storage.py` module → `storage/` package: `common.py` facade, `supabase_storage.py` (canonical), `r2.py` (deprecated, raises with ADR-009 pointer). Backend selected by `UNI_DB_BLOB_STORAGE` env (default `supabase_storage`). Bucket creation lives in `20260606000000_uni_db_v2_storage_bucket.sql` + `pdf_access_log` audit table. |
| **Internal-only RLS (ADR-007)** | New migration `20260606000100_uni_db_v2_internal_only_rls.sql` adds `fn_is_app_user()` SECURITY DEFINER helper and replaces every `using (true)` policy on the recruitment-data tables with `using (fn_is_app_user())`. Profile role enum extended with `'contracted_student'` (forward-compat; existing `'student'` rows continue to work). |
| **Archetype calibration prompts** | Each `_archetype_*_few_shots.md` (A–H) now carries 2 worked-example blocks drawn from `docs/samples/`. The few-shots are concrete enough for snapshot testing; counselor-side reviewers can confirm the JSON shape. |
| **Scholarships prompt** | TOPIK-tier table parsing pattern + country-of-origin matrix per audit §1.2 / ADR-007 priority cohort (UZ / VN / CN / MN / KZ). |
| **Document-checklist prompt** | Full country-of-origin routing matrix for HS diploma / transcript / family relationship docs. Encodes `_blocked_countries` for apostille-only schools (a counselor-actionable rejection condition for Uzbek-cohort applicants). |
| **proposed_sources HITL flow** | New table + RLS + `v_proposed_sources_queue` view + plpgsql trigger that promotes approved rows to `announcement_sources` automatically. Discovery worker's auto-propose path lives at `discovery/propose_source.py`. |
| **Top-30 seed** | `20260606000300_uni_db_v2_seed_announcement_sources_top30.sql` adds 15 more priority KO admission boards (mid-Seoul privates, STEM-specialized, remaining 거점국립대 flagships). All status=`discovered` so they don't poll until promoted. |
| **Translation default-on (ADR-004)** | Phase 2 enabled = {`en`}. `target_lang='uz'` (and others) raises `LanguageNotEnabledError` with an ADR-004 pointer. Override with `UNI_DB_TRANSLATION_LANGUAGES=en,uz` once Phase 3 ships. |

## Tests — 210 / 210 pass on Python 3.12.10

`make test` (or `.venv\Scripts\python.exe -m pytest -q`) — full suite,
1.94 s on a CPU-only laptop.

```
Phase 0+1 baseline:           176 tests
+ test_ocr_easyocr             4
+ test_extract_orchestrator    8
+ test_storage                 8
+ test_propose_source         11
+ test_translation gate        3
                             ----
Phase 2 total                210 tests
```

No live calls. No DB writes. EasyOCR model is NOT downloaded by tests
(stubbed via `settings.live_apis=false`). Supabase Storage uploads
fall back to local `.cache/blobs/` shim under the same flag.

## Components still intentionally mocked / disabled

| Capability | Why | Re-enable |
|---|---|---|
| Anthropic Claude live calls | $1.30/guideline; needs owner approval. ADR-001 caps confirmed. | `ANTHROPIC_API_KEY` set + `UNI_DB_LIVE_APIS=true` |
| EasyOCR live model load | Pulls torch (~2 GB); not in default `dev` extras | `pip install -e .[heavy]` then `UNI_DB_LIVE_APIS=true` |
| Supabase Storage uploads | Falls back to local-cache when `UNI_DB_LIVE_APIS=false` | Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `UNI_DB_LIVE_APIS=true` |
| Naver Clova OCR (legacy stub) | Kept per ADR-002 reversal trigger | `UNI_DB_OCR_PROVIDER=naver_clova` plus its credentials |
| Live ac.kr crawl | Owner approval not yet in. Discovery still runs against fixtures. | `UNI_DB_LIVE_CRAWL=true` |
| Translation: uz / vi / mn / ru / id | ADR-004 — uz waits for Phase 3 native reviewer. Others not currently needed for the contracted-student cohort. | `UNI_DB_TRANSLATION_LANGUAGES=en,uz` (etc.) |
| Hetzner VPS provisioning (ADR-003) | Not provisioned in Phase 1; deferred to Phase 2 ops slot. | Manual Hetzner Console step + systemd unit |
| Production migrations | Baseline now real (replaced 2026-05-08 via pg_dump 17 against prod). Migrations themselves still pending the staging dry-run + push sequence in the Gemini deploy prompt Phase B. | Run `supabase db push --linked` after staging confirms |

## Deferred from §I-Phase-2 per ADR-007 (internal-only)

These were §I-Phase-2 deliverables that no longer apply:

- **Public REST API for partners** — Phase 4 in §I. Now indefinitely
  deferred. The contracted-student app uses Supabase JS SDK directly.
- **Premium tier billing** — Phase 5 in §I. Deferred per ADR-007 / 008.
- **Counselor B2B onboarding** — Phase 5 in §I. Deferred per ADR-008.
- **Public discoverability + marketing** — never relevant for an
  internal tool.
- **§K customer-success FTE** — replaced by ADR-005's in-office
  reviewer.

## Inconsistencies / contradictions noticed in the ADRs

While reading the 10 ADRs I noticed two minor inconsistencies. Neither
blocks Phase 2 work; both flagged for transparency:

1. **ADR-007 line 75-79 vs the user prompt's RLS request.** ADR-007
   says "The Phase 0/1 RLS policies already enforce per-user data
   scoping via `auth.uid()`. No additional gating is needed for
   internal-only mode". But the Phase 0/1 policies on the
   recruitment-data tables (`institutions`, `recruitment_units`, etc.)
   were `using (true)` / `using (is_visible_on_map = true)`, NOT scoped
   by `auth.uid()`. The user-scoped tables already had `auth.uid()`
   policies; the recruitment data tables did NOT.

   The Phase 2 prompt explicitly asks to "tighten" them to require an
   authenticated app-user. **I did the tightening** —
   `20260606000100_uni_db_v2_internal_only_rls.sql` is the migration.
   ADR-007's last paragraph is technically slightly off (it conflated
   user-scoped and recruitment-data RLS); the tightening migration is
   the literal-correct reading of the ADR's intent.

2. **ADR-007 vs ADR-009 / ADR-010 on R2 mention.** ADR-007 line 39
   says "Cloudflare R2 → Supabase Storage instead". ADR-009 makes
   that canonical. ADR-010 line 22 still lists "Cloudflare R2 /
   Supabase Storage" in the residency table. Harmless — both
   colocate with Supabase — but ADR-010 should one day be re-issued
   to drop R2 from the table.

## What's gating Phase 3

1. **Real prod schema baseline** ✅ landed 2026-05-08 — replaced
   the staging shim with a real `pg_dump` against prod
   (`lysjdtyanhdfphqyijsr`). 81 tables, 496 DDL statements, sanitized
   per the (now-deleted) MIGRATION_BASELINE_TODO. The next blocker is
   running the actual staging+prod push (Gemini deploy prompt Phase B).
2. **In-office reviewer (ADR-005) hired and onboarded** — the HITL
   workflow and the reviewer queue views exist, but no human is
   working them yet.
3. **First live ac.kr crawl approved** — the crawler is fully tested
   against fixtures; a one-time approval to flip `UNI_DB_LIVE_CRAWL`
   on for the top-30 seed sources unblocks Phase 3 freshness work.
4. **Anthropic API key + budget approval** — required to flip
   `UNI_DB_LIVE_APIS=true` for live extraction. Until then everything
   runs against mocked LLM outputs.
5. **Native Uzbek reviewer recruit** (ADR-004 reversal of the
   default-off gate) — the only remaining blocker for Uzbek
   translation Phase 3 launch.
6. **Supabase Storage bucket created on prod** — the bucket migration
   creates it, but only takes effect when the migration is applied.
   Tied to (1) above.

## Concrete next actions when ready for Phase 3

```bash
# 1. Real prod dump — see MIGRATION_BASELINE_TODO.md
# 2. Apply Phase 2 migrations to staging (verify before prod):
supabase db push --linked   # against the staging project
# 3. Smoke test: scripts/smoke_test_uni_db.sql still works
# 4. Onboard the in-office reviewer:
update public.profiles set role = 'uni_db_reviewer'
  where user_id = '<the new hire's auth.users.id>';
# 5. Enable live extraction (after billing alerts are set):
export UNI_DB_LIVE_APIS=true
export ANTHROPIC_API_KEY=sk-ant-...
# 6. Enable live crawl (after owner approval):
export UNI_DB_LIVE_CRAWL=true
```
