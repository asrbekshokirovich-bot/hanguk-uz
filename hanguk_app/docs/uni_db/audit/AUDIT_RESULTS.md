# uni_db — Deep-Dive Audit Results

Executed against the plan in `../DEEP_DIVE_AUDIT_PLAN.md`. All eight phases ran.
Production access was strictly read-only (`SELECT`/advisors). No live credential was
used, no data was modified, no pipeline write path was invoked.

Date: 2026-09-01 · Project: `lysjdtyanhdfphqyijsr` (Hanguk 2026)

---

## The headline: the plan's central hypothesis was wrong

The plan assumed the quality gap came from Claude never seeing the PDF — the pipeline
sends text stripped by PyMuPDF instead of the document itself. **A controlled experiment
disproves this.**

12 real guideline PDFs with dated schedule tables were run two ways against
row-preserved ground truth (84 event→date pairs):

| Arm | What Claude received | Dates attached to the correct event |
|---|---|---|
| **A** | the PDF itself | **90.5 %** (76/84) |
| **B** | the pipeline's flattened text | **88.1 %** (74/84) |

The gap is **+2.4 points**, and both arms fail on the *same* rows (한양대 stage tables,
한국외대 면접 전형, 장로회신학 충원/최종등록, 동서울대). Those are genuine document
ambiguities, not text-flattening damage.

**Conclusion: extraction comprehension is ~90 % and is not the bottleneck. Switching to
PDF-native input would buy ~2 points, not the missing 60 %.** The plan's Phase 1
checkpoint question ("PDF-native vs table extraction vs post-processing") is answered:
none of them first.

### Where the loss actually is

Extraction rarely runs to completion, and what completes rarely reaches a student.

| Stage | Measured |
|---|---|
| Extraction jobs failed | **570 of 1,558 (36.6 %)** |
| — Anthropic **credit exhausted** | **208 jobs**, 194 of them `calendar`, ongoing 2026‑06‑06 → **2026‑09‑01** |
| — CLI **timeouts** | **252 jobs** (requirements 83, calendar 73, scholarships 52) |
| `calendar` (deadlines) failure rate | **296 of 544 = 54 %** |
| Approved review items that actually published | **65 of 492** |
| Admission cycles ever reaching `verified` | **0 of 528** |
| Student deadline view `v_user_upcoming_deadlines` | **0 rows** |

The single most valuable field group for students — application deadlines — is also the
one most destroyed by billing failure.

---

## Phase 0 — Safety & secret containment  ⚠ worse than the plan estimated

- **41 files** contain a Supabase JWT; **8 files** embed the production pooler password;
  2 embed a plaintext application password. All are **git-tracked**.
- Decoded claims confirm a **`service_role`** token for the **live** project
  `lysjdtyanhdfphqyijsr`, **valid until 2036-03-06**.
- `db-exec` (arbitrary SQL, service-role privilege) is **deployed and ACTIVE** (v6).
- Blast radius is the whole business, not uni_db: **137 public tables**, 101 profiles,
  620 student documents, 3,455 messages, 389 leads.
- Repo is a **shallow clone** — history purge scope cannot be determined locally.

**Owner actions (not performed here):** rotate the service-role key and the `postgres`
password; purge from full history; re-key or retire `db-exec`.

## Phase 1 — Ground truth
See headline. Corpus: **122 of 137** crawled URLs downloaded. Of those, **only 85 are
still PDFs** — 18 return JavaScript, 14 HTML, 5 HWP. **~26 % of recorded document URLs
no longer serve a document.**

Field-group self-confidence is itself a signal: `tuition` averages **0.218**,
`scholarships` **0.355** — the model reports low confidence and is right to.

## Phase 2 — Coverage & discovery
Funnel (408 institutions): 205 with any guideline → 176 parsed → 91 with a live cycle →
70 requirements → 37 scholarships → **14 with tuition (3.4 %)**.

Feed freshness:

| Feed | Last activity | Days stale |
|---|---|---|
| `crawl_runs` | 2026-07-13 | **50** |
| `announcement_sources.last_polled_at` | 2026-05-26 | **98** |
| `announcements.detected_at` | 2026-05-21 | **103** |
| `adiga_calendar_events` | 2026-05-17 | **107** |
| `guideline_documents.fetched_at` | 2026-09-01 | 0 |

Documents still arrive **because staff upload them**: 123 of 260 are `manual-upload:`,
all since 2026-08-10. Automated crawling has been dead for ~7 weeks. `uni-db-auto-crawl.yml`
carries **no cron** — discovery is delegated to an out-of-repo Claude Routine.

