# Korean Universities Database — Implementation Build Plan

**Project:** Hanguk app (Flutter / Supabase / Riverpod / Vapi)
**Plan version:** 1.0
**Date:** 2026-05-07
**Author:** Claude (Cowork build-plan agent)
**Anchor audit:** [`UNIVERSITY_DB_AUDIT.md`](./UNIVERSITY_DB_AUDIT.md) (1.0, 2026-05-06) — referenced throughout by section number; this plan does **not** restate the audit and assumes the reader has it.

> Read order: §0 (existing system audit) → §A (executive summary) → §P (Korean-first principle, which is referenced from §C, §E, §F, §G, §H, §I, §J, §L) → the rest in order. The phasing in §I is the operational spine.

---

## 0. Existing System Audit — what is already built

This section enumerates every artifact in the Hanguk repository that touches universities, applications, admissions, scholarships, programs, or related data, and decides for each one: **Keep / Refactor / Replace / Delete**. The phases in §I always say "modify *X*" or "drop and rebuild *Y*" by referring back to this list.

### 0.1 Headline finding

The Hanguk repo today is, schema-wise, a **Lovable.dev-scaffolded CRM-style app**: one flat `universities` row per institution with marketing-grade fields (ranking, acceptance_rate, tuition_min/max, logo_url, description_en) and one flat `applications` row per student-university pair with a single `status` text column. There is **no admission-cycle modeling, no recruitment-unit modeling, no per-program tuition, no requirements/scholarships/documents-required schema, no crawl pipeline, no data lineage, and no translation system**.

The Flutter side (Riverpod + Freezed + GoRouter + supabase_flutter) is well-structured and reusable. The **integration surfaces** for the new system already exist as feature folders — `features/map`, `features/applications`, `features/training` (which has an `university_specific` interview path that today goes nowhere because there is no recruitment data to power it). These are kept and extended; the database is largely greenfield.

The canonical migration directory `supabase/migrations/` holds only six recent files (May 2026), all about auth/updater. The "real" schema lineage lives in `.claude/worktrees/infallible-hofstadter-868266/supabase/migrations/` (Lovable scaffold lineage from Jan–Apr 2026) and is not part of the canonical migration set. The first pre-flight task in Phase 0 is to **dump production schema → write a `00000000000000_baseline_schema.sql` migration → declare that as the new floor**, so we stop shipping schema changes against an undocumented baseline.

### 0.2 Flutter app inventory (lib/)

