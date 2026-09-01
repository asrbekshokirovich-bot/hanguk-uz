# uni_db — Implementation Plan to Reach a Healthy System

Written 2026-09-01, after the eight-phase audit (`AUDIT_RESULTS.md`) and the
post-cutover re-check. Every item below is tied to a measured number, not a guess.

## Context: what the cloud move did and did not fix

The move to the Claude cloud/subscription lane happened **today between 05:00 and
08:00 UTC** and is genuinely working: credit-balance failures went from ~100 % of
jobs (Aug 22–31) to **zero after 08:00**, and the system did **129 jobs / 83
successes today — more than the previous ten days combined**, at $0 recorded spend.

It did **not** fix three things, and it exposed a fourth:

| Still broken | Measured today |
|---|---|
| Extraction timeouts | **29.5 % of all jobs** (38 of 46 failures) |
| Subscription throttle | 3 session-limit failures at 14:00; 5/16 succeeded that hour |
| Nothing reaches students | **0** verified cycles, **0** rows in the deadline view, 38 approved-unpublished |
| *New:* review queue filling | 79 cards created today, 68 open, first `alert_review_backlog` at 13:45 |

**Definition of "healthy" used below:** data flows in, gets extracted without loss,
gets reviewed at the rate it arrives, reaches students correctly, and a human is
told within the hour when any of that stops.

---

## Stage 1 — Stop losing extraction work  ·  ~1 day  ·  biggest measured loss

### 1.1 Fix the timeout ceilings — this is the single highest-value change

`_CLI_TIMEOUT_BY_GROUP` (`src/uni_db/extract/llm_anthropic.py:724`) has entries for
`requirements`, `scholarships`, `documents_required`, `document_checklist` — but
**not for `calendar` or `tuition`**, which therefore fall back to the 240 s default.

Today's evidence:

| Group | Configured ceiling | p50 (ok) | p95 (ok) | Max ok | Timeouts today |
|---|---|---|---|---|---|
| **calendar** | **240 s (default)** | 199 s | **240 s** | 428 s | **36** |
| **tuition** | **240 s (default)** | 122 s | 226 s | 234 s | **2** |
| documents_required | 1800 s | 302 s | 601 s | 629 s | 0 |
| requirements | 900 s | 231 s | 500 s | 553 s | 0 |
| scholarships | 900 s | 379 s | 429 s | 434 s | 0 |

`calendar`'s p95 sitting exactly on 240 s is the signature of a distribution
truncated by the limit — and a 428 s success proves it legitimately needs longer.
Every group that has a real ceiling had **zero** timeouts.

**Change:** add `"calendar": 900.0` and `"tuition": 600.0` to the map.

**Expected effect:** recovers ~36 jobs/day. Deadlines are the most valuable field
group and currently the worst hit.

### 1.2 Make a timeout retryable instead of fatal

`llm_cli.py:339` turns `subprocess.TimeoutExpired` into a `ClaudeCliError`, which is
fatal — the group is lost for that document with no second attempt.

**Change:** on timeout, retry once at 1.5× the ceiling before failing. Keep the
existing usage-limit backoff untouched.

### 1.3 Respect the subscription's reset window instead of burning attempts

Session-limit errors carry their own reset time ("resets 3pm UTC"). Today three jobs
hit it at 14:00 and the hour recovered at 15:00.

**Change:** when the error names a reset time, sleep until it rather than consuming
the retry budget. Cheap, and turns a stall into a pause.

**Exit criteria:** extraction failure rate < 5 % (from 36 %); zero timeout losses on
calendar.

---

## Stage 2 — Open the exit  ·  ~1–2 days  ·  converts work already done into value

Nothing above matters to a student until this is fixed. 492 items have been approved;
**65 ever published**; **0** cycles are `verified`.

### 2.1 Resolve the `verified` dead-end

`publish_worker.py:338` always writes `status='unverified'`, and nothing anywhere
promotes it. Three views filter on `status='verified'` — so they are permanently
empty — while the newer guest views filter `status <> 'superseded'` and do return
data. The schema holds two contradictory notions of "ready to show".

**Recommended change:** align the three stale views to `status <> 'superseded'`,
matching the guest views.

Rationale: this shows authenticated students exactly what **guests already see
today**, so it exposes no new data and needs no pipeline change — a migration only.
Inventing a promotion step instead would be a larger change for the same result.

**Caveat to decide:** 337 of 528 cycles carry `needs_attention`. Recommend showing
them with a visible "needs checking" marker rather than hiding them, since hiding
them is what produces today's empty screen.

### 2.2 Make publishing honest and idempotent

- Write `published_outcome` — the column exists (`'published'/'held'/'skipped'`) and
  is **never written**; 286 rows have `published_at` set with no recorded outcome.
- Wrap each item's inserts in a transaction so a mid-item failure cannot leave half
  the rows behind for the next run to duplicate.

### 2.3 Kill the duplicates, then make them impossible

**209 duplicate groups already reach students**: 169 `documents_required`,
24 `tuition`, 12 `requirements`, 4 `scholarships`.

1. De-duplicate existing rows (keep newest per natural key).
2. Add unique indexes on the real natural keys — note `tuition`'s current key
   includes a nullable column the publisher always leaves NULL, so it never fires.