## Phase 3 — Parse & extraction fidelity
- **68.9 % of all guideline pages contain tables** (1,565/2,270); 81 of 85 PDFs are
  majority-table; 84 of 85 have at least one table page.
- `parse/tables.py` and `parse/dates_ko.py` have **no production importer — dead code**,
  yet three prompts tell the model it is receiving their output
  (`_archetype_c_few_shots.md:11`, `tuition.md:45`, `calendar.md:50`). The model is told
  it received stitched tables and normalised dates it never got.
- `uni-db-drain-backlog.yml` is **scheduled but installs no OCR stack** — scanned PDFs
  hard-fail on that lane every run.
- Mock-mode OCR emits `<easyocr stubbed…>` sentinel text that passes the non-empty gate.
- Korean guideline PDFs use **`\x01` as a word separator** — this broke the audit's own
  first scorer and is a standing hazard for any string matching.

## Phase 4 — Verify / HITL / publish integrity
- **0 cycles are `verified`** (485 unverified, 43 superseded). Every verified-gated
  student surface is therefore permanently empty. Confirmed live: `v_user_upcoming_deadlines`
  returns **0 rows**.
- Publish outcomes on 492 approved items: **65 published**, 67 skipped, 36 held,
  **286 with no recorded outcome**.
- **327 `review_decisions` rows have NULL notes** — `fn_review_accept` wipes the
  verifier's findings before the audit trigger copies them.
- Duplicate published rows reaching students: **169** `documents_required` groups,
  **24** `tuition`, **12** `requirements`, **4** `scholarships`.
- Good news: **0 RED-reliability cards were auto-approved.** That risk is latent, not live.

## Phase 5 — Automation reliability
- **50 `alert_claude_routine_stale` in 30 days** — the routine misses its 26 h SLA
  roughly every other run. Plus 28 extraction-failure and 28 sources-overdue alerts.
- No DB-level work claiming (`parse_status='running'` is never written; no
  `FOR UPDATE SKIP LOCKED`), while three schedulers share one subscription.
- `crawl_runs` is never written by code; `SENTRY_DSN` is configured but never imported.
  Alerts terminate at `log.error`. This is the gap that hid the 11-day outage.

## Phase 6 — Student-facing & translation
- Guests see **101 of 408** institutions (24.8 %) via `v_guest_approved_admissions`;
  `v_institutions_for_map` exposes 202.
- Notification leg fully dead: **411 outbox events pending**, **0 push tokens**,
  **0 tracked universities** — nothing has ever been delivered.
- Translations: **927 rows, 0 human-reviewed, 0 with back-translation QC**
  (the QC function is never passed by the worker). **3 rows carry glossary-placeholder
  artifacts**, confirming the mis-described `⟪G:N⟫` token in the live prompt.

## Phase 7 — Security & governance
Live-verified in production:

- **All four review RPCs** (`fn_review_accept`, `_edit_accept`, `_reject`,
  `fn_flag_source_wrong`) are `SECURITY DEFINER`, **granted to `authenticated`**, and
  **accept a caller-supplied `reviewer_user_id`** that overrides `auth.uid()`.
  Any logged-in user who learns a staff UUID can approve, rewrite, or reject queue items
  with the audit log attributing it to that staff member. **Confirmed against the live
  schema, not just migration files.**
- `fn_split_guideline_document_by_degree` is granted to **`anon`**.
- Advisors: **115 lints** — 10 ERROR `security_definer_view`, 37 authenticated- and
  14 **anon-executable** SECURITY DEFINER functions, 22 mutable search paths,
  27 RLS-enabled-no-policy, leaked-password protection off.

---

## Ranked conclusions

1. **Stop the billing/timeout bleed.** 460 of 570 job failures are credit exhaustion or
   timeouts. This is the top cause of missing data and needs no ML work.
2. **Wire the `verified` transition.** One change unblocks every authed student surface,
   including the deadline tracker that returns 0 rows today.
3. **Close the reviewer-impersonation hole** and revoke `anon` execute. Live, exploitable.
4. **Rotate and purge the committed credentials.**
5. **Restart discovery** — dead 50–103 days; only staff uploads are keeping data flowing.
6. **Add natural keys before republishing** — 209 duplicate groups already reach students.
7. **Delete or wire the dead parse modules and fix the three lying prompts.**
8. Do **not** prioritise PDF-native extraction. Measured benefit: +2.4 points.
