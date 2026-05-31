# services/uni_db

Korean Universities Database — service layer for the Hanguk app. Crawls Korean
admissions boards, parses guideline PDFs, runs LLM extraction with HITL review,
and translates the canonical Korean source into the languages Hanguk users read.

> **Phase 0 status (2026-05-07).** Scaffolded. No live API calls; no live crawls;
> no live DB writes. Everything runs against fixtures. See
> [`UNIVERSITY_DB_BUILD_PLAN.md`](../../UNIVERSITY_DB_BUILD_PLAN.md) §I-Phase-0
> for the full scope and exit criteria.

## Quickstart

```bash
cd services/uni_db
make install           # creates .venv, installs dev deps
make test              # runs the full pytest suite (fixture-only)
make crawl-snu-fixture # exercise the discovery loop end-to-end
make parse-fixture     # exercise the extraction pipeline (mocked LLM)
```

## Environment

Copy `.env.example` → `.env`. The master switch `UNI_DB_LIVE_APIS` defaults to
`false`; with that flag off, every paid integration returns deterministic mocks.
A second flag `UNI_DB_LIVE_CRAWL` gates ac.kr fetches. Both must stay off until
the owner approves.

| Variable group | Phase 0 needs it? |
|---|---|
| `SUPABASE_*` | Only when applying migrations or running the live worker |
| `R2_*` | No — bucket not provisioned yet |
| `ANTHROPIC_*` | No — call sites are mocked |
| `NAVER_CLOVA_OCR_*` | No — OCR layer is stubbed |
| `NAVER_SEARCH_*` | No — discovery uses fixtures |
| `NAVER_PAPAGO_*` / `DEEPL_API_KEY` | No — translation adapters are mocked |
| `DATA_GO_KR_APP_KEY` / `ADIGA_APP_KEY` | No — upstream pollers are scaffolded only |

## Layout

```
services/uni_db/
├── pyproject.toml
├── Makefile
├── Dockerfile             # not built/pushed in Phase 0
├── .env.example
├── src/uni_db/
│   ├── config.py
│   ├── db.py
│   ├── storage.py
│   ├── cli.py
│   ├── discovery/
│   │   ├── keywords_ko.py     # audit §6.3 vocabulary
│   │   ├── _adapter_base.py
│   │   ├── adapters/          # html_list, rss, naver_search starters
│   │   ├── classifier.py
│   │   ├── change_detection.py
│   │   ├── registry.py
│   │   └── attachment_downloader.py
│   ├── parse/
│   │   ├── pdf_text.py        # PyMuPDF + pdfplumber
│   │   └── ocr_naver_clova.py # stub
│   ├── extract/
│   │   ├── archetype.py       # 8-archetype dispatcher
│   │   ├── llm_anthropic.py   # mocked in Phase 0
│   │   ├── prompts/           # one .md per field group
│   │   ├── schemas.py         # JSON schemas matching §C tables
│   │   └── validators.py      # difficulty-aware HITL gate
│   ├── translate/
│   │   ├── claude.py | papago.py | deepl.py   # mocked
│   │   ├── glossary.py
│   │   ├── back_translation_qc.py
│   │   └── pipeline.py
│   └── workers/
│       ├── discovery_worker.py
│       ├── parse_worker.py
│       └── translate_worker.py
└── tests/
    ├── fixtures/              # synthetic HTML, RSS, JSON; no real ac.kr content
    ├── unit/                  # keywords, change-detection, glossary, validators…
    └── integration/           # adapter and parse-worker loops against fixtures
```

## Migrations