**Exit criteria:** deadline view returns rows; approved-unpublished backlog = 0;
duplicate groups = 0.

---

## Stage 3 — Let the queue drain at the rate it fills  ·  ~2–3 days

Extraction now produces ~79 cards/day. Humans are not clearing that, and the backlog
alert fired for the first time today.

### 3.1 Actually consult the reliability gauntlet
In the auto-publish branch (`parse_worker.py:547-576`) the `ReliabilityReport` is
computed and then **ignored** — approval rides on the model's self-reported score.
Wire the report in as the gate.

### 3.2 Auto-approve only what is provably clean
Cards that are GREEN with no grounding/sanity/consensus findings publish
automatically; AMBER and RED go to a human. This is safe *because* 3.1 makes the
colour meaningful. Note today's self-scores are poorly calibrated (`tuition` averages
0.218), so colour — not self-score — must be the gate.

### 3.3 Fix the three review-UI trust bugs
- Per-section Reject silently rejects **the whole university**, including other
  documents, with one section's reason.
- Edit-then-approve skips the schema validator that already exists
  (`reviewLogic.ts:120`), so malformed JSON can publish.
- Link dismissal is a **silent no-op** for most staff roles — it shows a success
  toast having changed nothing.

**Exit criteria:** open-card count trends down over a week; no reviewer action can
affect data outside the section it names.

---

## Stage 4 — Make silence impossible  ·  ~1 day  ·  prevents recurrence

The 11-day August outage and the 10-day credit outage were both found by a human
noticing odd data. The watchdog *does* detect these — it wrote 50 stale alerts in 30
days — but the alerts stop at a database table and a `log.error`. Nobody is paged.

- **Route `pipeline_watchdog_log` to a human channel.** A `send-telegram` edge
  function is already deployed — use it. No new infrastructure.
- **Freshness deadman:** alert if 0 successful extractions in 6 h, or 0 publishes in
  24 h. Both conditions were true for days during past outages.
- **Write the run journal.** `crawl_runs` is migrated but never written by any code,
  so there is no record of what ran.
- `SENTRY_DSN` is configured but never imported — either wire it or delete it.

**Exit criteria:** a deliberately broken credential produces a message to a human
within one hour.

---

## Stage 5 — Restart discovery  ·  ~2–3 days

Automatic discovery has been dead **50 days** (`crawl_runs`) and **98 days**
(`announcement_sources`). Staff manual uploads are currently the only intake —
123 of the last 260 documents.

- Re-enable the crawl schedule and put the routine's definition **in the repo**; it
  currently exists only in someone's Claude account and cannot be restored or reviewed.
- Fix the domain filters: 2-label domains (`skku.edu`) and non-`.ac.kr` institutions
  are structurally invisible to the search filter.
- Give `blocked_link_hosts` an expiry or cycle column — roughly half the ~43 blocks
  encode 2027-specific reasons that will wrongly suppress 2028 links.
- Re-resolve dead links: **26 % of recorded document URLs** (37 of 122 tested) no
  longer return a document.

**Exit criteria:** discovery freshness < 7 days; recall measured against a sample of
30 known-published guidelines.

---

## Stage 6 — Security  ·  owner-scheduled

**No downtime (do now):**
- Review RPCs must ignore a caller-supplied `reviewer_user_id` unless the caller is
  `service_role`. Confirmed live: all four are `SECURITY DEFINER`, granted to
  `authenticated`, and authorise the **passed** id, so any logged-in user can act as
  any staff member. The UI never passes the parameter, so this fix is safe.
- `REVOKE EXECUTE ... FROM anon` on `fn_split_guideline_document_by_degree`.

**Requires a maintenance window (owner decides when):**
- Rotate the `service_role` key and the database password, then purge both from git
  history. 41 files carry a JWT; 8 embed the password; the master key is valid to 2036
  and reaches all 137 tables, including student documents and messages.
- Lock down `db-exec` (statement allowlist, read-only role, or retire it).
- Add authentication to `compare-universities`, which is currently open and injects
  staff-only `institution_notes` into the model context.

---

## Not recommended

**Do not rebuild around PDF-native extraction.** Measured benefit: **+2.4 points**
(90.5 % vs 88.1 %), with both arms failing on the same ambiguous rows. It is a
reasonable long-term improvement, but doing it first would cost weeks and change
almost nothing. The same applies to the dead `parse/tables.py` layer — worth deleting
or wiring for honesty (three prompts claim its output today), but not a data fix.

---

## Suggested order

| Order | Stage | Why here |
|---|---|---|
| 1 | 1.1 timeout map | One dict entry, recovers ~36 jobs/day |
| 2 | 2.1 verified views | One migration, unblocks every student screen |
| 3 | 6 (no-downtime half) | Live privilege-escalation hole |
| 4 | 4 alerting | Stops the next outage being found by accident |
| 5 | 2.2 / 2.3 publish + dedupe | Before volume grows |
| 6 | 1.2 / 1.3 retries | Recovers the remaining tail |
| 7 | 3 queue drain | Now the binding constraint |
| 8 | 5 discovery | Restores intake |
| 9 | 6 rotation | Owner schedules the window |

Stages 1 and 2 together should be a single day's work and are worth more than
everything below them combined.
