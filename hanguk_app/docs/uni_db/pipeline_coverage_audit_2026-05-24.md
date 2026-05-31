# Uni-DB pipeline coverage audit — why only 2 universities appear

_Date: 2026-05-24. Trigger: the review queue shows only Inha + KAIST despite
12 universities being configured; owner asked whether the pipeline is broken
or "scheduled to a different time". Method: live read-only queries against
the prod Supabase project (Hanguk 2026, `lysjdtyanhdfphqyijsr`) + code/docs
read._

## Verdict

**It is not "scheduled for later" — there is no scheduler running the crawl
pipeline at all.** Discovery, fetch, parse, extract, and translate are all
manual CLI runs. The data in prod came from a one-off manual run on
**2026-05-14 → 17**; nothing has produced new data since. "Many hours and
nothing appears" is expected: no job exists to produce anything.

Separately, even the manual run only carried **3 of 12** universities through
fetch+extract, and of those only **2** produced non-empty content — which is
why the queue shows Inha + KAIST.

## The funnel (prod, snapshot 2026-05-24 00:58 UTC)

| Stage | State | Evidence |
|---|---|---|
| Discovery (find posts) | working for **all 12** | 100 `announcements` across all 12 institutions, latest detected 2026-05-21 |
| Classify (is it a 모집요강?) | **not labeling** | all 100 announcements have `classifier_label = 'unknown'` |
| Fetch → `guideline_documents` | ran for **3 schools only** | **9 of 100** announcements fetched (Inha 5, KAIST 3, KU 1), all 2026-05-14→17 |
| Parse / extract | same 3 schools | 48 `extraction_jobs`; last one **2026-05-17 17:44** |
| Review queue | 39 rows, **4 open** | Inha requirements ×2, KAIST documents_required, KAIST scholarships |

Totals: 12 institutions · 34 announcement_sources · 100 announcements · 9
guideline_documents · 48 extraction_jobs · 39 review_queue (4 open).

## The 9 "missing" universities are discovered and waiting

Discovery found posts for every university; the download+parse step was simply
never run for them. Announcements detected vs. fetched-into-document:

| University | announcements | fetched | latest detected |
|---|---:|---:|---|
| Inha | 15 | 5 | 2026-05-15 |
| Seoul National (SNU) | 12 | **0** | 2026-05-20 |
| Chungbuk National | 11 | **0** | 2026-05-15 |
| Kangwon National | 10 | **0** | 2026-05-15 |
| Jeju National | 10 | **0** | 2026-05-15 |
| KAIST | 10 | 3 | 2026-05-14 |
| Korea University | 9 | 1 | 2026-05-14 |
| Jeonbuk National | 7 | **0** | 2026-05-15 |
| Konkuk | 6 | **0** | 2026-05-15 |
| Yonsei | 4 | **0** | 2026-05-14 |
| Sungkyunkwan (SKKU) | 4 | **0** | 2026-05-21 |
| Hanyang | 2 | **0** | 2026-05-15 |

91 of 100 discovered posts never became documents.

## Why only Inha + KAIST (not even Korea University)

`extraction_jobs` by school (non-empty = rows/events with content):

| University | jobs | non-empty | failed | result |
|---|---:|---:|---:|---|
| Inha | 25 | 2 rows | 10 | 2 open items (the duplicate 전형 cards) |
| KAIST | 18 | 3 rows + 1 events | 3 | 2 open items (documents, scholarships) |
| Korea University | 5 | **0** | 0 | all empty `{"rows":[]}` → dropped by queue hygiene → **0 visible** |

= 4 open items across 2 universities. Korea University was processed but every
extraction came back empty, so the Layer-1 hygiene rule (don't queue empties)
correctly dropped it — leaving only Inha + KAIST on screen.

## Root causes

1. **No automation.** The only pg_cron jobs on prod are
   `uni-db-notify-tracked-changes` (every minute) and three nightly GC jobs
   (`gc-pdf-access-log` 03:00, `gc-change-event-outbox` 03:05,
   `gc-user-push-tokens` 03:10). **None** poll sources, fetch PDFs, parse, or
   extract. pg_cron can't run the Python workers, and no GitHub Action /
   systemd timer / Hetzner host is wired up (the worker host is a deferred
   Phase-3 item). The pipeline only advances when someone runs
   `run_discovery_once.py` / `run_parse_once.py` / the `_seed_*`/`_reset_*`
   scripts by hand.
2. **The fetch/extract backlog was never drained.** Discovery kept finding
   posts for all 12 schools (sources are all `status='live'`, polled ~every
   6h, `consecutive_fails = 0`, `last_polled_at` 2026-05-23), but the
   download+extract step was hand-run for only 3 schools once, a week ago.
   Polling updates `last_polled_at` and inserts announcements; it does not
   fetch/parse — and nothing ran the fetch/parse half since 2026-05-17.
3. **The post classifier outputs `unknown` for everything** (100/100). So even
   an automated fetch step would have no signal for which posts are admission
   guidelines worth downloading.

Secondary: **21 orphan `announcement_sources`** (no `institution_id`, never
polled — `last_polled_at` null, `next_poll_at` 2026-05-23) from the top-30
seed; dead rows that should be linked or removed.

## Other environments

- **Staging** (`hanguk-staging`, `nhjzbjzhmugcmzchzxlv`): 3 institutions, 34
  sources, **0 announcements**, 3 docs (last fetch 2026-05-10), 0 extraction
  jobs, 0 open queue. The pipeline isn't running there either.

## Recommended path (not yet implemented)

1. **Stand up automation** so the pipeline runs itself: a scheduled runner
   (Hetzner cron / systemd timer / GitHub Action / a worker container) that
   executes discovery → fetch → parse → extract → translate on a cadence.
   pg_cron alone can't do this (no Python); it can only trigger an edge
   function or SQL.
2. **Fix the classifier** so announcements get a real `classifier_label`
   (guideline vs. notice), giving the fetch step a selection signal instead of
   processing nothing or everything.
3. **Drain the existing backlog**: run fetch+parse+extract over the ~91
   already-discovered announcements for the 9 waiting universities. This is a
   paid-LLM, prod-mutating action — gate behind owner approval and the
   `UNI_DB_LIVE_*` flags.
4. **Quality** (in flight on PR #19): the extraction-correctness fixes raise
   the non-empty yield, so fewer schools end up like Korea University
   (all-empty → dropped).
5. **Clean up** the 21 orphan sources (link to institutions or delete).

## How to re-verify (read-only)

```sql
-- funnel
select (select count(*) from institutions) inst,
       (select count(*) from announcements) anns,
       (select count(*) from announcements where guideline_document_id is not null) fetched,
       (select count(*) from guideline_documents) docs,
       (select count(*) from extraction_jobs) jobs,
       (select count(*) from review_queue where status='open') open_items,
       (select max(fetched_at) from guideline_documents) last_fetch;
-- what's scheduled (expect only notify + GC, nothing for crawl)
select jobid, schedule, jobname, active from cron.job order by jobid;
```
