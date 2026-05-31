# Phase 1 — what's done, what's still mocked

> Paired with [`UNIVERSITY_DB_BUILD_PLAN.md`](../../UNIVERSITY_DB_BUILD_PLAN.md) §I-Phase-1
> and [`UNIVERSITY_DB_AUDIT.md`](../../UNIVERSITY_DB_AUDIT.md) §5/§6.
> Phase 0 notes live in `services/uni_db/README.md`; this file is the diff.

## Components promoted to production-ready

| Component | Phase 0 | Phase 1 |
|---|---|---|
| Archetype dispatcher | Single-anchor stub returning `B` by default. | Multi-signal classifier: body anchors + filename hints + title hints + page-count brackets + bilingual layout + table density + column count. Confidence-scored; below 0.55 routes to HITL instead of guessing. (`extract/archetype.py`, `extract/archetype_signals.py`) |
| Extraction prompts | Five short markdown stubs. | Production-grade prompts for `calendar`, `tuition`, `basic_requirements`, `recruitment_units`, `document_checklist`. Each includes strict JSON envelope, footnote handling, 정정공고 amendment handling, and per-archetype calibration files (A–H). Glossary header is rendered live from `term_glossary` rows. |
| Prompt assembly | n/a | `extract/prompt_assembler.py` composes glossary + system + archetype-specific few-shots + user template. Returns an `AssembledPrompt` with token-estimate metadata. |
| Cost estimator | n/a | `extract/cost_estimator.py` predicts input/output tokens and USD cost per provider, per archetype, per field group. Used by the orchestrator's "skip LLM, route to HITL" gate. |
| Korean date parser | None — relied on the LLM to normalise. | `parse/dates_ko.py` covers `2026.03.15`, `2026년 3월 15일`, `2026-03-15`, `03.15(수)`, AM/PM, range separators (`~`, `–`, `—`, ` -- `), and the 예정/예상/잠정 tentative markers. |
| Korean number parser | None. | `parse/numbers_ko.py` handles plain digits, comma-grouped, KRW/₩ prefixes, and compound multipliers (만, 백, 천, 억, 조). |
| Table extraction | pdfplumber-only with no normalisation. | `parse/tables.py` adds: pdfplumber primary → PyMuPDF fallback, merged-cell flattening, rotated-table detection + transpose, multi-page span stitching. |
| Tuition section detector | Regex against headings, no row extraction. | `parse/sections.py` resolves the `등록금` heading + table or inline-line lines, classifies rows by `audit §4.4` faculty_group, returns typed `TuitionRow` records. |
| HITL review queue | One read view (`v_review_queue_dashboard`). | + `review_decisions` audit table, `v_review_queue_by_archetype`, `v_review_queue_by_field_group`, `v_review_queue_overdue`, `v_extraction_accuracy_by_archetype`. Trigger writes `review_decisions` rows automatically when `review_queue.status` transitions to terminal. |
| Reviewer assignment | n/a | `fn_pick_next_reviewer()` round-robins among `profiles.role='uni_db_reviewer'`. `fn_claim_review_queue()` atomically transitions `open → in_review` with `FOR UPDATE SKIP LOCKED`. |
| Markdown digest | One-line summaries via raw SQL print. | `hitl/digest.py` renders the queue + overdue + per-archetype accuracy as stable Markdown. The `uni-db review-digest` CLI consumes it. Snapshot-style unit tests assert the rendered output. |
| Flutter — verified deadlines | Stub `ComingSoonCard`. | `VerifiedDeadlineCard` + `VerifiedDeadlinesOverlaySliver` slot into the existing Applications tab as a sliver above the user's free-text entries. Reads `v_user_upcoming_deadlines`. |
| Flutter — recent changes banner | n/a | `HomeRecentChangesBannerSliver` reads `v_user_recent_changes` (new view). Sorts correction notices to the top. Inserted into the Applications tab; renders nothing when the flag is off or the user isn't tracking anything. |
| Flutter — university-specific interview | Provider exposed but unused. | `UniversitySpecificSetupAddon` slots into `interview_setup_view.dart`, reads `v_recruitment_for_interview` for the chosen institution, and falls back to a "Try general interview instead" CTA when no verified data exists. |
| Test fixtures | One synthetic SNU HTML + one RSS + one Naver-search JSON. | Plus a Korean-text payload + filename/title hints + expected-shape assertions for each of the 8 archetypes. Generator lives at `tests/fixtures/archetypes/fixtures.py`. |
| End-to-end pipeline test | n/a | `tests/integration/test_pipeline_end_to_end.py` walks fixture → archetype detector → parser → prompt assembler → mocked LLM → validator → review_queue, asserting each contract. |

