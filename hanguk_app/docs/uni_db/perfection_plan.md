# Korean Universities DB — Plan to "100% perfect"

_Last updated: 2026-05-26. Owner reference doc. Built from a live end-to-end
audit of prod (`lysjdtyanhdfphqyijsr`) + a comparative study of how other
admissions-data systems worldwide operate._

## Definition of "perfect"

For **every Korean university that admits foreign applicants**, an applicant in
the app sees **accurate, current, EN/UZ, cycle-scoped** admission data
(requirements, tuition, scholarships, calendar, required documents, programs) —
each fact **linked to the official 모집요강 + a "verified on" date**,
human-approved, and **auto-refreshed when the source changes**.

## How the world solves this (lessons applied here)

- **Korea has no canonical structured foreign-admissions dataset.** studyinkorea.go.kr
  (NIIED) is thin; Adiga/Uway/Jinhakapply are application gateways, not data. The
  per-cycle PDF 모집요강 is the source of truth → extraction + human review is
  unavoidable. This product is building what doesn't exist.
- **Aggregators (StudyPortals, Keystone, ApplyBoard, DAAD):** canonical program
  schema + stable institution IDs; freshness via crawl + editorial verification +
  university self-service; always show **"last updated" + a confirm-with-university
  disclaimer**. You are an aggregator, never the authority.
- **Centralized systems (UCAS, Common App, uni-assist, US Common Data Set, IPEDS):**
  model **cycles/rounds + deadlines** as first-class; **documents + translation/
  notarization/apostille is its own country-specific domain** (uni-assist); one
  canonical schema on a fixed refresh cadence.
- **AI extraction + HITL (Document AI, AWS A2I, Wikidata):** confidence-based
  routing to humans; an audit trail; a maintained **golden eval set** to measure
  accuracy and catch regressions; **provenance** (every published fact links to its
  source span + page + document URL); change-detection → re-extract; user error
  feedback.

### Design principles
1. Published-with-provenance or it doesn't exist.
2. You're an aggregator → source link + "verified on" + disclaimer.
3. Canonical schema + stable IDs.
4. Model cycles/rounds + deadlines explicitly.
5. Documents/translation is a first-class, country-specific domain.
6. Freshness via change-detection + visible recency.
7. HITL with confidence routing + audit trail.
8. A golden eval set to measure accuracy continuously.
9. Trust signals for users (verified-by/on, EN/UZ, deadline countdown, checklist).
10. User error-feedback loop.

## Current-state snapshot (2026-05-26)

- Discovery → 71 foreign-applicant universities approved (live sources).
- Ingest → **36 / 71** have a stored, parsed guideline; 0 failed to parse.
- Extraction success per section: requirements ~96%, tuition ~96%, scholarships
  ~85%, calendar ~81%, **documents_required ~40%** (JSON cut-off/fence, not schema).
- Review queue: 79 open items; 35 decisions so far, all rejects (early bad cards).
- **CRITICAL: every public table the app reads is empty** (`requirements`,
  `tuition`, `scholarships`, `university_admission_periods`, `documents_required`,
  `programs` = 0 rows). `fn_review_accept` only flips `review_queue.status`; there
  is **no publish/normalize step**. So applicants currently see nothing.

## The phased plan

| Phase | Goal | Core work |
|---|---|---|
| **0 — Publish** 🔴 | Approved data reaches the app **with provenance** | review-item JSON → normalized public tables; wire to accept; carry `source_url` + `verified_at`; backfill. Prerequisite for everything. |
| **1 — Cycle model** | Every fact scoped to year/round + deadline + audience | populate `admission_cycles`/`cycle_dates`; tag by cycle + audience (외국인/재외국민). |
| **2 — Extraction quality + golden set** | ~95%+ every section | fix `documents_required` JSON robustness; build a labeled golden eval set + per-release accuracy report; double-extract high-stakes fields. |
| **3 — Coverage** | All foreign-admission universities | OCR for HWP/scanned (Inha, Hongik…); deeper landing-page resolver; 403/SSL handling; widen discovery to the master list. |
| **4 — Documents & translation** | Trustworthy checklists | first-class document model (notarize/apostille/translate/copies, country-specific); complete EN/UZ + back-translation QC. |
| **5 — Freshness** | Never stale | change-detection re-extract on 모집요강 update; correction-notice priority; "verified N days ago" + staleness flags. |
| **6 — Institution metadata** | Clean catalog | real KO/EN names, type, region for the ~64 placeholders; reveal on map once verified. |
| **7 — Trust & feedback** | User-facing credibility | per-fact source + verified-on in app; "report an error" → `fn_flag_source_wrong`; disclaimer. |
| **8 — Hardening** | Safe & observable | Supabase security advisors (lock anon-exec SECURITY DEFINER fns, search_path, leaked-password); ops health dashboard + alerts; Python suite in CI. |
| **Cross-repo (hanguk-uz)** | Reviewer + display | accept/edit/publish UI; render published data with provenance/recency (separate handoff spec). |

**Sequence:** 0 first (turns latent extraction into visible value + unblocks all
later phases) → 1–2 make it trustworthy/filterable → 3–4 make it complete → 5–8
keep it current, clean, and safe.

## Build progress — 2026-05-26

**Shipped (backend, merged to main):**
- **Phase 0** — publish worker: approved review item JSON → public tables
  (requirements/tuition/scholarships/periods/documents), cycle-scoped + provenance,
  idempotent; wired into sync. Live smoke-tested (rollback) against real data.
- **Phase 1** — audience-aware cycle model: each row resolves its own cycle by
  audience (foreign vs 재외국민 vs transfer vs grad).
- **Phase 2** — `documents_required` recovery: wrapper-key normalization + salvage
  for the field-group-named array (was failing ~60%).
- **Phase 3** — broadened attachment resolver: accepts Korean "…모집요강" download
  links + .hwp, prefers PDF (the biggest ingest skip bucket).
- **Phase 5** — translate published content (eligibility/scholarship/doc names) to
  EN/UZ via the existing sync Translate step.
- **Phase 8** — Python CI (ruff + pytest, paths-filtered); ops dashboard
  `v_uni_db_health`.

**Remaining — needs a human, the app/reviewer repo, or a deliberate decision:**
- **Review/accept (you):** the HITL step. 0 approved today; accepting items is what
  makes publish→translate→app produce visible data.
- **Cross-repo (hanguk.uz frontend):** fix "Open source PDF" (post-`await`
  `window.open` popup-block); build the EN/UZ content viewer; Phase 7 trust signals
  (per-fact source + "verified on" + report-error). Specs handed off.
- **Phase 6 (institution metadata):** backfill real KO/EN names + type for the
  ~auto-created placeholders, then reveal on the map — needs human verification.
- **Phase 8 security:** lock anon EXECUTE on the uni_db SECURITY DEFINER review
  funcs + enable leaked-password protection — operator-reviewable (deferred to not
  risk the live reviewer mid-use).
- **Deferred:** Phase 2 golden eval set (ongoing QA); Phase 3 OCR/HWP text
  extraction (heavy `torch`/HWP deps — decide before adding).