Schema lives in [`supabase/migrations/`](../../supabase/migrations) at the repo
root. Phase 0 ships these (NOT applied to production yet — they're staged):

| File | Purpose |
|---|---|
| `00000000000001_lovable_baseline.sql.PLACEHOLDER` | Awaits a `supabase db dump` against production |
| `20260601000000_uni_db_v1_institutions.sql` | institutions / recruitment_units / programs |
| `20260601000001_uni_db_v1_admission_cycles.sql` | admission_cycles / cycle_dates |
| `20260601000002_uni_db_v1_requirements_tuition.sql` | requirements / tuition |
| `20260601000003_uni_db_v1_scholarships_documents.sql` | scholarships / documents_required |
| `20260601000004_uni_db_v1_guideline_documents.sql` | guideline_documents (immutable blobs) |
| `20260601000005_uni_db_v1_announcements.sql` | announcement_sources / announcements |
| `20260601000006_uni_db_v1_crawl_ops.sql` | crawl_runs / crawl_findings / change_events / extraction_jobs / review_queue |
| `20260601000007_uni_db_v1_user_tracking.sql` | user_tracked_universities / user_alerts |
| `20260601000008_uni_db_v1_translations_glossary.sql` | translations / term_glossary / embedding_chunks |
| `20260601000100_uni_db_v1_views.sql` | v_institutions_for_map / v_recruitment_for_interview / v_user_upcoming_deadlines / v_review_queue_dashboard |
| `20260601000101_uni_db_v1_legacy_compat.sql` | helper functions for Phase 1 dual-read |
| `20260601000200_uni_db_v1_seed_term_glossary.sql` | top-15 institutions + admissions vocabulary |
| `20260601000201_uni_db_v1_seed_announcement_sources.sql` | top-15 KO admissions boards + 3 upstreams |

### Applying migrations (when ready)

```bash
# 1. dump production schema as the floor
supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --schema-only \
  > supabase/migrations/00000000000001_lovable_baseline.sql

# 2. dry-run against a staging project
supabase db push --db-url "$STAGING_DB_URL" --dry-run

# 3. apply to staging, validate, then production
supabase db push --db-url "$STAGING_DB_URL"
```

Migrations are idempotent (`create table if not exists`, `drop policy if exists`)
so re-running is safe.

## HITL review (Phase 0 v1)

```bash
make review-digest
# prints the contents of public.v_review_queue_dashboard as Markdown.
# Reviewers do their work in Supabase Studio against the underlying
# tables; the digest is just a daily checkable summary.
```

## Flutter app integration

Behind a compile-time flag:

```bash
flutter run --dart-define=UNI_DB_ENABLED=true
```

The flag wires the four new routes (plan §H.3) and the Riverpod providers
defined in `lib/features/uni_db/`. With the flag off (default), the
production app behaves exactly as it did before.

## What's intentionally stubbed in Phase 0

| Capability | Why deferred | Re-enable |
|---|---|---|
| Live ac.kr crawling | Owner approval needed; no fixture-vs-real divergence yet | `UNI_DB_LIVE_CRAWL=true` + KR proxy |
| Anthropic Claude extraction | $1.30/guideline; gate on owner sign-off | `ANTHROPIC_API_KEY` + `UNI_DB_LIVE_APIS=true` |
| Naver Clova OCR | Not provisioned; ~$80/mo at scale | `NAVER_CLOVA_OCR_*` |
| Naver Papago / DeepL translation | Same | `NAVER_PAPAGO_*` / `DEEPL_API_KEY` |
| Cloudflare R2 bucket | Not yet created | Provision + fill `R2_*` |
| Hetzner VPS | Not provisioned | Phase 1 ops task |
| pg_cron scheduler | Requires production Supabase access | Phase 0 step 5 |
| Push notifications | Phase 3 deliverable | FCM/APNs creds + Phase 3 worker |

## Anchors

- [`UNIVERSITY_DB_BUILD_PLAN.md`](../../UNIVERSITY_DB_BUILD_PLAN.md) — full plan
- [`UNIVERSITY_DB_AUDIT.md`](../../UNIVERSITY_DB_AUDIT.md) — research substrate
- Plan §I — phasing
- Plan §C — schema (canonical)
- Plan §P — Korean-first multilingual presentation
- Audit §5 — archetypes + 32 canonical fields
- Audit §6.3 — keyword vocabulary