## Components still intentionally mocked / disabled

| Capability | Why deferred | Re-enable trigger |
|---|---|---|
| Anthropic Claude live calls | $1.30/guideline; needs owner approval. The mock returns deterministic JSON the validator accepts, so the rest of the pipeline is exercised. | `ANTHROPIC_API_KEY` set + `UNI_DB_LIVE_APIS=true`. Live call site lives at `extract/llm_anthropic.py:_call_anthropic` and currently raises `NotImplementedError`. |
| Naver Clova OCR | Not provisioned; ~$80/mo. | `NAVER_CLOVA_OCR_*` env + `UNI_DB_LIVE_APIS=true`. The Phase 0 stub still returns `<naver-clova-ocr stubbed>`. |
| Naver Papago / DeepL | Not provisioned. Phase 1 keeps the routing logic real — pivot routing through Claude for ko→uz/mn — but every adapter returns mock strings. | Set respective `*_API_KEY` env. |
| Cloudflare R2 | Bucket not created. `storage.store_blob()` writes to `./.cache/blobs/<sha256>/<sha256>` instead. | Provision bucket + fill `R2_*` env. |
| Live ac.kr crawl | Owner approval not yet in. | `UNI_DB_LIVE_CRAWL=true` + KR proxy + per-source allowlist sign-off. |
| pg_cron scheduler | Requires production Supabase access. | Install `pg_cron` extension and create the schedule per plan §E.4. |
| Push notifications (FCM/APNs/web-push) | Phase 3 deliverable. | FCM service-account JSON + APNs key + VAPID keys. |
| Production `supabase db dump` baseline | Phase 0 placeholder still in `00000000000001_lovable_baseline.sql.PLACEHOLDER`. | Run the dump command in `services/uni_db/README.md` "Applying migrations" section. |

## What landed in Supabase migrations during Phase 1

```
20260605000000_uni_db_v1_review_decisions.sql       # audit log table
20260605000100_uni_db_v1_review_views.sql           # 4 new HITL views
20260605000200_uni_db_v1_reviewer_assignment.sql    # plpgsql round-robin
20260605000300_uni_db_v1_recent_changes_view.sql    # v_user_recent_changes
```

All idempotent (`create … if not exists`, `drop policy if exists`,
trigger gated via `OLD … is distinct from NEW …`). Re-running them
against an already-populated DB is safe.

## Open items still gating Phase 2

The plan §O list has not been resolved between phases — Phase 0 surfaced
all 10 questions and Phase 1 didn't get any answers. They remain
blockers for Phase 2:

1. Budget ceiling acceptance ($300/mo steady, $960/mo high-season).
2. OCR vendor decision (Naver Clova vs OSS).
3. VPS vs Cloudflare Workers placement.
4. Uzbek Phase 2 vs Phase 3.
5. HITL reviewer-2 recruit channel.
6. `is_partner` semantics retention.
7. Premium-tier pricing and packaging.
8. Counselor mode shape.
9. Backend-only access to `guideline-blobs`.
10. Data residency confirmation.

When they're answered we can flip the live flags + apply migrations
without further code change in this layer.