| Path | What it is | Verdict | Rationale |
|---|---|---|---|
| `lib/features/map/domain/university.dart` | Immutable `University` model: id, name (English-only), location (city_en), lat/long, logoUrl, ranking, localRank, acceptanceRate, tuitionMin/Max, isPartner, isVisibleOnMap, website, descriptionEn | **Refactor** | Field shape is wrong: no `nameKo`, no IEQAS status, no per-faculty tuition, no admission-cycle linkage. Rename to `Institution` (audit §1.1, §11), add Korean fields, demote tuitionMin/Max to derived/legacy. |
| `lib/features/map/data/map_repository.dart` | `universitiesProvider` — direct `select` from `universities` table | **Refactor** | Switch to a denormalized read view (`v_institutions_for_map`, see §C). Today's query reads `universities.*` raw; the new view will join in IEQAS, rounded next-deadline, partner status. Keep the provider name and signature so the map UI doesn't change. |
| `lib/features/map/presentation/map_tab.dart` and the entire `presentation/widgets/map_view/*` (mobile/web/platform), `university_card.dart`, `university_detail_sheet.dart`, `university_map_html.dart`, `roadview_html.dart`, `university_roadview_screen.dart` | Map UI, Naver RoadView embed | **Keep** | Pure presentation; will read the same shape via the new view. |
| `lib/features/applications/domain/application.dart` | `StudentApplication`: id, universityId, studentId, status (string), program (string), createdAt, university | **Refactor** | Add `recruitmentUnitId`, `admissionCycleId`, `applicantCategory` (외국인전형 / 재외국민 / etc.), `roundNumber`, `lastSyncedAt`. `program` becomes a derived label off `recruitmentUnitId`. Status becomes a typed enum (sealed class — coding-style.md requires sealed-types pattern matching). |
| `lib/features/applications/data/applications_repository.dart` | `suggestedUniversitiesProvider` (CRM push), `applicationsProvider`, `submitSelectedUniversities()` | **Refactor** | Keep the providers' public API (the UI calls them by name) but redirect the underlying queries: `suggestedUniversitiesProvider` reads from `user_tracked_universities` (pull) with `student_suggestions` as a *secondary* CRM-suggestion source; `applicationsProvider` joins `applications + admission_cycles + cycle_dates + recruitment_units`. Migrate via dual-read in Phase 1 (§I). |
| `lib/features/applications/data/university_chat_repository.dart` | Realtime chat for `university_rooms` / `room_channels` / `channel_messages` | **Keep** | Independent of the new schema. Becomes a delivery surface where the new "announcement detected" notifications can be posted as system messages. |
| `lib/features/applications/data/university_events_repository.dart` | `university_events` table reader (event_date, title_en/uz, description_en/uz, event_type) | **Replace** | This table is the closest existing analog to what the audit calls `cycle_dates`, but its shape is too thin (no source URL, no version, no applicant_category, no recruitment_unit). Drop and rebuild as `cycle_dates` + a denormalized `v_user_upcoming_deadlines` view. Migration plan in §I-Phase-1. |
| `lib/features/applications/presentation/applications_tab.dart` | Main applications screen | **Keep** | Presentation only. |
| `lib/features/applications/presentation/applications_view_model.dart` | `applicationsTabProvider` + `ApplicationsTabState` (pendingApps / activeApps / isEmpty / maxAllowedApplications=3) | **Refactor** | Keep the state shape; extend it with `nextDeadline`, `tracksAtRisk`, `cycle`. `maxAllowedApplications=3` becomes a per-cycle constraint. |
| `lib/features/applications/presentation/widgets/application_card.dart`, `process_tracker.dart`, `university_room_modal.dart`, `university_selection_view.dart` | Application UI | **Keep / light Refactor** | All four are presentation. `university_selection_view` will need a cycle picker added (Phase 2). `process_tracker` becomes a real timeline driven by `cycle_dates`. |
| `lib/features/training/data/interview_repository.dart` | `InterviewNotifier`, session lifecycle — `sessionType`: `general | university_specific | visa`, `targetUniversityId`, `targetUniversityName`, calls `interview-ai` / `interview-feedback` / `elevenlabs-tts` edge functions | **Keep / extend** | Excellent shape. The `university_specific` path is currently *unreachable from the UI* in any data-driven way (the dropdown exists, the targetUniversityId is wired, but there's nothing for the interviewer to draw on). Phase 2 wires `university_specific` to actually fetch the institution's recruitment unit, requirements, scholarship eligibility, and seed the interview prompt. |
| `lib/features/training/presentation/widgets/interview_setup_view.dart` | Dropdown w/ `general | university_specific | visa` | **Keep** | UI is fine. Add a cascading select: institution → recruitment_unit → applicant_category. |
| `lib/features/training/presentation/{interview_screen.dart, interview_active_view.dart, interview_feedback_view.dart, interview_history_view.dart, interview_analytics_view.dart}` | Interview-flow UI | **Keep** | Presentation only. |
| `lib/features/training/data/study_plan_repository.dart` | Study plans (TOPIK prep) | **Keep** | Orthogonal. |
| `lib/features/documents/domain/document.dart` | `AppDocument`: id, studentId, applicationId, name, filePath, fileType, fileSize, status, createdAt | **Refactor** | Add `documentType` enum (transcript / diploma / passport / SOP / LOR / financial-proof / etc.), `applicantCategoryRequired`, `countryOfIssuance`, `apostilleStatus`. Bind to new `documents_required` table by `(institution_id, applicant_category, document_type)`. |
| `lib/features/documents/domain/document_type.dart` | Document type enum | **Refactor** | Expand to cover the 15-item canonical checklist (audit §4.7). Become the authoritative type registry shared with `documents_required`. |
| `lib/features/documents/data/documents_repository.dart` | Document CRUD against `documents` + `student-documents` storage bucket | **Refactor** | Add validation that uploads match a row in `documents_required`. Today the repository accepts any file with any `fileType`. |
| `lib/features/chat/*` | Generic chat | **Keep** | Orthogonal. |
| `lib/features/auth/*` | Magic-code auth | **Keep** | Orthogonal. |
| `lib/features/home/*` | Home/welcome | **Keep** | Add a "next deadline" widget (Phase 0/1, §N). |
| `lib/core/router/app_router.dart` | GoRouter with `/`, `/welcome`, `/login` only | **Refactor** | Add four new typed routes (§H): `/institutions/:id`, `/institutions/compare`, `/applications/tracker`, `/notifications/settings`. Plus an admin-guarded `/admin/review` (§G Phase 2). |
| `lib/core/config/app_config.dart` | Supabase URL, anon key, Vapi public key, ElevenLabs voice IDs | **Keep** | Add nothing here yet; new env (Naver Clova OCR keys, Anthropic key for extraction) belongs server-side, not in the Flutter client. |
| `lib/design_system/*` | Themes + adaptive widgets | **Keep** | Add `LangBadge` + `TranslationPendingBadge` widgets (§P). |
| `lib/util/web_js_helper*` | Web-only JS bridge | **Keep** | Orthogonal. |
| `lib/features/updater/*` | App auto-updater | **Keep** | Orthogonal. |
| `lib/main.dart` | Entry, ProviderScope, MaterialApp | **Refactor (small)** | The app already calls `DevicePreview.locale(context)` in two places, but **there is no real Flutter localization wired up** (no `lib/l10n/`, no `*.arb`, no `flutter_localizations` dependency in `pubspec.yaml`, no `supportedLocales` declared). §P-2 makes adding `flutter_localizations` + `intl_utils` a Phase 2 task. Today, content is hardcoded in English strings inline. |

### 0.3 Existing localization state — important constraint

Because the user's instruction in §P says "the Flutter localization already exists", we want to verify: **it does not, in fact, exist as a proper Flutter `intl` setup**. What exists is:

1. **Database-side bilingualism**: the `universities` table has `name_en` and (per `applications_repository.dart` line 34/71) a `name_uz` column. The `university_events` table has `title_en/title_uz/description_en/description_uz`. So the **database is pre-wired for English + Uzbek**, no Korean.
2. **Client-side**: `DevicePreview.locale(context)` is passed to `MaterialApp.locale` for design-time previewing only. There is no `localizationsDelegates`, no `supportedLocales`, no `.arb` file, no `lib/l10n/` directory, no generated `AppLocalizations` class.
3. **Strings are hardcoded** in widgets in English. No translation lookup at runtime.

Therefore §P's instruction to "plug new university content into the existing `intl` setup without expanding it" needs to be interpreted as **the existing data-side bilingualism (en/uz) is what we plug into**; a proper Flutter `intl` UI-string layer is a Phase 2 deliverable, not pre-existing. This is called out explicitly in §P-4.

### 0.4 Supabase / database inventory

#### 0.4.1 Canonical (current) migrations — `supabase/migrations/`

| Migration | Touches universities/admissions? | Verdict |
|---|---|---|
| `20260505112535_interview_sessions_vapi_call_id.sql` | Indirect (interview targetUniversityId remains intact) | **Keep** |
| `20260505183000_admin_get_auth_user_id_by_email.sql` | No | Keep |
| `20260505183500_student_code_status_view.sql` | No | Keep |
| `20260506110000_fix_profiles_user_id_cascading_fks.sql` | Yes — references `university_documents` table in the FK list | **Keep** (the FK fix on `university_documents` we inherit; we do not rebuild that table in v1) |
| `20260506120000_app_versions_v2_schema.sql` | No | Keep |
| `20260506120100_app_version_pings_table.sql` | No | Keep |

#### 0.4.2 Lovable scaffold lineage — `.claude/worktrees/infallible-hofstadter-868266/supabase/migrations/`

This is the historical lineage (Jan–Apr 2026) including the `student_suggestions` table creation (`20260403151800_create_student_suggestions_table.sql`). This directory is **not** the canonical migrations source today; production schema drifted from it, and it is out of the active dev path.

**Decision:** in Phase 0 we run `supabase db dump --schema-only > supabase/migrations/00000000000001_lovable_baseline.sql` against production, sanitize, and check it in as the floor. The worktree migrations get archived (moved to `supabase/migrations/.lovable_archive/`) for forensic value but are no longer part of the rollup.

#### 0.4.3 Tables in production (inferred from code + schema fixes)

| Table | Shape (inferred) | Verdict for new system | Migration plan |
|---|---|---|---|
| `universities` | id, name_en, name_uz, city_en, latitude, longitude, logo_url, ranking, local_rank, acceptance_rate, tuition_min, tuition_max, is_partner, is_visible_on_map, website_url, description_en | **Refactor → rename to `institutions`** | Phase 0: alter table — add `name_ko, name_ko_short, kcue_code, ieqas_status, institution_type`. Phase 1: introduce `v_institutions` view that *is* the new shape and apps read from the view. Phase 2: rename table to `institutions`; recreate the `universities` view for legacy callers; drop legacy view in Phase 3. |
| `applications` | id, student_id, university_id, status, program, created_at | **Refactor — extend, don't replace** | Phase 1: add nullable `recruitment_unit_id, admission_cycle_id, applicant_category, round_number`. Phase 2: backfill from a one-time mapping job. Phase 3: drop `program` text column. |
| `student_suggestions` | student_id, university_id, status (`pending_approval`) | **Keep + supplement** | This is CRM-driven (counselor pushes suggestions to student). The new `user_tracked_universities` is student-pull. Both coexist; the UI merges them. |
| `interview_sessions` | id, student_id, session_type, status, target_university_id, target_university_name, focus_topic, timed_mode, time_limit_seconds, vapi_call_id, created_at | **Keep, extend** | Add `target_recruitment_unit_id, target_applicant_category`. Backfill: leave nulls; new sessions collect them. |
| `interview_messages` | session_id, role, content, created_at | **Keep** | No change. |
| `documents` | id, student_id, application_id, name, file_path, file_type, file_size, status, created_at | **Refactor** | Add `document_type, applicant_category, country_of_issuance`. |
| `university_rooms`, `room_channels`, `channel_messages` | per-uni discussion | **Keep** | Used as integration surface for "announcement detected" system messages. |
| `university_events` | id, room_id, title_en, title_uz, description_en, description_uz, event_date, event_type | **Replace** | Drop and rebuild as `cycle_dates` (§C). Migration plan in §I-Phase-1: dual-write for one cycle, then cut over. |
| `profiles` | user_id, full_name, avatar_url, magic_code, … | **Keep** | Add `preferred_lang` column (en | ko | uz | …) in Phase 2 (§P-4). |
| `app_versions`, `app_version_pings` | updater | **Keep** | Orthogonal. |
| `system_settings` | id='main', owner_created, … | **Keep** | Orthogonal. |
| `payments`, `scheduled_payments`, `student_budgets`, `university_documents` | billing/file storage | **Keep (out of scope for v1)** | Don't touch. |

#### 0.4.4 RLS, edge functions, storage, cron

- **RLS:** assumed configured per Lovable scaffold; not visible in canonical migrations. Phase 0 inventory task: write `scripts/dump_rls_policies.sql` and check in `supabase/_baseline_rls.sql` for forensic record.
- **Edge functions** (visible from code): `student-login-v2`, `interview-ai`, `interview-feedback`, `elevenlabs-tts`, `vapi-fetch-recording`. **None** related to university data ingestion. The new functions (`crawl-source`, `extract-guideline`, `translate-canonical`, `notify-tracked-changes`) are all greenfield.
- **Storage buckets:** `student-documents` exists (per `documents_repository.dart`). The new system needs a `guideline-blobs` bucket (immutable, SHA-256 keyed) for raw PDFs/HWPs.
- **pg_cron:** none observed. Phase 0 enables `pg_cron` extension and adds the discovery scheduler.
- **Materialized views:** none observed.

### 0.5 Backend / scripts / data

| Artifact | What it is | Verdict |
|---|---|---|
| `scripts/check_uni_schema.dart`, `check_unis.dart`, `check_anon_unis.dart`, `check_student_unis.dart`, `deep_audit.dart` | Read-only diagnostic Dart scripts for verifying universities table contents and student auth/data consistency | **Keep** as forensic tools, but they will need to be updated in Phase 2 when columns are renamed (`universities` → `institutions`). Add a Phase 0 task: rename them to `scripts/legacy_*.dart` and add a new `scripts/uni_db_smoke_test.dart` aimed at the new schema. |
| `scripts/check_supabase_status.mjs` | Node.js status check | **Keep** |
| `scripts/serve_web.ps1` | Web dev server launcher | **Keep** |
| `scripts/test_vapi.dart` | Vapi smoke test | **Keep** |
| `.github/workflows/` | Not present | **Add** in Phase 0 — at minimum CI runs `dart format --set-exit-if-changed`, `dart analyze --fatal-infos`, `flutter test`, plus a new `services/uni_db/` test job. |
| `assets/images/`, `assets/app_icon2.png` | Branding | **Keep** |
| Hardcoded university lists | Searched — none found in `lib/`, `assets/`, root JSON/CSV. All university data lives in Postgres. | n/a |
| Seed migrations inserting universities | None found in canonical migrations. Universities were either Lovable-seeded or admin-imported via Studio. **Source of truth is undocumented.** | Phase 0 inventory: write `scripts/snapshot_universities.dart` that exports a versioned CSV of current rows so we can replay. |

### 0.6 Quality assessment

- **Data freshness**: there are no `last_verified_at`, `valid_from`, `valid_to`, or version columns on any university-domain table. Today's `universities.*` is timeless — there is no way to tell when a row was last checked or whether it's stale. The new system makes provenance non-negotiable (audit §11.2).
- **Structure quality**: flat. `tuition_min`/`tuition_max` collapses what should be a per-faculty-per-semester table (audit §4.4 has the worked Yonsei example). `acceptance_rate` is a single number, not per-track.
- **Inconsistencies**: `applications_repository.dart` reads `name_uz` as a fallback for `name_en` (lines 34, 71), but `map_repository.dart` doesn't — meaning the map shows one label and the applications view shows another for any university where both fields differ. **Bug to flag.** Resolution in Phase 1: the new `v_institutions` view exposes a single `display_name(lang)` function.
- **Source of truth**: unknown for the existing universities rows. The new system establishes the Korean admissions-office board (per audit §6) as the canonical source; the existing rows become "unverified — needs first crawl."

### 0.7 Mapping to the audit's 32 canonical fields & 8 archetypes

Of the audit's 32 canonical fields (§5.3), **only 5 are partially modeled today** (institution_name_en — yes; tuition_per_semester — collapsed to min/max; recruitment_unit — partially via free-text `applications.program`; cycle — implicit in `application.created_at`; documents_required[] — table exists but type-less). The remaining **27 fields are missing**. The 8 archetypes (§5.2) are entirely unmodeled — there is no parser, no archetype dispatcher, no extraction pipeline.

### 0.8 Net rollup

The existing system is mostly Lovable-scaffolded CRM-style app — universities table is a flat single-row-per-university with marketing-grade fields, applications table is a flat status-per-student-per-uni, no admission-cycle modeling, no crawl/parse/HITL pipeline, no Korean-language data, no provenance, no proper Flutter `intl`. **The new system needs to be built largely greenfield**, but the existing Flutter feature folders (`features/applications`, `features/map`, `features/training`, `features/documents`) become the **integration surfaces** and the existing Riverpod providers become the **stable read-API** that the new schema feeds into via views. Greenfield scope: the entire Discovery → Source Registry → Fetch → Parse → Diff → HITL → Translate stack (Layers A through G in audit §11), the recruitment-unit / admission-cycle / requirements / scholarships / documents-required schema (§C), the Korean-first crawl with multilingual presentation (§P), and four new Flutter routes (§H). Refactor scope: `universities` table → `institutions`; `applications` table extension; `university_events` → `cycle_dates`; `documents` table extension; rename of `name_en/uz` collation rules across two repository files. Total estimate: **12 dev-weeks for Phases 0–3** (read §I).

---

## A. Executive summary

We are building an **always-fresh, Korean-source-of-truth, multilingual database of Korean university admissions** inside the Hanguk app. The core architectural bet is that **continuous crawling of Korean admissions boards + LLM extraction with HITL review beats publisher-self-service + manual data entry** for Hanguk's audience (international and visa-track applicants from Uzbekistan and the broader CIS / SE-Asia corridor). The audit (§6, §11) establishes the 9-layer pipeline; this plan is its operational realization on top of the existing Hanguk + Supabase + Riverpod stack.

**Who it is for.** Korean-language learners and visa-track applicants, primarily Uzbek-speaking but expanding to Vietnamese / Mongolian / Russian / Indonesian readers (the actual app today is en/uz; we extend per §P phasing). Secondary: counselors and partner-institution staff who use Hanguk's CRM-side workflow.

**v1 → v2 → v3 vision.**

- **v1 (end of Phase 3, week ~9).** 110 priority institutions covered with deadlines, tuition, requirements, scholarships, documents-required, and 외국인전형 / 재외국민 cycle dates extracted from Korean source PDFs and cleared through HITL. App displays Korean source with English translation and the Uzbek translation for the existing `name_uz`-aware screens. Push notifications fire on tracked-university changes.
- **v2 (end of Phase 4, week ~12).** Full IEQAS-158 (audit §3.1) covered. 전문대 included. Public-facing read API for partner counselors. Analytics on user-tracked universities. Vietnamese + Mongolian translation pipelines online (§P-3).
- **v3 (Phase 5+).** Multilingual UI parity (Russian, Indonesian), counselor mode (per-counselor caseload), payment-gated premium tier (full document checklist with country-specific apostille routing, AI explanation layer "what this 정정공고 means for your application"), and a partnership track with KCUE for direct data feed.

**Total estimated effort.** 12 dev-weeks for Phases 0–3 with the team described in §K. Phases 4–5 add ~8 dev-weeks.

**Monthly running cost.** Steady-state v1: **$130–$300/month** as the audit estimates (§7.15). High-season (Sep–Dec, audit §6.7) bursts to ~$450/month due to extraction LLM spend and OCR pages. Detailed month-by-month in §J.

---

## B. System architecture

The 9 layers in audit §11 mapped onto our concrete stack:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       KOREAN-SIDE DATA INGESTION                            │
│                                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐ │
│ │ A. Discovery    │  │ A2. Korean-     │  │ A3. National upstreams       │ │
│ │ (per-univ Korean│  │ keyword search  │  │ MOE okep / Adiga /           │ │
│ │ board pollers)  │  │ (Naver primary, │  │ Study in Korea / academyinfo │ │
│ │ pg_cron-driven  │  │ Daum / Google)  │  │ / data.go.kr OpenAPIs        │ │
│ └────────┬────────┘  └────────┬────────┘  └────────────┬─────────────────┘ │
│          └──────────┬─────────┴────────────────────────┘                   │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ B. Candidate detection                                                  │ │
│ │ Korean keyword rules + BGE-M3 embedding sim + Claude Haiku tiebreaker   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ C. Source registry (Postgres `announcement_sources` table)              │ │
│ │ Lifecycle: discovered → pending_review → live → deprecated              │ │
│ │ ALL URLs are Korean-side. /eng/ /en/ paths excluded by registry policy. │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ D. Fetch & version                                                      │ │
│ │ Python httpx + Playwright (JS sites). Immutable blob → Supabase Storage │ │
│ │ `guideline-blobs` bucket, SHA-256 keyed. Metadata in `guideline_documents` │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ E. Parse pipeline (Python workers, Supabase Edge dispatched)            │ │
│ │ PyMuPDF → pdfplumber/Camelot → Naver Clova OCR (Korean image PDFs)     │ │
│ │ → archetype-aware Claude Sonnet extraction → 32-canonical-field JSON    │ │
│ │ → all `source_text_ko` preserved verbatim                               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ F. Diff & versioning                                                    │ │
│ │ Field-level diff vs prior version of same (institution, cycle, round,   │ │
│ │ category). Mark `change_events`. Flag 정정공고 high-priority.            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ G. HITL review (Phase 1: Supabase Studio + SQL views;                   │ │
│ │  Phase 2: Flutter admin route; Phase 3: full dashboard if needed)       │ │
│ │ Side-by-side PDF + extracted JSON, accept/edit/reject, audit log.       │ │
│ │ Translation review per language as a parallel queue (§P-5).             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                     ▼                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ G2. Translation worker (Phase 2+)                                       │ │
│ │ ko → en (Claude/DeepL) → uz/vi/mn/ru/id (Papago + Claude pivot).       │ │
│ │ Glossary-aware. Confidence-scored. Back-translation QC.                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   HANGUK APP — CONSUMING SURFACES                           │
│                                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐ │
│ │ Map tab         │  │ Applications    │  │ Training tab                 │ │
│ │ (§H.1)          │  │ tab (§H.2)      │  │ (university_specific) (§H.3) │ │
│ │ - existing -    │  │ - existing -    │  │ - existing, currently dead - │ │
│ └────────┬────────┘  └────────┬────────┘  └────────────┬─────────────────┘ │
│          ▼                    ▼                        ▼                   │
│  v_institutions_for_map   v_user_applications      v_recruitment_for_interview │
│  (read view)              (read view)               (read view)            │
│                                                                             │
│  Plus four new routes (§H.4): /institutions/:id, /institutions/compare,    │
│  /applications/tracker, /notifications/settings                            │
│                                                                             │
│  Push notifications: Supabase Edge `notify-tracked-changes` →              │
│   FCM (Android) / APNs (iOS) / web-push (Flutter Web)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Worker placement decision (audit §7.10, §7.15).** We run crawlers as Python in a small Hetzner VPS (€5/month, 2 vCPU / 4 GB) plus Supabase Edge Functions for the lightweight HTTP polls and pg_cron for scheduling. The reasons we don't pick "all Cloudflare Workers": (1) Naver Clova OCR's SDK is Python-first and runs cleanly in a long-lived process; (2) PyMuPDF, pdfplumber, Camelot and the LayoutLMv3 path need Python plus persistent disk for the 100MB+ model weights; (3) Playwright stealth profile against the rare bot-protected `.ac.kr` site is much friendlier on a VPS than on Cloudflare Browser Rendering. The Workers + Cron Triggers path is kept as Phase 4+ optionality if scale justifies migrating the high-frequency `pg_cron` polls there. The decision is reversible — `services/uni_db/` is structured so the polling workers can move to Workers without touching the parser or DB layer.

**Existing Hanguk components that consume the new DB.** (1) Applications tab — switches from free-text `applications.program` to a typed link to `recruitment_units`. (2) Map tab — reads denormalized `v_institutions_for_map` view. (3) Training tab's `university_specific` interview path — finally reachable, fetches the institution's recruitment-unit + requirements + scholarships and seeds the interview prompt. (4) Documents tab — gates uploads against `documents_required` per applicant_category. (5) future Notifications — new feature gated behind `user_alerts` (§H.5).

---

## C. Database schema

All DDL goes into one new migration: `supabase/migrations/20260601000000_uni_db_v1_core.sql`. The full file is split into logical sections matching the audit's §11 table list. This section gives the DDL skeleton and policy intent. Field types follow Korean-first principle (§P-2): every prose-field row carries `source_lang='ko'` and a raw `source_text_ko` column; translations live in a side `translations` table.

### C.1 `institutions`

Audit reference: §1.1, §11. Replaces the existing `universities` table.

```sql
create table public.institutions (
  id              uuid primary key default gen_random_uuid(),
  kcue_code       text unique,                     -- audit §11.5 stable identifier
  wikidata_id     text,                            -- e.g. 'Q31106'
  name_ko         text not null,                   -- 서울대학교
  name_ko_short   text,                            -- 서울대
  name_en         text,                            -- 'Seoul National University'
  romanization    text,                            -- 'Seoul-daehakgyo'
  institution_type text not null check (institution_type in (
    'national','public','private','national_special',
    'cyber','specialized','junior_college','education_university'
  )),                                              -- audit §1.1
  tier            int check (tier between 0 and 4), -- audit §1.2 (0..4)
  ieqas_status    text check (ieqas_status in ('outstanding','accredited','none')),
  region_code     text,                            -- '11' Seoul, '26' Busan ...
  city_ko         text,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  primary_domain  text not null,                   -- 'snu.ac.kr'
  primary_admissions_url_ko text,                  -- KOREAN side only — audit §P-1
  logo_url        text,
  is_partner      boolean default false,
  is_visible_on_map boolean default true,
  last_verified_at timestamptz,                    -- audit §11.2 freshness
  source_blob_hash text,                           -- last guideline blob hash
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on institutions (institution_type);
create index on institutions (tier);
create index on institutions (ieqas_status);
create index on institutions (region_code);
create index on institutions using gin (to_tsvector('simple', name_ko));
-- RLS: anon = select on (is_visible_on_map=true); authenticated = same;
-- service_role = full
alter table institutions enable row level security;
create policy ins_pub_read on institutions for select
  using (is_visible_on_map = true);
```

Sample row: `{ id: 'uuid', kcue_code: '0000169', name_ko: '서울대학교', name_ko_short: '서울대', name_en: 'Seoul National University', institution_type: 'national', tier: 0, ieqas_status: 'outstanding', region_code: '11', city_ko: '서울', primary_domain: 'snu.ac.kr', primary_admissions_url_ko: 'https://admission.snu.ac.kr/international/notice', is_partner: true, last_verified_at: '2026-05-07 09:00:00+09', source_blob_hash: 'sha256:…' }`.

### C.2 `recruitment_units`

Audit reference: §4.3, §5.3 row "recruitment_unit". The atomic admission unit per audit.

```sql
create table public.recruitment_units (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references institutions(id) on delete cascade,
  external_code     text,                          -- university-internal id
  faculty_ko        text,                          -- 단과대학
  division_ko       text,                          -- 학부
  department_ko     text,                          -- 학과
  major_track_ko    text,                          -- 전공
  faculty_group     text check (faculty_group in (
    'humanities','social','natural_science','engineering',
    'arts_pe','medicine','dentistry','veterinary','pharmacy',
    'theology','interdisciplinary'
  )),                                              -- audit §4.4 tuition grouping
  campus            text,                          -- 'main','Sejong','Mirae','ERICA','International'
  is_active         boolean default true,
  source_text_ko    text,                          -- raw verbatim row from guideline
  unique (institution_id, external_code)
);
create index on recruitment_units (institution_id);
create index on recruitment_units (faculty_group);
alter table recruitment_units enable row level security;
create policy ru_pub_read on recruitment_units for select using (is_active = true);
```

### C.3 `programs` / `majors`

The audit (§4.3) notes 학부 vs 학과 vs 전공 hierarchy isn't 1:1 with recruitment_units. We model `programs` separately from `recruitment_units` and link them many-to-many.

```sql
create table public.programs (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  name_ko         text not null,                 -- 컴퓨터공학과
  degree_level    text not null check (degree_level in (
    'bachelor','master','doctoral','integrated','associate','non_degree'
  )),
  duration_years  numeric(3,1),                  -- 4.0 / 2.0 / 6.0
  language_of_instruction text[] default '{ko}', -- {ko}, {en}, {ko,en}
  data_go_kr_dept_code text,                     -- audit §3.3 normalization
  source_text_ko  text
);
create index on programs (institution_id);
create index on programs (degree_level);

create table public.recruitment_unit_programs (
  recruitment_unit_id uuid not null references recruitment_units(id) on delete cascade,
  program_id          uuid not null references programs(id) on delete cascade,
  primary key (recruitment_unit_id, program_id)
);
alter table programs enable row level security;
create policy pg_pub_read on programs for select using (true);
```

### C.4 `admission_cycles`

```sql
create table public.admission_cycles (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references institutions(id) on delete cascade,
  intake_year         smallint not null,         -- 2026
  intake_term         text not null check (intake_term in ('spring','fall')),
  cycle_track         text not null check (cycle_track in (
    'susi','jeongsi','foreign','overseas_korean_full',
    'overseas_korean_partial','transfer','grad_general','grad_foreign'
  )),                                            -- audit §4.1
  round_number        smallint default 1,        -- 1차 / 2차 / 3차
  is_unified          boolean default false,
  applicant_category  text,                      -- 외국인전형, 재외국민특별전형, ...
  guideline_document_id uuid,                    -- FK fwd-declared, set on parse
  status              text not null default 'unverified' check (status in (
    'unverified','verified','superseded'
  )),
  superseded_by_id    uuid references admission_cycles(id),
  source_text_ko      text,
  unique (institution_id, intake_year, intake_term, cycle_track,
          round_number, applicant_category)
);
create index on admission_cycles (institution_id, intake_year, intake_term);
create index on admission_cycles (cycle_track);
create index on admission_cycles (status);
alter table admission_cycles enable row level security;
create policy ac_pub_read on admission_cycles for select using (status != 'superseded');
```

### C.5 `cycle_dates`

Replaces the existing `university_events` table (see §0.4.3). One row per calendar event in a cycle.

```sql
create table public.cycle_dates (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references admission_cycles(id) on delete cascade,
  recruitment_unit_id uuid references recruitment_units(id),  -- nullable: cycle-wide
  event_type      text not null check (event_type in (
    'apply_open','apply_close','document_submission_deadline',
    'first_stage_results','interview','practical_exam','final_results',
    'additional_admit','registration_open','registration_close',
    'registration_withdrawal_open','registration_withdrawal_close',
    'orientation','semester_start'
  )),
  starts_at       timestamptz not null,          -- always stored UTC, KST display
  ends_at         timestamptz,
  is_tentative    boolean default false,
  notes_ko        text,
  source_text_ko  text,
  source_blob_hash text,
  extractor_confidence numeric(3,2)
);
create index on cycle_dates (cycle_id, event_type);
create index on cycle_dates (starts_at);          -- next-deadline queries
alter table cycle_dates enable row level security;
create policy cd_pub_read on cycle_dates for select using (true);
```

Sample: `{ cycle_id, event_type:'apply_close', starts_at:'2026-09-30T08:00:00Z', notes_ko:'17:00 KST 마감', source_text_ko:'2026.09.30(화) 17:00까지 접수' }`.

### C.6 `requirements`

Per cycle and per applicant_category. Structured.

```sql
create table public.requirements (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references admission_cycles(id) on delete cascade,
  recruitment_unit_id uuid references recruitment_units(id),
  applicant_category text not null,
  topik_min_level smallint,
  topik_deferred boolean default false,           -- "to be acquired before grad"
  english_test  jsonb,                            -- {toefl_ibt:80, ielts:5.5, teps:297}
  gpa_floor_pct numeric(5,2),                     -- normalized to 0-100% percentile
  age_min       smallint,
  age_max       smallint,
  hs_grad_by    date,
  interview_required boolean default false,
  practical_exam_required boolean default false,
  prose_ko      text,                              -- raw narrative requirement
  source_text_ko text,
  extractor_confidence numeric(3,2)
);
create index on requirements (cycle_id);
alter table requirements enable row level security;
create policy req_pub_read on requirements for select using (true);
```

### C.7 `tuition`

Faculty-grouped, by year and semester (audit §4.4).

```sql
create table public.tuition (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  recruitment_unit_id uuid references recruitment_units(id), -- nullable: faculty-group only
  faculty_group   text not null,
  academic_year   smallint not null,
  semester_number smallint not null check (semester_number between 1 and 12),
  amount_krw      bigint not null,
  admission_fee_krw bigint,                                -- 입학금
  is_first_semester boolean default false,
  source_text_ko  text,
  unique (institution_id, recruitment_unit_id, academic_year, semester_number)
);
create index on tuition (institution_id, academic_year);
alter table tuition enable row level security;
create policy tu_pub_read on tuition for select using (true);
```

### C.8 `scholarships`

```sql
create table public.scholarships (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid references institutions(id) on delete cascade,
  scope           text not null check (scope in (
    'national','university','department','foundation','regional'
  )),
  name_ko         text not null,
  name_en         text,
  award_type      text not null check (award_type in (
    'tuition_waiver_pct','tuition_waiver_krw','stipend_monthly','airfare','other'
  )),
  award_value     numeric,                              -- 100, 50, 700000, etc.
  applicant_categories text[],                          -- {외국인전형, 재외국민}
  topik_tier_table jsonb,                               -- {3:40, 4:50, 5:70}
  eligibility_predicate jsonb,                          -- structured rules (audit §5.3)
  prose_ko        text,
  source_text_ko  text,
  extractor_confidence numeric(3,2)
);
create index on scholarships (institution_id);
create index on scholarships (scope);
alter table scholarships enable row level security;
create policy sch_pub_read on scholarships for select using (true);
```

### C.9 `documents_required`

```sql
create table public.documents_required (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references admission_cycles(id) on delete cascade,
  applicant_category text not null,
  document_type   text not null,                          -- 'transcript','diploma','passport',…
  is_required     boolean default true,
  is_apostille_required boolean default false,
  country_specific jsonb,                                  -- {CN:{notarization:true},UZ:{consular:true}}
  notes_ko        text,
  source_text_ko  text
);
create index on documents_required (cycle_id, applicant_category);
alter table documents_required enable row level security;
create policy dr_pub_read on documents_required for select using (true);
```

### C.10 `guideline_documents`

```sql
create table public.guideline_documents (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  source_url_ko   text not null,                          -- Korean URL only (§P-1)
  storage_path    text not null,                          -- guideline-blobs/sha256/…
  file_hash_sha256 text not null,
  file_size_bytes bigint,
  mime_type       text,
  http_etag       text,
  http_last_modified text,
  fetched_at      timestamptz not null default now(),
  parsed_version  int default 0,                          -- monotonically increasing
  parse_status    text default 'pending' check (parse_status in (
    'pending','running','succeeded','failed','superseded'
  )),
  archetype       text check (archetype in ('A','B','C','D','E','F','G','H')),
  language        text default 'ko',                       -- always ko per §P-1
  superseded_by_id uuid references guideline_documents(id),
  unique (file_hash_sha256)
);
create index on guideline_documents (institution_id, fetched_at desc);
create index on guideline_documents (parse_status);
alter table guideline_documents enable row level security;
create policy gd_pub_read on guideline_documents for select using (true);
```

### C.11 `announcements` & `announcement_sources`

```sql
create table public.announcement_sources (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid references institutions(id) on delete cascade,
  source_type     text not null check (source_type in (
    'university_admission_board','university_oia_board',
    'moe_okep','adiga','study_in_korea','niied','other_korean'
  )),
  url_ko          text not null,                          -- Korean only — §P-1
  cron_high_season_minutes int default 360,                -- 6 hours
  cron_off_season_minutes  int default 1440,               -- daily
  jitter_minutes  int default 15,
  consecutive_fails int default 0,
  last_polled_at  timestamptz,
  next_poll_at    timestamptz,
  status          text not null default 'discovered' check (status in (
    'discovered','pending_review','live','deprecated','blocked'
  )),
  notes           text,
  unique (url_ko)
);
create index on announcement_sources (status, next_poll_at);

create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references announcement_sources(id) on delete cascade,
  external_post_id text,
  title_ko        text not null,
  url_ko          text not null,
  attachments     jsonb,                                   -- [{filename, hash, size, mime}]
  posted_at       timestamptz,
  detected_at     timestamptz default now(),
  classifier_label text check (classifier_label in (
    'admission_announcement','correction_notice','schedule_change',
    'additional_recruitment','results_announcement','other','unknown'
  )),
  classifier_confidence numeric(3,2),
  guideline_document_id uuid references guideline_documents(id),
  unique (source_id, external_post_id)
);
create index on announcements (source_id, detected_at desc);
create index on announcements (classifier_label);
alter table announcement_sources enable row level security;
alter table announcements enable row level security;
create policy as_admin_only on announcement_sources for select using (false);
create policy ann_admin_only on announcements for select using (false);
-- service_role has full access by default; admin role added in §G Phase 2
```

### C.12 Crawl ops tables

```sql
create table public.crawl_runs (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references announcement_sources(id),
  started_at      timestamptz default now(),
  ended_at        timestamptz,
  status          text check (status in ('running','succeeded','failed','partial')),
  http_status_code int,
  error_text      text,
  records_seen    int default 0,
  records_new     int default 0,
  records_changed int default 0
);
create index on crawl_runs (source_id, started_at desc);

create table public.crawl_findings (
  id              uuid primary key default gen_random_uuid(),
  crawl_run_id    uuid references crawl_runs(id),
  announcement_id uuid references announcements(id),
  finding_type    text check (finding_type in (
    'new_post','title_change','attachment_change','correction_notice','removed'
  )),
  details         jsonb,
  detected_at     timestamptz default now()
);

create table public.change_events (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,                            -- 'cycle_dates', 'tuition', …
  entity_id       uuid not null,
  field_name      text,
  old_value       jsonb,
  new_value       jsonb,
  detected_at     timestamptz default now(),
  notify_users_at timestamptz,                              -- when notification fan-out should fire
  notify_status   text default 'pending'
);
create index on change_events (entity_type, entity_id, detected_at desc);
create index on change_events (notify_status, notify_users_at);
```

### C.13 Extraction & review tables

```sql
create table public.extraction_jobs (
  id              uuid primary key default gen_random_uuid(),
  guideline_document_id uuid not null references guideline_documents(id),
  archetype       text not null,
  field_group     text not null,                            -- 'calendar','tuition','requirements',…
  status          text not null default 'queued' check (status in (
    'queued','running','succeeded','failed','needs_review'
  )),
  llm_provider    text,                                     -- 'anthropic','openai','google'
  llm_model       text,                                     -- 'claude-sonnet-4-6'
  input_tokens    int,
  output_tokens   int,
  cost_usd        numeric(10,4),
  latency_ms      int,
  accuracy_self_score numeric(3,2),
  raw_output      jsonb,
  parsed_output   jsonb,
  error_text      text,
  started_at      timestamptz,
  ended_at        timestamptz
);
create index on extraction_jobs (guideline_document_id);
create index on extraction_jobs (status);

create table public.review_queue (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,                            -- 'cycle_dates','tuition',…
  entity_id       uuid not null,
  reason          text not null check (reason in (
    'low_confidence','correction_notice','high_difficulty_field',
    'translation_low_confidence','user_reported'
  )),
  priority        smallint default 5,                       -- 1=highest
  assigned_to     uuid references auth.users(id),
  status          text not null default 'open' check (status in (
    'open','in_review','approved','rejected','escalated'
  )),
  reviewer_decision jsonb,
  reviewer_notes  text,
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);
create index on review_queue (status, priority);
```

### C.14 User-facing tracker tables

```sql
create table public.user_tracked_universities (
  user_id         uuid not null references auth.users(id) on delete cascade,
  institution_id  uuid not null references institutions(id) on delete cascade,
  applicant_category text,                                  -- the user plans this track
  tracked_recruitment_units uuid[] default '{}',
  notify_on_calendar_change boolean default true,
  notify_on_correction boolean default true,
  notify_on_requirement_change boolean default true,
  notify_on_scholarship_change boolean default false,
  preferred_lang  text default 'en',                        -- §P-4
  created_at      timestamptz default now(),
  primary key (user_id, institution_id)
);
alter table user_tracked_universities enable row level security;
create policy utu_owner on user_tracked_universities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.user_alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  change_event_id uuid not null references change_events(id) on delete cascade,
  delivered_at    timestamptz,
  read_at         timestamptz,
  channel         text check (channel in ('push','in_app','email'))
);
create index on user_alerts (user_id, delivered_at desc);
alter table user_alerts enable row level security;
create policy ua_owner on user_alerts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### C.15 Translations table (§P-2)

The audit and §P specify the trade-off: prose-heavy fields go in a generic `translations` table; short labels can live as a JSONB column (option a) on the source row to avoid join-hot-path. Recommended call: **(b) generic table for prose, (a) JSONB column for short labels**. Justification: prose fields (scholarship eligibility narratives, requirements prose, correction notices) need per-language `confidence`, `reviewer`, `back_translation_distance` metadata which JSONB-column option doesn't carry cleanly; whereas short labels (institution name, recruitment unit name) are a small enum-like set of languages and the JSONB column read is faster. Both are referenced from §P.

```sql
-- Option (b) — generic table for prose
create table public.translations (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,
  entity_id       uuid not null,
  field_name      text not null,
  lang            text not null,                            -- 'en','uz','vi','mn','ru','id'
  text_value      text not null,
  source_lang     text not null default 'ko',
  provider        text,                                     -- 'claude','papago','deepl','human'
  confidence      numeric(3,2),
  back_trans_distance numeric(5,2),                          -- Levenshtein vs original ko
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  is_machine      boolean default true,
  created_at      timestamptz default now(),
  unique (entity_type, entity_id, field_name, lang)
);
create index on translations (entity_type, entity_id, field_name);

-- Option (a) — short label JSONB on the entity table
alter table institutions add column display_names jsonb default '{}'::jsonb;
-- e.g. {"en":"Seoul National University","uz":"Seul Milliy Universiteti"}
```

### C.16 Glossary & semantic search

```sql
create table public.term_glossary (
  id              uuid primary key default gen_random_uuid(),
  term_ko         text not null,
  term_lang       text not null,
  term_value      text not null,
  category        text check (category in ('institution_name','recruitment_unit_name',
    'official_term','document_type','scholarship_name')),
  authoritative   boolean default false,                    -- true = used as glossary in prompts
  unique (term_ko, term_lang, category)
);
-- pre-seeded with the 110 priority institutions' canonical en/uz/etc names

-- pgvector for semantic search (audit §7.8)
create extension if not exists vector;
create extension if not exists pgroonga;                    -- KO full-text

create table public.embedding_chunks (
  id              uuid primary key default gen_random_uuid(),
  guideline_document_id uuid references guideline_documents(id) on delete cascade,
  institution_id  uuid references institutions(id) on delete cascade,
  chunk_text_ko   text not null,
  embedding       vector(1024),                              -- BGE-M3
  chunk_meta      jsonb
);
create index on embedding_chunks using ivfflat (embedding vector_cosine_ops) with (lists=100);
create index on embedding_chunks using pgroonga (chunk_text_ko);
```

### C.17 Read views for the Flutter app

```sql
-- Audit §11; replaces direct `select * from universities` queries
create view public.v_institutions_for_map as
select
  i.id, i.name_ko, i.name_ko_short,
  coalesce(i.display_names->>'en', i.name_en) as name_en,
  coalesce(i.display_names->>'uz', i.name_en) as name_uz,
  i.city_ko, i.latitude, i.longitude, i.logo_url, i.tier,
  i.ieqas_status, i.is_partner, i.is_visible_on_map,
  i.last_verified_at,
  (select min(starts_at) from cycle_dates cd
    join admission_cycles ac on ac.id = cd.cycle_id
    where ac.institution_id = i.id
      and ac.status='verified'
      and cd.event_type in ('apply_open','apply_close')
      and cd.starts_at > now()
  ) as next_event_at
from institutions i
where i.is_visible_on_map = true;
```

The legacy `universities` table is preserved as a writable view in Phase 1 so existing `map_repository.dart` keeps working unchanged during dual-read.

---

## D. Repository structure

The new system lives **inside the same monorepo as the Flutter app**, in a new top-level `services/uni_db/` Python directory. Rationale: (a) one repo, one PR review, atomic deploys; (b) Flutter team and backend team share the same migration tree; (c) the existing `scripts/` folder establishes that the repo is fine with non-Dart code. We avoid a separate repo because round-tripping schema PRs across two repos was the #1 complaint of the audit's surveyed similar systems (UCAS-era ODBC complaint, audit §11.1.8).

```
hanguk_app/                                      # repo root (existing)
├── lib/                                         # Flutter app (existing)
├── pubspec.yaml                                 # existing
├── supabase/
│   ├── migrations/                              # SQL migrations (existing)
│   │   ├── 00000000000001_lovable_baseline.sql  # NEW Phase 0 — production dump
│   │   ├── 20260601000000_uni_db_v1_core.sql    # NEW Phase 0 — §C tables
│   │   ├── 20260601000100_uni_db_v1_views.sql   # NEW Phase 0 — §C.17 views
│   │   ├── 20260601000200_uni_db_v1_rls.sql     # NEW Phase 0 — RLS for new tables
│   │   ├── 20260601000300_uni_db_v1_seed_sources.sql  # NEW Phase 0 — top-15 sources
│   │   ├── 20260615000000_uni_db_v1_translations.sql  # NEW Phase 2 — §P
│   │   └── ...
│   ├── functions/
│   │   ├── crawl-source/                        # NEW — Edge function entry
│   │   ├── extract-guideline/                   # NEW — kicks Python parse worker
│   │   ├── translate-canonical/                 # NEW — translation worker entry
│   │   ├── notify-tracked-changes/              # NEW — fan-out to FCM/APNs
│   │   ├── interview-ai/                        # existing
│   │   ├── interview-feedback/                  # existing
│   │   ├── elevenlabs-tts/                      # existing
│   │   └── student-login-v2/                    # existing
│   └── _baseline_rls.sql                        # NEW Phase 0 — forensic RLS dump
├── services/
│   └── uni_db/                                  # NEW Python project
│       ├── pyproject.toml                        # uv-based; py 3.12
│       ├── README.md
│       ├── Dockerfile                            # for the VPS deploy
│       ├── docker-compose.yml                    # local dev
│       ├── src/uni_db/
│       │   ├── __init__.py
│       │   ├── config.py                         # env, secrets
│       │   ├── db.py                             # Postgres async client
│       │   ├── storage.py                        # Supabase Storage client
│       │   ├── discovery/
│       │   │   ├── upstream_okep.py              # MOE okep poller
│       │   │   ├── upstream_adiga.py             # Adiga poller
│       │   │   ├── upstream_study_in_korea.py    # NIIED poller
│       │   │   ├── search_naver.py               # Naver site-search
│       │   │   ├── search_google.py              # Google PSE
│       │   │   ├── classifier.py                 # rules + embedding + LLM
│       │   │   └── per_university/
│       │   │       ├── _adapter_base.py
│       │   │       ├── snu.py
│       │   │       ├── yonsei_sinchon.py
│       │   │       ├── yonsei_mirae.py
│       │   │       ├── korea_anam.py
│       │   │       ├── korea_sejong.py
│       │   │       ├── kaist.py
│       │   │       ├── ... (110 priority)
│       │   ├── fetch/
│       │   │   ├── http_fetcher.py               # httpx + retry
│       │   │   ├── playwright_fetcher.py         # JS-heavy
│       │   │   └── hash_versioning.py
│       │   ├── parse/
│       │   │   ├── pdf_pymupdf.py
│       │   │   ├── pdf_plumber_tables.py
│       │   │   ├── pdf_camelot_tables.py
│       │   │   ├── ocr_naver_clova.py
│       │   │   ├── ocr_easyocr_ko.py
│       │   │   ├── hwp_kordoc.py
│       │   │   └── archetype/
│       │   │       ├── archetype_a_snu.py
│       │   │       ├── archetype_b_top_seoul.py
│       │   │       ├── archetype_c_regional_national.py
│       │   │       ├── archetype_d_faith_mid_priv.py
│       │   │       ├── archetype_e_womens.py
│       │   │       ├── archetype_f_arts_pe.py
│       │   │       ├── archetype_g_stem_specialized.py
│       │   │       └── archetype_h_juniorcoll.py
│       │   ├── extract/
│       │   │   ├── llm_anthropic.py              # Claude Sonnet primary
│       │   │   ├── llm_haiku_classifier.py
│       │   │   ├── prompts/                      # one .md per field group
│       │   │   │   ├── calendar.md
│       │   │   │   ├── tuition.md
│       │   │   │   ├── requirements.md
│       │   │   │   ├── scholarships.md
│       │   │   │   ├── documents_required.md
│       │   │   │   └── _common_glossary.md
│       │   │   └── schemas/                      # JSON schemas matching §C tables
│       │   ├── diff/
│       │   │   ├── field_differ.py
│       │   │   └── correction_detector.py
│       │   ├── translate/
│       │   │   ├── claude.py
│       │   │   ├── deepl.py
│       │   │   ├── papago.py
│       │   │   ├── glossary.py
│       │   │   ├── back_translation_qc.py
│       │   │   └── pipeline.py                   # ko→en→pivot→others
│       │   ├── notify/
│       │   │   ├── fan_out.py
│       │   │   ├── fcm.py
│       │   │   └── apns.py
│       │   ├── workers/
│       │   │   ├── discovery_worker.py           # entry: pulls due sources
│       │   │   ├── fetch_worker.py
│       │   │   ├── parse_worker.py
│       │   │   ├── translate_worker.py
│       │   │   └── notify_worker.py
│       │   └── cli.py                            # admin CLI: `uni-db crawl snu`
│       └── tests/
│           ├── unit/
│           ├── integration/
│           └── fixtures/                         # archetype anchor PDFs
├── scripts/                                     # existing diagnostic Dart scripts
├── docs/
│   ├── samples/                                 # existing — archetype anchors
│   └── uni_db/                                  # NEW — operational runbooks
└── .github/workflows/                           # NEW
    ├── ci.yml                                   # dart format, analyze, test
    ├── uni_db_ci.yml                            # ruff, mypy, pytest
    └── deploy_uni_db.yml                        # ssh deploy to VPS
```

**Language pick.** Python 3.12 for `services/uni_db/` (OCR/LLM ecosystem favours Python; PyMuPDF, pdfplumber, Camelot, Naver Clova OCR SDK, easyocr, anthropic SDK all Python-native). Dart 3 for the Flutter app (existing). SQL/plpgsql for migrations. TypeScript only inside `supabase/functions/*` (Deno runtime — Supabase Edge requirement).

---

## E. Crawler / discovery service

### E.1 Source registry semantics (audit §6.11, §C.11)

Every row in `announcement_sources` is **a Korean URL**. The registry policy explicitly excludes `/eng/`, `/en/`, `/english/` paths (§P-1). Lifecycle: `discovered → pending_review → live → deprecated → blocked`. A row moves from `discovered` to `pending_review` automatically the first time the discovery layer surfaces it; an admin promotes to `live` via the §G review console. Once `live`, the cron poller picks it up.

### E.2 Per-source adapter pattern

```python
# services/uni_db/src/uni_db/discovery/per_university/_adapter_base.py
class SourceAdapter(Protocol):
    institution_id: UUID
    source_url_ko: str

    async def list_recent_posts(self, since: datetime) -> list[Announcement]: ...
    async def fetch_post_detail(self, external_post_id: str) -> PostDetail: ...
    async def fetch_attachment(self, attachment_url: str) -> AttachmentBlob: ...
```

110 priority adapters generated from a single template + per-university overrides for selectors. The base implementation handles: robots.txt, jitter, exponential back-off on 5xx, content-hash de-dup. About 10–20 will need custom JS handling via Playwright (audit §6.2 "JSON-backed AJAX (egov framework)").

### E.3 Day-1 seed — top-15 priority Korean URLs

The seed migration `20260601000300_uni_db_v1_seed_sources.sql` inserts these 15 (Korean URL only, English mirrors excluded):

- T0 (5): SNU `admission.snu.ac.kr`, Yonsei `admission.yonsei.ac.kr` (Sinchon) + `admission.yonsei.ac.kr/mirae` (Mirae), Korea `oku.korea.ac.kr` (KO admissions board), KAIST `admission.kaist.ac.kr`, POSTECH `admission.postech.ac.kr`.
- T1 (8): SKKU `admission.skku.edu`, Hanyang `go.hanyang.ac.kr`, Sogang `admission.sogang.ac.kr`, CAU `admission.cau.ac.kr`, KHU `iphak.khu.ac.kr`, HUFS `adms.hufs.ac.kr`, Ewha `admission.ewha.ac.kr`, UOS `admission.uos.ac.kr`.
- Plus 2 national flagships: PNU `go.pusan.ac.kr`, KNU `admission.knu.ac.kr`.

Phase 2 expands to the full 110 from audit §2 (excluding all `/eng/` paths).

### E.4 Discovery loop (audit §6.7)

`pg_cron` triggers every 10 minutes. The Python `discovery_worker.py` polls `announcement_sources` for rows where `next_poll_at <= now()` and `status='live'`, runs the adapter, writes to `crawl_runs` + `crawl_findings`, advances `next_poll_at` per the high/off-season cadence (`cron_high_season_minutes` / `cron_off_season_minutes`). Season is computed in SQL from a `is_high_season(now())` function: months {3,4,5,9,10,11,12,1,2} = high; {6,7,8} = off (audit §6.7).

**Auto-discovery for unknown universities.** Hourly Naver site-search: `site:.ac.kr (모집요강 OR 정정공고 OR 외국인전형 OR 추가모집)` filtered to last 24 hours. Each unknown root domain yields a `discovery_lead` event into `announcement_sources` as `status='discovered'`; admin promotes to `live`.

**Korean-first principle (§P-1).** Search providers in priority order: Naver Search API → Daum Search API → Google PSE with `lang=ko` only. Google English-only results are explicitly filtered out. Bilingual sites are inspected only on their `/ko/` or root path; `/eng/` never enters the registry.

### E.5 Change detection (audit §6.5)

- Title diff on existing announcements: classifier label flips to `correction_notice` if the title acquires `정정공고` / `변경공고` / `일정변경`. Priority 1 in `review_queue`.
- Attachment hash diff: any attachment SHA-256 change triggers a re-fetch + re-parse, marked `revised`.
- "준비중" (preparing) detection: if attachments missing or filename matches `(준비중|추후공지)`, schedule a 6-hour re-poll until stable for two consecutive polls.

### E.6 Stack pick rationale

**Python on a Hetzner VPS + Supabase pg_cron + Edge Function dispatch**, not pure Cloudflare Workers. Rationale (from audit §7.10, §7.15): (1) Supabase already powers Hanguk; pg_cron is the cheapest scheduler; (2) Naver Clova OCR + PyMuPDF + Playwright stealth + LayoutLMv3 PoC together require Python with persistent disk and >256 MB RAM, which exceeds Workers' free tier and makes paid tiers comparable to a €5/mo VPS; (3) `services/uni_db/cli.py` admin commands need an SSH-able shell for incident response; (4) the path remains reversible — discovery/fetch is split from parse, so high-frequency discovery can move to Workers + Cron Triggers later if scale demands.

---

## F. Extraction pipeline

### F.1 Per-archetype dispatcher

`parse_worker.py` reads `guideline_documents` rows where `parse_status='pending'`, classifies the doc into one of the 8 archetypes (audit §5.2) using Claude Haiku on the first 3 pages of extracted text, and dispatches to the matching `archetype_*.py` module.

### F.2 Text extraction tier (audit §7.6)

1. **PyMuPDF** to detect text layer; if present, extract.
2. **pdfplumber** for clean tables; **Camelot lattice** for ruled tables; **Camelot stream** for unruled.
3. If image-only (no text layer): **Naver Clova OCR** (audit §7.6 — best Korean accuracy). Fallback: easyocr-ko OSS.
4. **HWP/HWPX** via `kordoc` MCP path or `pyhwp`.
5. Layout refinement (Phase 3+): DocLing or LayoutLMv3 ko-fine-tuned for ambiguous spans.

### F.3 LLM extraction (audit §7.7, §P-1, §P-2)

One Claude Sonnet 4.6 call per **field group** (calendar, tuition, requirements, scholarships, documents_required) with strict JSON schema mode. The prompt is in Korean (the source is Korean per §P-1), the schema is the JSON shape of the §C table, and the response is parsed back into the table. **Every prose-bearing field carries `source_text_ko` verbatim**, which is the legal/audit anchor (§P-2).

Estimated cost per guideline: 50-page average × ~700 tokens/page input × 5 field groups = ~175k input tokens × $3/1M = **$0.53 input**, plus ~10k output tokens/group × 5 × $15/1M = **$0.75 output**. Total **~$1.30 per guideline**. At 110 priority × 2 cycles/year × 2 rounds × revisions ≈ 800 parses/year ≈ **$1,000/year LLM extraction**, well under the audit's $50–150/month envelope.

Haiku is used for:
- archetype classification (1 call/doc, ~$0.001),
- announcement-relevance tiebreaker (~10k/month × $0.0005),
- translation glossary lookup checks.

### F.4 Validation & HITL routing

By the audit's parsing-difficulty score (§5.3):

- Difficulty 1–2 (16 fields including dates, fees, names): auto-publish if extractor confidence ≥ 0.85. Spot-check sampling: 5% to HITL.
- Difficulty 3 (10 fields including TOPIK level, interview required, doc list): auto-publish if confidence ≥ 0.90 AND no field disagreement against prior version.
- Difficulty 4–5 (6 fields including scholarship eligibility, recruitment unit normalization, correction notices): **always HITL** before publish.

### F.5 Versioning

Every parse writes to `guideline_documents` with `parsed_version = parsed_version + 1`. Never overwrites. The diff engine (§F.6) compares parsed_output against the prior `parsed_output` for the same `(institution_id, intake_year, intake_term, cycle_track, round, applicant_category)` and emits `change_events`.

### F.6 Diff engine

Field-level diff. Surface to the user (via `notify-tracked-changes`) only changes on fields the user has opted into (`user_tracked_universities.notify_on_*` flags). 정정공고 always force-notify regardless of opt-in (per audit §6.5).

---

## G. HITL review console

### G.1 Phase 1 — Supabase Studio + SQL views

Zero custom UI. Reviewers (initially: the founder + one ops contractor) work in Supabase Studio against:

```sql
create view public.v_review_queue_dashboard as
select rq.id, rq.priority, rq.reason, rq.entity_type, rq.entity_id,
       i.name_ko, i.name_en,
       gd.source_url_ko, gd.storage_path,
       ej.parsed_output, ej.accuracy_self_score
from review_queue rq
left join admission_cycles ac on ac.id = rq.entity_id and rq.entity_type='admission_cycles'
left join institutions i on i.id = ac.institution_id
left join guideline_documents gd on gd.id = ac.guideline_document_id
left join extraction_jobs ej on ej.guideline_document_id = gd.id
where rq.status='open'
order by rq.priority asc, rq.created_at asc;
```

Reviewer workflow: pick top row → open `storage_path` PDF in browser → compare to `parsed_output` JSON → UPDATE the source row directly OR mark `review_queue.status='approved'` to publish as-is.

### G.2 Phase 2 — Flutter admin route (`/admin/review`)

Same Hanguk app, gated by a new `profiles.role='admin'` flag. Side-by-side: PDF iframe (left) + structured field editor (right). Accept / edit / reject buttons write to `review_queue.reviewer_decision`. Audit log via `change_events` (reviewer edits create `change_events` rows with `reason='hitl_correction'`).

### G.3 Phase 3 — full admin dashboard (only if volume justifies)

Argilla self-host on the same VPS, integrated via REST. Volume threshold for triggering Phase 3: >200 review_queue items per week sustained for 4 weeks.

### G.4 Translation review queue (§P-5)

`review_queue.reason='translation_low_confidence'` rows surface in a separate tab. One queue per language. Reviewers per language are recruited per the Phase 2/3 rollout in §P-3.

### G.5 Audit log

Every reviewer action writes `change_events.reason='hitl_correction'` with `old_value`, `new_value`, `reviewer_id`. Immutable.

---

## H. Hanguk app integration

### H.1 New read views the Flutter app uses

All Flutter reads go through views, not raw tables. This isolates the app from schema churn.

```sql
create view public.v_user_applications as ...    -- joins applications + admission_cycles + cycle_dates + recruitment_units + institutions
create view public.v_user_upcoming_deadlines as ...
create view public.v_recruitment_for_interview as ...   -- powers university_specific interview path
create view public.v_user_tracked_summary as ...
```

All views accept the user's session and apply RLS.

### H.2 Riverpod providers — additions and refactors

Existing (Refactor):
- `universitiesProvider` (in `map_repository.dart`) → reads `v_institutions_for_map`. Public signature unchanged so the map UI is unmodified.
- `applicationsProvider` (in `applications_repository.dart`) → reads `v_user_applications`.
- `suggestedUniversitiesProvider` → reads `student_suggestions` UNION `user_tracked_universities` (Phase 1 dual-source).
- Interview repository's `targetUniversityId` flow → resolves to a richer `RecruitmentTarget` object via `v_recruitment_for_interview`.

New:
- `institutionDetailProvider(id)` — for `/institutions/:id` route.
- `compareInstitutionsProvider(idsList)` — for `/institutions/compare` route.
- `userTrackedProvider` — for `/applications/tracker`.
- `userAlertsProvider` — for the home-screen "next deadline" banner.
- `notificationSettingsProvider` — for `/notifications/settings`.

### H.3 New routes (audit §11; lib/core/router/app_router.dart)

```
/institutions/:id            → InstitutionDetailScreen
/institutions/compare        → InstitutionCompareScreen (idsList from query param)
/applications/tracker        → ApplicationTrackerScreen
/notifications/settings      → NotificationSettingsScreen
/admin/review                → AdminReviewScreen (Phase 2, role-gated)
```

### H.4 Interview Practice — fixing the dead `university_specific` path

Today: dropdown exists, `targetUniversityId` flows through, but the interview LLM has no recruitment-aware data so the experience falls back to generic interview prompts.

Fix: the `interview-ai` Edge Function reads `v_recruitment_for_interview` for `(target_university_id, target_recruitment_unit_id, target_applicant_category)` and seeds the system prompt with: requirements summary, top 3 scholarships eligible, key deadlines, recent 정정공고 if any. The interviewer's questions ("왜 우리 학과를 선택했나요?", "TOPIK 4급은 언제 따실 계획이세요?") are anchored in the actual cycle/category.

### H.5 Applications tab evolution

From: free-text "I'm applying to X" → a structured tracker linked to canonical institutions, with auto-populated deadlines per cycle/round.

Schema migration plan (§I-Phase-1): add nullable columns, dual-write from UI, backfill, then drop free-text `program` in Phase 3.

UI changes:
- `university_selection_view`: cycle picker + applicant_category picker → filtered list of recruitment_units.
- `process_tracker`: timeline of `cycle_dates` for the selected applicant_category.
- `application_card`: shows next deadline, last_correction_at, and a freshness badge driven by `institutions.last_verified_at`.

### H.6 Push notifications (audit §11.1, §H of this plan)

Supabase Edge function `notify-tracked-changes` runs every 5 minutes:

```
for each row in change_events where notify_status='pending':
  for each user in user_tracked_universities matching (institution_id, applicant_category, opted-in flag):
    insert into user_alerts(user_id, change_event_id, channel)
    if channel='push': call FCM (Android) / APNs (iOS) / web-push (Flutter Web)
  set change_events.notify_status='delivered'
```

FCM for Android, APNs for iOS, web-push (with VAPID keys) for Flutter Web. Provider: Firebase Cloud Messaging across both Android and iOS via the unified send API; web-push handled by Supabase's recommended `webpush` Deno module.

### H.7 Hooking into existing l10n (§P-4)

The repo today has **no Flutter `intl` setup** (no `lib/l10n/`, no `*.arb`, no `flutter_localizations` in pubspec). What exists is database-side bilingualism (`name_en`/`name_uz`).

Plan: Phase 2 adds `flutter_localizations` + `intl_utils` and creates `lib/l10n/intl_en.arb`, `intl_uz.arb`. The app reads the user's `profiles.preferred_lang` and selects the matching translation from `translations` table or `display_names` JSONB. Korean is always reachable via a "View original (한국어)" toggle on every translated card (§P-4).

---

## I. Phased delivery

Each phase has scope, success criteria, risks, exit gate, and **migration plan** (what existing artifact moves how).

### Phase 0 — Week 0 (5 dev-days)

**Scope.** Foundation. No user-visible change.

1. `supabase db dump --schema-only` → check in `00000000000001_lovable_baseline.sql`. Archive `.claude/worktrees/.../migrations/` to `supabase/migrations/.lovable_archive/`.
2. Create `services/uni_db/` skeleton (pyproject.toml, src/uni_db/, tests/). Wire CI in `.github/workflows/uni_db_ci.yml`.
3. Apply migrations: `20260601000000_uni_db_v1_core.sql` (§C tables), `_views.sql`, `_rls.sql`, `_seed_sources.sql` (top-15 sources).
4. Provision Hetzner VPS, deploy `discovery_worker.py` and `fetch_worker.py`. Wire to Supabase via service-role key + signed URLs to `guideline-blobs` bucket.
5. Enable `pg_cron`, schedule `discovery_worker` every 10 min.
6. **No parsing yet.** Raw HTML/PDF blob ingestion working end-to-end on the top-15 sources.

**Migration plan.** Existing `universities` table: untouched; new tables coexist. Create the legacy compatibility view `universities` (renames to a view backed by `institutions`) only at the end of Phase 1, not now.

**Success criteria.** `select count(*) from guideline_documents where fetched_at > now()-interval '24 hours'` ≥ 5 across the seeded sources, every day.

**Risks.** ac.kr fetch instability (audit §10); Naver block; pg_cron quota.

**Exit gate.** End-to-end raw fetch loop verified for 5 universities for 7 consecutive days without manual intervention.

### Phase 1 — Weeks 1–3 (15 dev-days)

**Scope.** Parse pipeline for difficulty 1–2 fields. Korean-only display. HITL via Studio.

1. Implement archetype-A and archetype-B parsers (covers SNU, Yonsei, KU, SKKU, Hanyang, Sogang, CAU, KHU — 8 of top-15).
2. Implement Claude Sonnet extraction for the calendar field group (`cycle_dates`) and tuition field group (`tuition`), with §C JSON schemas.
3. Implement diff engine for `cycle_dates` and `tuition`. Implement `correction_detector.py` (정정공고).
4. HITL v1: §G.1 Studio + SQL views.
5. App integration: `v_institutions_for_map` view live; `map_repository.dart`'s `universitiesProvider` switched to read it; Flutter map screen unchanged. Add a "verified deadlines" overlay banner on the home screen (§N quick win).
6. Begin migrating `university_events` → `cycle_dates`: dual-write for one cycle of testing, then deprecate `university_events` reads.

**Migration plan.** `universities` table → introduce `institutions` table populated via a one-time copy migration (`insert into institutions select … from universities`). Add `universities` as a writable VIEW over `institutions` so existing inserts/updates from `applications_repository.dart` keep working. `university_events` → dual-read: views check both `cycle_dates` (preferred) and `university_events` (legacy) for one full crawl cycle, then drop `university_events` reads.

**Success criteria.** All 8 covered universities have ≥ 1 verified `admission_cycles` row with at least 4 `cycle_dates`. App home banner shows next deadline. HITL queue is being worked through by the founder daily.

**Risks.** Sonnet extraction accuracy below 0.85 on calendar fields → forces HITL on >50% of rows → reviewer becomes bottleneck. Mitigation: pre-Phase-1 PoC on 3 PDFs to validate prompts.

**Exit gate.** ≥ 80% of newly fetched guidelines auto-publish without HITL on calendar + tuition. Map shows next-deadline timestamp on each of the 8 universities.

### Phase 2 — Weeks 4–6 (15 dev-days)

**Scope.** Expand to 30 priority universities. All 8 archetypes' parsers. Difficulty-3 fields (scholarships, document_checklists). Discovery service. **English translation pipeline online.**

1. Implement archetypes C–H (regional national, faith/mid-priv, women's, arts/PE, STEM-specialized, junior college).
2. Add Naver Clova OCR (image-only PDFs). HWP via `kordoc`.
3. Extraction prompts for `requirements`, `scholarships`, `documents_required`.
4. Discovery service: Naver site-search + okep + Adiga + Study in Korea pollers. Auto-proposes new sources to `pending_review`.
5. **Translation pipeline (§P-3): Korean → English.** Glossary seeded with the 110 priority institution names. Back-translation QC active. HITL queue for low-confidence translations.
6. App: Add `flutter_localizations` + `lib/l10n/intl_en.arb`. Implement `/institutions/:id` route reading both `institutions` row and translated prose from `translations` table (with "View original (한국어)" toggle, §P-4).
7. Applications tab refactor: cycle-aware `application_card`, `process_tracker` driven by `cycle_dates`. New `recruitment_unit_id` / `admission_cycle_id` / `applicant_category` columns nullable; UI dual-writes.

**Migration plan.** `applications` table: add nullable columns. UI dual-writes (free-text `program` AND structured `recruitment_unit_id`) for two months, then a backfill job maps free-text to recruitment_units, then `program` text becomes derived column.

**Success criteria.** 30 universities × 2 cycles fully ingested. English translations available for all `name_en`-equivalent fields. Discovery proposes ≥ 5 new sources/week. Applications tab shows real deadlines.

**Risks.** Translation cost overrun if Sonnet used for everything. Mitigation: route short labels to DeepL ($25/M chars), prose to Sonnet, glossary-locked institutional names never re-translated.

**Exit gate.** App passes a usability test with 5 Uzbek-speaking users who tracked an institution and received a deadline notification within 48 hours.

### Phase 3 — Weeks 7–9 (15 dev-days)

**Scope.** All 110 priority universities. Difficulty-4–5 fields with mandatory HITL. Push notifications. University compare screen. **Uzbek translation pipeline.**

1. All 110 universities live; archetype-classifier accuracy ≥ 95%.
2. Difficulty-5 fields: scholarship eligibility predicates (jsonb), correction-notice routing, recruitment-unit normalization against data.go.kr department codes (audit §3.3).
3. `notify-tracked-changes` Edge Function live; FCM/APNs/web-push wired.
4. `/institutions/compare` route — 2-up institution comparison for tracked universities.
5. **Translation pipeline: Korean → Uzbek**, via Korean→English→Uzbek pivot using Naver Papago for the en→uz hop where available, Claude pivot otherwise. Confidence flag prominently shown.
6. HITL Phase 2: `/admin/review` Flutter route.
7. Interview Practice: `university_specific` path fully wired against `v_recruitment_for_interview`.

**Migration plan.** `documents` table: add `document_type, applicant_category, country_of_issuance` columns, default null. Backfill from filename heuristics where possible. `student_suggestions` and `user_tracked_universities` continue coexisting.

**Success criteria.** Push notification delivered within 1 hour of a 정정공고 detection in 95% of cases. Uzbek translations available for ≥ 60% of prose fields with confidence ≥ 0.7. Interview Practice university_specific session uses recruitment-unit-aware prompts.

**Risks.** Korean → Uzbek translation quality below acceptable; Papago doesn't support uz directly; pivot through English loses nuance. Mitigation: explicit confidence badge; recruit one Uzbek native-speaker reviewer for HITL Phase 2.

**Exit gate.** End-to-end flow demoed: a 정정공고 posts at SNU's Korean board → detected within 6 hours → parsed → diffed → tracked Uzbek user receives a localized push within 1 hour → user opens the app → sees the change with "View original (한국어)" toggle.

### Phase 4 — Weeks 10–12 (15 dev-days)

**Scope.** Long tail (the rest of the ~422 institutions, including 전문대). Public-facing API for partners. Analytics. **Vietnamese + Mongolian translations.**

1. IEQAS-158 fully covered. 전문대 ingestion via archetype H.
2. Public read-only REST: `/api/v1/institutions/:id`, `/api/v1/cycles?institution=…&track=…`. Rate-limited (60 req/min anon, 600 authenticated). Schema.org JSON-LD on every public page (audit §11.7).
3. Analytics dashboard: `v_analytics_user_tracked` materialized view; daily refresh; shows top-10 most-tracked institutions, top deadlines coming up, push delivery rate.
4. Translation: Vietnamese, Mongolian. Papago handles ko→vi cleanly; Mongolian via Claude pivot. Per-language reviewer recruited (ideally a Mongolian and a Vietnamese counselor in the partner network).

**Migration plan.** None destructive; mostly additive.

**Success criteria.** 158 IEQAS institutions live. Public API documented at `docs/uni_db/api.md`. Translation parity: 80% of prose fields have en + uz; 50% have vi + mn.

**Risks.** Long-tail crawl maintenance (audit §8: ~10–20 selector breaks/year).

**Exit gate.** First paying partner counselor onboarded against the public API.

### Phase 5+ (post-week-12, ongoing)

Russian, Indonesian translations. Counselor mode. Payment-gated premium tier (full document checklist with country-specific apostille routing for UZ/VN/CN/RU/CA/etc., audit §4.7). AI explanation layer ("here's what this 정정공고 means for your application", audit §11.7). KCUE partnership track for direct data feed.

---

## J. Cost projection (12 months)

All in USD. KRW exchange ≈ 1,350/USD.

| Component | Phase 0 (mo 1) | Phase 1 (mo 2-3) | Phase 2 (mo 4-6) | Phase 3 (mo 7-9) | Phase 4 (mo 10-12) | High-season burst (Sep–Dec) |
|---|---|---|---|---|---|---|
| Supabase Pro ($25/mo, audit §7.15) → Team ($599/mo from Phase 4 if RLS scale demands) | $25 | $25 | $25 | $25 | $25–$599 | same |
| Cloudflare R2 storage (~5GB/yr at v1; $0.015/GB-mo) | $0.10 | $0.20 | $0.40 | $0.60 | $0.80 | $1.50 |
| Hetzner VPS (CX22, €5.83/mo) | $7 | $7 | $7 | $7 | $7 | $7 |
| Naver Clova OCR ($0.005–0.01/page; ~10% of guidelines image-only; ~50 pages avg) | $0 | $5 | $20 | $40 | $80 | $200 |
| Anthropic Claude — extraction (Sonnet primary) | $0 | $30 | $80 | $120 | $150 | $400 |
| Anthropic Claude — classification & translation (Haiku) | $0 | $5 | $15 | $25 | $40 | $80 |
| DeepL Pro Translator API ($25/M chars), §P-3 short-label volume | $0 | $0 | $10 | $25 | $40 | $80 |
| Naver Papago ($20/M chars; ko→vi/id/en cheap, no uz) | $0 | $0 | $0 | $20 | $50 | $80 |
| FCM (free) + APNs ($99/yr Apple Developer split monthly) | $8.25 | $8.25 | $8.25 | $8.25 | $8.25 | $8.25 |
| Web-push (free) | 0 | 0 | 0 | 0 | 0 | 0 |
| Sentry ($26/mo team) | $26 | $26 | $26 | $26 | $26 | $26 |
| Naver Search API (free dev tier sufficient at v1) | $0 | $0 | $0 | $0 | $5 | $10 |
| Google PSE ($5/1k beyond free 100/day) | $0 | $0 | $0 | $5 | $10 | $20 |
| Misc proxies / monitoring | $10 | $10 | $20 | $30 | $30 | $50 |
| **Monthly total** | **$76** | **$117** | **$212** | **$332** | **$472** | **$960** |

Annual run-rate steady-state (averaging Phases 1–4): **~$3,200/year** ≈ **$270/month average**, matching audit §7.15's $130–300 envelope. High-season burst is real (audit §6.7) but bounded.

**Unit economics if monetized.** Free tier: track up to 3 institutions. Premium ($4.99/mo): unlimited tracking + per-country document checklist + AI explanation layer. Break-even at **~95 paying users**. Hanguk's Uzbek user base + the Vietnamese expansion easily clears this.

§P-related cost notes: Korean→Uzbek has no first-party provider; the Korean→English→Uzbek pivot doubles tokens for Uzbek-translated prose. Budgeted at +30% of Phase-3 LLM line item. Glossary-locked terms (institutional names) bypass translation cost entirely (looked up from `term_glossary`).

---

## K. Team and roles

**Week 1 (Phase 0).** 1.0 FTE backend Python (the new `services/uni_db/` is greenfield, needs deep ownership). 0.5 FTE Flutter (existing repo, mostly schema-aware view changes and the home banner). 0.5 FTE ML/extraction (prompt engineering, LLM cost optimization; can overlap with backend). 0.25 FTE ops/SRE (VPS provisioning, observability). 0.25 FTE founder/PM/HITL reviewer (the bottleneck role).

**Phase 2–3 scaling.** Add 0.5 FTE per language for HITL translation review (initially: 1 native Uzbek speaker; in Phase 4, +1 Vietnamese, +1 Mongolian). Backend Python stays at 1.0; Flutter rises to 1.0; ops stays at 0.25.

**Phase 4+.** Add 0.5 FTE for counselor partnership / customer success once first paying partners onboard.

**Skills required week 1:** Python 3.12, async (httpx, asyncio), pdfplumber/PyMuPDF familiarity, Anthropic API; Postgres + Supabase RLS fluency; Flutter + Riverpod + freezed; ability to read Korean PDFs at intermediate level (the `services/uni_db/` engineer should have N3 or above to debug parser errors).

---

## L. Risk register

| # | Risk | Severity (1-5) | Likelihood (1-5) | Mitigation |
|---|---|---|---|---|
| 1 | PIPA compliance (audit §10.4) — pseudonymized data exemption misapplied | 5 | 2 | DPO sign-off; data-flow diagram audited; only public institutional data ingested; user data stays in Supabase with RLS. |
| 2 | ac.kr fetch instability — selector breakage, sites going down | 3 | 5 | Per-source failure budget, automatic alerts when a source fails 3 consecutive polls; fall back to MOE okep / Adiga as redundant signal (audit §6.4). |
| 3 | Archetype mis-prediction → wrong parser → garbled extraction | 4 | 3 | Haiku archetype classifier confidence threshold; manual override per source; `services/uni_db/cli.py` admin command to force-classify. |
| 4 | OCR quality on scanned tables (audit §5.3 difficulty-5) | 4 | 3 | Naver Clova primary; LayoutLMv3 ko-fine-tune as Phase 3 PoC; HITL mandatory for OCR'd tuition rows. |
| 5 | Scholarship eligibility encoding loses nuance | 4 | 4 | Always store `prose_ko` + `source_text_ko` verbatim; structured predicate is best-effort; HITL gates publish. |
| 6 | Difficulty-4–5 fields require permanent HITL → reviewer becomes bottleneck | 4 | 4 | Recruit second reviewer by end of Phase 2; auto-priority queue; max-aging visibility. |
| 7 | Korean academic calendar shift disrupts cron cadence | 2 | 2 | Calendar config table; ops review every Sept and Feb. |
| 8 | Translation provider gap: no provider does ko→uz first-party (§P-6) | 3 | 5 | Pivot via en; explicit confidence badge; native-speaker HITL review; show original Korean. |
| 9 | Translation drift — Korean source updates but stale translations linger (§P-6) | 4 | 4 | `change_events` invalidates the `translations` row for affected fields; re-translation queued; UI shows "translation pending" badge. |
| 10 | Copyright on translated prose (§P-6, audit §10.3) | 3 | 2 | "View original (한국어)" link from every translated page; only facts (dates, numbers) shown machine-translated; prose summarized rather than full reproduced. |
| 11 | Cloudflare/bot-detection on a key `.ac.kr` site (audit §6.10) | 3 | 1 | Playwright stealth on VPS; KR proxy fallback (~$50/mo Bright Data SOCKS reserved). |
| 12 | LLM provider pricing changes mid-phase | 2 | 3 | Multi-provider abstraction in `extract/llm_*.py`; can switch from Sonnet to Gemini 2.5 Pro long-context overnight. |
| 13 | Supabase Pro RLS scale wall — auth.uid() in many policies on big tables | 3 | 2 | Materialized views for hot reads; `change_events` notification fan-out batched. Ready to upgrade to Team tier. |
| 14 | UnitedRecruitment unit normalization against data.go.kr fails | 3 | 3 | Manual mapping table for the top 1k recruitment units. Acceptable degradation. |
| 15 | Single-reviewer (founder) burnout during high season | 4 | 4 | Phase 2 must hire second reviewer; HITL queue priority caps daily review at 2 hours. |

---

## M. KPIs

Per phase, with target thresholds.

| KPI | Phase 1 target | Phase 2 | Phase 3 | Phase 4 | Measure |
|---|---|---|---|---|---|
| Crawl success rate (% of cron polls returning 2xx + parseable response) | 95% | 97% | 98% | 98% | `crawl_runs.status='succeeded'` / total |
| Parse accuracy (% of HITL-approved-as-is) | 70% | 80% | 85% | 88% | `review_queue.reviewer_decision = 'approved_as_is'` ratio |
| Time-to-publish after announcement detected (median) | 24h | 12h | 6h | 3h | `change_events.detected_at - announcement.detected_at` |
| User-tracked university count (sum across users) | 50 | 300 | 1,500 | 5,000 | row count in `user_tracked_universities` |
| Notification delivery rate | 80% | 90% | 95% | 97% | `user_alerts.delivered_at not null` ratio |
| Applications-tab engagement uplift (DAU on the tab) | +10% | +25% | +50% | +80% | analytics event |
| Translation confidence ≥ 0.8 (per language) | n/a | en: 90% | en: 95%, uz: 70% | en: 97%, uz: 85%, vi: 80%, mn: 75% | `translations.confidence` |
| Push notification CTR | n/a | n/a | 25% | 30% | FCM/APNs tap-through |

---

## N. Quick wins to ship in week 1

Even before Phase 0's discovery loop is producing parsed data, we ship:

1. **Adiga calendar materialized view.** Adiga publishes a clean admissions calendar (audit §3.6). Ingest the KCUE-published spreadsheet on day 2 → `mv_adiga_calendar`. The Flutter home screen reads it for "your upcoming deadlines" if the user has any tracked institution that maps to an Adiga record. Visible value in 48 hours, no parsing required.
2. **Home banner deadline widget.** A small ConsumerWidget on home that reads `v_user_upcoming_deadlines` (initially backed only by Adiga; later by `cycle_dates`). Single line: "📅 Spring 외국인전형 closes at SKKU in 14 days · 5월 21일 17:00 KST". Shipped in Phase 0 alongside the schema.
3. **`scripts/uni_db_smoke_test.dart`**. Replaces the legacy diagnostic scripts (§0.5). Run once weekly via cron locally as a freshness check.
4. **Source registry seeded with top-15.** Live in production from day 1, even if the parser only handles archetype-A by end of Phase 1. Discovery loop runs immediately so we accumulate raw `guideline_documents` blobs ready for Phase 1 to consume.

---

## O. Open questions / decisions before kickoff

1. **Budget ceiling.** $300/month steady-state is comfortable (§J). Is $960/month bursting acceptable in Sep–Dec? If not, we cap LLM concurrency and accept slower time-to-publish during high season.
2. **OCR vendor.** Naver Clova OCR (paid, best Korean) vs all-OSS easyocr-ko + PaddleOCR. The plan assumes Clova; ~$80/month delta. Confirm.
3. **VPS vs all-cloud-functions.** Plan picks Hetzner VPS. Alternative: pure Cloudflare Workers + R2 + Supabase. The VPS path is ~€5/mo cheaper but adds an SSH-able machine to ops surface. Confirm before Phase 0.
4. **Korean-only first vs multilingual from day 1.** §P phasing is Korean-only Phase 1, English Phase 2, Uzbek Phase 3. The Hanguk audience is largely Uzbek. Do we accelerate Uzbek to Phase 2 even at quality cost? (Recommend no — confidence flagging won't save us if Uzbek prose is broken.)
5. **HITL reviewer staffing.** Founder-only for Phase 0–1 is OK. Phase 2 needs a second reviewer (Korean-fluent) by day 30. Recruit channel? (Korean-language graduate students, freelance counselors.)
6. **`is_partner` semantics.** Today `is_partner=true` is used as a CRM flag for "we have a relationship". The new plan keeps it but the *recruitment* data is institution-agnostic. Confirm this is fine.
7. **Pricing for premium tier.** Phase 5+. Free vs $4.99/mo split — confirm intent before Phase 4 public API ships.
8. **Counselor mode.** Phase 5+. Confirm whether it's a per-seat model (B2B) or rev-share with applicant-side referrals.
9. **Whether to host Korean-original PDFs.** Audit §10.3 advises facts-only republishing. Storing raw blobs in R2 as immutable evidence is fine; serving them publicly is not. Confirm: backend-only access to `guideline-blobs` bucket; UI link points back to original university URL.
10. **Data residency.** Supabase region (likely ap-northeast-2 Seoul) and Naver Cloud OCR satisfy KR data residency. Confirm app store privacy policy reflects this for international users.

---

## P. Korean-First Crawl, Multilingual Presentation

This is a first-class architectural concern, referenced from §C (schema), §E (crawler), §F (extraction), §G (HITL), §H (app), §I (phasing), §J (cost), §L (risks).

### P.1 Discovery & crawl — Korean-only sources

The source registry stores **only Korean URLs**. English mirror URLs are explicitly out of scope as crawl targets. The audit (§6.1) shows that English sites at Korean universities are systematically stripped down: many guideline PDFs are KO-only, 정정공고 (corrections) almost always KO-only, scholarships sections often KO-only, calendar updates often go to KO first.

**Implementation:**

- `announcement_sources.url_ko` — the only URL column. There is no `url_en` field. A migration check enforces that no row's URL contains `/eng/`, `/en/`, or `/english/` path segments unless it's the bilingual main page (in which case the registry policy points to the KO sub-portal where guidelines actually live, e.g. `admission.snu.ac.kr` not `en.snu.ac.kr`).
- Search-based discovery in `services/uni_db/src/uni_db/discovery/search_*.py` uses Korean keyword vocabulary only. The vocabulary list is `services/uni_db/src/uni_db/discovery/keywords_ko.py` and includes (audit §6.3): `모집요강, 정정공고, 외국인전형, 외국인특별전형, 재외국민, 재외국민특별전형, 추가모집, 충원합격, 합격자발표, 원서접수, 등록금, 장학금, 편입학, 신·편입학, 변경공고, 일정변경`.
- Search providers in priority order: **Naver Search API** (primary, KR-native), **Daum Kakao Search API** (secondary), **Google PSE** with `lang=ko` only as fallback.
- For universities with bilingual portals (e.g. SNU has both `admission.snu.ac.kr` Korean and `en.snu.ac.kr` English), the registry exclusively points to the Korean sub-portal because that is where the guideline PDFs are first posted (audit §6.1).

### P.2 Storage — Korean as legal/audit anchor

Every canonical field row carries:

- `source_lang` — always `'ko'` for crawled fields,
- `source_text_ko` — raw verbatim Korean string preserved alongside the structured value (date, number, enum),
- `source_blob_hash` — pointer to the immutable `guideline_documents` blob.

For prose-bearing fields (free-text requirements, scholarship eligibility narratives, footnotes, correction notice bodies):

- Korean is the primary stored value (in the entity table's `prose_ko` or `notes_ko` column).
- Translations live in the side `translations` table keyed by `(entity_type, entity_id, field_name, lang)`.

**Schema choice (a) JSONB i18n column vs (b) separate `translations` table.**

Recommended: **(b) for prose, (a) for short labels.** §C.15 implements both. Justification: prose fields need per-language `confidence`, `provider`, `reviewed_by`, `reviewed_at`, `back_trans_distance` columns; squeezing those into a JSONB i18n column produces ugly nested-update SQL. Short labels (institution name, recruitment unit name) are read on every list query and the JSONB-column read avoids a join — for a 110-row institutions list, this matters.

### P.3 Translation pipeline

After Korean extraction lands and clears HITL review, the `translate_worker.py` fans out to produce target-language versions.

**Target languages.** The Hanguk app today supports en + uz at the *data layer* (database columns `name_en`, `name_uz`, etc.) but has no Flutter `intl` setup at the UI layer (§0.3). Phase 2 adds Flutter `intl` with **English** and **Uzbek**. Phase 3 adds **Vietnamese** and **Mongolian** at the data layer. Phase 4+ adds **Russian** and **Indonesian**. (We do not assume languages the project doesn't already touch — Hanguk users are predominantly Uzbek, with growing Vietnamese cohort.)

**Provider strategy:**

| Source | Target | Provider | Notes |
|---|---|---|---|
| ko | en | Claude Sonnet (prose), DeepL (labels) | DeepL ko↔en is excellent and cheap |
| ko | uz | **No first-party path**. Pivot ko→en→uz via Claude Sonnet for both hops. Mark `confidence -= 0.15` due to pivot. | Audit §P-6: this is a known gap |
| ko | vi | **Naver Papago** (best ko↔vi); Claude pivot fallback | Papago strongest ko↔vi |
| ko | mn | Pivot ko→en→mn via Claude | Mongolian poorly served by all major providers |
| ko | ru | DeepL (good), Claude fallback | DeepL supports ko↔ru directly |
| ko | id | Papago first-party | Strong ko↔id |

Glossary-locked terms (institution names, official admission categories) bypass translation entirely — looked up in `term_glossary` per §C.16. "서울대학교" never gets translated naively to "Capital University"; it's pinned to "Seoul National University" / "Seul Milliy Universiteti" (uz) / etc. via authoritative rows in `term_glossary`.

**HITL for translations.** Same `review_queue` as extraction (§G.4), with native-speaker reviewers per language. Phased rollout (§I): English first (highest reviewer availability), then Uzbek (Phase 3, recruit from Hanguk's existing Uzbek-speaking team), then Vietnamese / Mongolian (Phase 4, partner network).

### P.4 App side

**Flutter localization (§H.7).** The repo today has **no real `intl` setup**; Phase 2 adds `flutter_localizations`, `intl_utils`, and `lib/l10n/intl_en.arb`, `lib/l10n/intl_uz.arb`. Per §P guidance "without expanding it", the existing `name_en`/`name_uz` column convention at the database layer is preserved; the `display_names` JSONB column extends it without breaking the existing app code. Phase 3 adds `intl_vi.arb`, `intl_mn.arb`.

**API/views accept lang parameter.** Read views like `v_institutions_for_map` accept a `lang` parameter (via Postgres function-set-returning function or via app-side selection from JSONB). Fallback chain: `requested_lang → user.preferred_lang → 'en' → 'ko'`. `'ko'` is always the floor — no row is ever blank.

**Display rules.** If a translation is missing or `translations.confidence < 0.7`, the UI shows the Korean original with a small "translation pending" badge (`TranslationPendingBadge` widget added in §0.2). Important for trust.

**"View original (한국어)" toggle.** Every institution detail card, scholarship card, requirement card has a small `KoreanSourceToggle` widget that reveals `source_text_ko` verbatim. Doubles as a learning aid for Hanguk's Korean-learner audience.

### P.5 Quality controls

- **Translation confidence scoring** — stored in `translations.confidence`. Computed as `(1 - normalized_back_translation_distance) * llm_self_reported_confidence`. Threshold for HITL trigger: `< 0.7`.
- **Back-translation QC** — `back_translation_qc.py`: ko → target_lang → ko, Levenshtein distance against original ko. Stored in `translations.back_trans_distance`.
- **Reviewer console (§G)** — supports per-language review tabs. One tab per (`lang` × `entity_type`) bucket.
- **Key dates and numbers bypass translation entirely.** `cycle_dates.starts_at` is a `timestamptz` rendered with locale formatting on the client. Tuition amounts are `bigint`-KRW rendered via `intl.NumberFormat(locale).format(amount)`. Quotas are integers. Document type is an enum mapped to localized labels at the client. **No LLM ever touches a deadline, fee, quota, or ID.**

### P.6 Risk register additions (also in §L)

- Provider gap risk: ko → uz first-party absent. Mitigated by ko → en → uz pivot with explicit confidence badge.
- Translation drift risk: stale Korean sources triggering re-translation. Mitigated by `change_events` invalidating affected `translations` rows; re-translation auto-queued; UI shows "translation pending" until refreshed.
- Legal / copyright: storing translated copies of guideline language. Mitigated by always linking to original Korean source from every translated page; only facts shown verbatim in our DB; prose summarized rather than full-reproduced (audit §10.3).

### P.7 Phasing rollout (also in §I)

- **Phase 0–1.** Korean extraction only, displayed in Korean only. Reviewer-facing Studio is Korean-native, no translation required. App home banner uses Korean field for headline + numeric formatted by client locale.
- **Phase 2.** ko → en pipeline online. English UI in Flutter via `intl_en.arb`. Existing `name_en` columns continue to flow through.
- **Phase 3.** ko → uz pipeline. Native-speaker reviewer recruited. Confidence badge enforced.
- **Phase 4+.** Vietnamese, Mongolian; later Russian, Indonesian. Glossary maturation. Back-translation QC always-on.

---

## End of plan

**File path for the parent to attach:**

`C:\Users\User\Desktop\Hanguk\UNIVERSITY_DB_BUILD_PLAN.md`
