# Full-sync & automation plan — every university, on time, into staff review

_Date: 2026-05-24. Builds on the
[pipeline coverage audit](./pipeline_coverage_audit_2026-05-24.md) and the
[source-accuracy plan](./source_accuracy_remediation_plan.md) (the latter
implemented on PR #19). Goal: every configured university's admission
guidelines are discovered, fetched, extracted, translated, kept fresh, and
surfaced to staff for review — automatically and on schedule._

## Definition of done

1. All 12 configured universities (then the rest of the master list) have
   fetched `guideline_documents` and non-empty extractions, not just 3.
2. The pipeline runs **on a schedule** (seasonal cadence) with no human in
   the loop — discovery → fetch → parse → extract → translate → enqueue.
3. New/changed guidelines are re-crawled and re-surfaced within the cadence
   window; staleness is visible.
4. Every university with reviewable content appears in the staff queue /
   `hanguk-uz` site; "attempted-but-empty" and "never-attempted" are
   distinguishable (not silently absent).

## Why it's currently stuck (one paragraph)

The pipeline **logic exists end-to-end** but was never assembled into a
scheduled job. Discovery, fetch, parse, extract, translate all work — split
across `scripts/run_discovery_once.py` (loops `due_sources()`) and
`scripts/run_parse_once.py` (download → Supabase Storage →
`guideline_documents` → parse → `extraction_jobs`/`review_queue`). But: (a)
**nothing schedules them** — pg_cron only has a notifier + nightly GC; the
Hetzner host from ADR-003 was never provisioned; (b) they were hand-run with
`--limit 1` for 3 schools only, so 91 of 100 discovered posts were never
fetched; (c) the **classifier is bypassed** — `workers/discovery_worker.py:168`
inserts the literal `"unknown"` instead of `classify(ann).label`, so nothing
is ever auto-identified as a 모집요강; (d) extraction quality let Korea
University extract all-empty → dropped. PR #19 addresses (d).

## Architecture: what exists vs. what's missing

| Capability | Exists? | Where |
|---|---|---|
| Source registry + seasonal cadence + backoff | ✅ | `discovery/registry.py` (`due_sources`, `next_interval_minutes`, `is_high_season`) |
| Discovery (list posts, change-detect, write `announcements`) | ✅ | `workers/discovery_worker.py`, `scripts/run_discovery_once.py` |
| Post classifier (guideline vs notice) | ✅ exists, ❌ **not persisted** | `discovery/classifier.py`; bug at `discovery_worker.py:168` |
| Fetch: announcement → PDF → Storage → `guideline_documents` | ✅ as a script | `scripts/run_parse_once.py` (steps 1–4) |
| Parse + extract + enqueue | ✅ | `workers/parse_worker.py` (+ PR #19 quality) |
| Translate | ✅ | `workers/translate_worker.py`, edge `translate-document` |
| PDF resolvers (KU/Inha/Yonsei/KAIST) | ✅ (KAIST added on PR #19) | `parse/pdf_resolvers/` |
| **A single live "run the whole pipeline" entry point** | ❌ | CLI is fixture-only (`cli.py:158`) |
| **A scheduler / host running it on a timer** | ❌ | no cron/systemd/Action; ADR-003 host unprovisioned |
| **Coverage/freshness observability** | ⚠️ partial | `crawl_runs` exists; no per-institution coverage/staleness surface |

**Conclusion: this is an assembly + scheduling + one-bug-fix job, not a rebuild.**

---

## Workstreams

### WS1 — Fix the classifier persistence bug (fast, unblocks everything)
`workers/discovery_worker.py:168` writes `"unknown"`/`None` literals even
though `classify(ann)` ran at line 83. Persist `cls.label` /
`cls.confidence`. Then the fetch stage can select **guideline-classified**
announcements instead of guessing by attachment presence. Add a unit test
asserting the persisted label matches the classifier. (Backfill: re-classify
the existing 100 announcements once.)

### WS2 — Assemble one live pipeline runner
Promote the proven script logic into worker modules and a single entry point
so it can be scheduled and tested:
- Add `workers/fetch_worker.py` from `run_parse_once.py` steps 1–4 (select
  guideline announcements lacking `guideline_document_id` → resolve via
  `pdf_resolvers` → download → `supabase_storage` → insert
  `guideline_documents(parse_status='pending')` → link the announcement).
- Add a `uni-db run-pipeline` CLI command (live, flag-gated) that runs, in
  order: discovery over `due_sources()` → fetch pending guideline
  announcements → parse pending `guideline_documents` → translate pending
  fields. Parameters: `--max-sources`, `--max-fetch`, `--since`,
  `--dry-run`. No `--limit 1` bottleneck — process the whole due/pending set
  (bounded by a sane cap + budget guard).
- Keep `scripts/run_*_once.py` as thin wrappers so existing muscle memory
  still works.

### WS3 — Schedule it (the "on time" part)
The cadence logic already exists (`registry.next_interval_minutes`: high
season = not Jun–Aug; per-source `cron_*_minutes`; failure backoff). It just
needs a runner on a timer.
- **Near-term (recommended, ~1 day): GitHub Actions scheduled workflow.**
  A `.github/workflows/uni-db-crawl.yml` on `cron` (e.g. every 3–6h) that
  installs the service and runs `uni-db run-pipeline`, with
  `UNI_DB_LIVE_CRAWL`/`UNI_DB_LIVE_APIS`, `SUPABASE_DB_URL`,
  `ANTHROPIC_API_KEY` from repo secrets. Zero servers; gets all 12 flowing
  immediately. Trade-offs: 6h job cap, no persistent Playwright profile.
- **Long-term (ADR-003): Hetzner CX22 + systemd timer** for 24/7 crawling,
  heavy Playwright/OCR, and a stable egress IP for polite KR traffic.
  Provision per `docs/runbooks/hetzner-provisioning.md`; `run_discovery_once.py`
  already documents the `/opt/hanguk-uni-db` layout.
- pg_cron stays for in-DB jobs only (it can't run Python); optionally have it
  call an edge function that pings the runner, per the discovery_worker
  docstring — but the scheduler above is simpler.

### WS4 — Drain the existing backlog (one-time)
91 announcements across the 9 waiting universities are already discovered.
After WS1+WS2, run `uni-db run-pipeline` once with a high fetch cap (or
`run_parse_once.py --limit N`) to fetch+extract them. This is **paid LLM +
prod-mutating** — gate on owner approval and the `UNI_DB_LIVE_*` flags;
budget per ADR-001. Expect this to populate all 9 universities' queues.

### WS5 — Coverage, freshness & staff surfacing
- **Coverage view**: per `(institution, field_group)` — last successful
  extraction, attempted-but-empty vs never-attempted, last source URL. So a
  university with no data shows *why* (not silently absent). Surface in the
  `review-digest` and to ops.
- **Staleness/health**: alert when a `live` source's `last_polled_at` or a
  university's freshest guideline exceeds threshold, or `consecutive_fails`
  climbs. (Data already in `announcement_sources` / `crawl_runs`.)
- **Re-crawl on change**: `guideline_documents` already has
  `file_hash_sha256` / `http_etag` / `superseded_by_id` — ensure a changed
  PDF supersedes the old and re-enqueues (change-event outbox already exists).
- **Reach staff**: confirm non-empty extractions enqueue and render on the
  `hanguk-uz` site via `v_review_queue_dashboard` (the content agent's UI work
  + the `min_row_confidence` / source-link contract from PR #19). Enforce one
  open queue row per `(institution, field_group)` so re-extraction supersedes
  rather than duplicates (the Inha double-card).

### WS6 — Extraction quality (dependency: PR #19)
The accuracy fixes (status sentinels, truncation re-extraction, KAIST
resolver, text hygiene, canonical sub-page crawl WS-C still pending) raise the
non-empty yield so fetched docs don't end up like Korea University (all-empty
→ dropped). Land PR #19; finish WS-C (sub-page crawl) and E5 (precompute
`prose_en`) so the site renders instantly.

### WS7 — Data hygiene & onboarding
- Link or remove the **21 orphan `announcement_sources`** (null
  `institution_id`, never polled) from the top-30 seed.
- Onboard the remaining universities from
  `docs/uni_db/korea_universities_master_list.md`: seed sources, set
  `status='live'`, confirm each has a working adapter
  (`discovery/adapters/configs/`) and, where the post links to an HTML detail
  page, a PDF resolver.

---

## Sequencing (fastest path to "all 12 flowing")

1. **WS1** classifier bug fix + re-classify backfill (hours).
2. **WS2** fetch worker + `run-pipeline` command (1–2 days, unit-tested with
   fixtures/mocks).
3. **WS6** land PR #19 (quality) so the drain yields non-empty data.
4. **WS4** one-time backlog drain (owner-approved, paid) → all 9 populate.
5. **WS3** GitHub Actions schedule → ongoing automatic sync; Hetzner later.
6. **WS5 + WS7** observability, freshness, orphan cleanup, onboarding.

## Cost, safety & politeness

- Paid LLM calls scale with documents × 5 field groups; gate every live run
  on `UNI_DB_LIVE_APIS`, cap per-run document counts, and keep the
  `cost_estimator`/budget guard (ADR-001).
- Respect the seasonal cadence + jitter + backoff already in `registry.py`;
  don't hammer ac.kr. One source at a time per host, polite User-Agent.
- All runs idempotent: announcements upsert on `(source_id, external_post_id)`;
  `guideline_documents` dedupe on `file_hash_sha256`; translations on
  `(entity, field, lang)`. Re-runs are safe.

## Verification (definition of done check)

Re-run the audit queries after the drain + first scheduled run:
- `guideline_documents` and non-empty `extraction_jobs` exist for **all 12**
  universities (not 3).
- `announcements` with `classifier_label != 'unknown'` > 0; fetched-ratio for
  guideline-labeled posts ≈ 1.
- `review_queue` open items span multiple universities; each renders on the
  site.
- `cron`/Actions shows the pipeline running on schedule;
  `announcement_sources.last_polled_at` advances and new docs appear between
  runs.

## Decisions needed

1. **Scheduler host:** GitHub Actions now (recommended for speed) vs. stand up
   the ADR-003 Hetzner VPS first.
2. **Scope:** the 12 configured now, or onboard the full top-30 master list in
   this effort.
3. **Backlog drain approval:** WS4 spends real LLM budget on prod — confirm
   before running.
