# Uni-DB: Scheduled auto-crawl of admission guidelines (revival)

**Decision (2026-07):** re-enable automated, scheduled discovery of every
institution's current admission guideline (모집요강) PDF, feeding the existing
Claude extract → publish → translate pipeline. A daily cloud job checks all
tracked institutions (~300), finds newly-published guideline PDFs on each
university's own site, and ingests only the new ones.

This **reverses the scope** of `manual-upload-redesign.md` (2026-06), which cut
automated discovery in favour of a human-uploads-each-PDF model. That model
kept the robust half (Claude reading PDFs) but left the review queue empty
"until a human uploads." The owner has asked for the discovery half back, on a
schedule, so the database stays current without manual work. Manual upload
(`upload-guideline`) still works and is unchanged — this adds an automatic
front door alongside it; both land the same `guideline_documents(pending)` row.

## Why this is not the old brittle crawler

The 2026-06 cut was right about per-site **board adapters** — hand-written
scrapers for ~13 schools that break silently when a site changes and never
scaled to 300. This revival does **not** use adapters. It reuses the
search-based discovery that was already built and tested for `propose-sources`:

- For each institution it runs a **site-scoped Naver web search**
  (`site:<domain> <year>학년도 외국인전형 모집요강`) — the same `NaverSearchAdapter`
  the propose worker uses, so there is no per-site markup to maintain.
- Hits are filtered to the university's own registrable domain, ranked
  (direct PDF > 모집요강 > foreign-applicant guide > target year, procurement
  tenders dropped), and the best few are downloaded via the existing generic
  PDF resolver (`resolve_to_pdf`, shared with `ingest-direct`).
- A PDF is ingested **only when its SHA-256 is unseen** (and its URL isn't
  already stored). So a daily sweep costs one search per school and re-bills the
  paid LLM only for genuinely new guidelines — a republished/next-cycle guide is
  a new file → new hash → ingested; an unchanged one is skipped for free.

If a search finds nothing for a school, that school is simply skipped this run
(logged, counted) — the silent-stall failure mode of the adapter crawler is
structurally gone because coverage is reported per run.

## Moving parts

| Piece | Where |
|---|---|
| Finder worker | `src/uni_db/workers/guideline_finder_worker.py` |
| CLI command | `uni-db find-guidelines [--limit N] [--year YYYY] [--per-institution K]` (`src/uni_db/cli.py`) |
| Daily schedule | **Claude scheduled task (Routine)** — a fresh Claude session at 00:00 and 02:00 Asia/Tashkent installs the service and runs `find-guidelines → reparse --pending-only → publish → translate` against prod. |
| Manual fallback | `.github/workflows/uni-db-auto-crawl.yml` (workflow_dispatch only — the daily cron lives in the Routine, not here, to avoid double-crawling) |
| Unit tests | `tests/unit/test_guideline_finder_worker.py` |

Reused unchanged: `NaverSearchAdapter`, `resolve_to_pdf` / `insert_guideline_document`
/ storage / `_default_run_parse` (fetch + direct-ingest substrate), `parse_worker`
(Claude extraction), `publish_worker`, `translate_worker`.

## Pipeline

```
uni-db find-guidelines                         (this job, per institution)
  ├─ Naver site: search  ──▶ ranked candidate URLs (on-domain only)
  ├─ resolve_to_pdf       ──▶ PDF bytes  ──▶ SHA-256
  ├─ new hash? ─ no ─▶ skip (unchanged, no LLM cost)
  │            └ yes ─▶ store blob ─▶ guideline_documents(parse_status='pending')
  └─ run_parse (Claude extract) ─▶ review_queue
         │
         ▼   (same job, then every 30 min via process-uploads too)
   reparse pending ─▶ publish ─▶ translate ─▶ student app
```

## Schedule — Claude scheduled task (Routine)

The daily cadence is owned by **two Claude scheduled tasks**, not a GitHub cron.
Each fires a fresh Claude session at **00:00 and 02:00 Asia/Tashkent (UTC+5)** —
i.e. `0 19 * * *` and `0 21 * * *` UTC — which installs the service and runs
`find-guidelines → reparse --pending-only → publish → translate` against
production, then reports a summary. Two passes give freshness + a same-night
retry. `uni-db-auto-crawl.yml` is kept as a manual (`workflow_dispatch`)
fallback only, so the two schedulers never double-crawl.

## Required configuration (Claude environment)

The scheduled Claude session runs the crawl directly, so these must be present
as **environment variables in the Claude Code environment** (not GitHub secrets):

- `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` — Claude extraction
- `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` — the search step
- (optional) `DEEPL_API_KEY` — translation stage

`UNI_DB_LIVE_CRAWL=true` and `UNI_DB_LIVE_APIS=true` are exported by the Routine
prompt itself. The command self-refuses (exit 2) unless the live flags, the
Naver keys, and `SUPABASE_DB_URL` are all present, so a misconfigured run can't
quietly do nothing or fire paid calls by accident. The production Supabase
project must also be active (unpaused) and the environment's network policy must
allow outbound calls to `*.ac.kr`, `openapi.naver.com`, the Supabase host, PyPI,
and `api.anthropic.com`.

If you'd rather keep production credentials out of the Claude environment, the
`uni-db-auto-crawl.yml` workflow can be switched back to a `schedule:` and run
on GitHub Actions with the `UNI_DB_*` repo secrets instead.

## Known limits / follow-ups

- **Coverage depends on search recall.** A school whose guideline isn't indexed
  by Naver under these keywords won't be found automatically; it still falls back
  to manual upload. Add `GOOGLE_PSE_*` as a second search backend if recall on
  the long tail proves thin.
- **Same-URL republish (corrections)** where the file is replaced in place but
  the URL stays identical is treated as "already known" (skipped) until the URL
  changes; corrections almost always ship as a new filename, and `reparse` can
  be run manually to force a re-extract when needed.
- **Semester targeting** biases the *search and ranking* toward the target
  academic year; the authoritative year/term is still inferred from the PDF by
  `publish_worker` and confirmed by a reviewer (`admission_cycles.status`).
