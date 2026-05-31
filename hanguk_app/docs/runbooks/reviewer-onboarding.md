# In-office reviewer onboarding — uni_db HITL queue

> Audience: the new in-office Hanguk team-mate joining as the second
> human-in-the-loop (HITL) reviewer for the Korean university database.
> Pair this with [`ADR-005`](../decisions/005-hitl-reviewer.md) for the
> rationale, and with [`ADR-007`](../decisions/007-internal-only-no-premium.md)
> for the audience scope.
>
> This guide covers the first two weeks of work. After two weeks the
> reviewer will know the system better than this document does — at
> that point, propose edits.

## 1. What the role exists for

The system crawls Korean university 모집요강 (admission guidelines) PDFs
and HTML notices, runs them through OCR + an LLM extractor, and writes
structured rows (deadlines, tuition, scholarships, document checklists)
into Supabase. **The LLM is wrong often enough that we never let it
write directly to the user-facing tables.** Every extraction lands in a
`review_queue` first. A human (you) confirms, edits, or rejects — then
the row is published.

You are the second line of defence between a hallucinating model and a
contracted Hanguk student making a real application decision. A wrong
deadline can cost a student a year. Take the job seriously.

## 2. Before your first day — what Hanguk admin must set up

| Item | Owner | How |
|---|---|---|
| Supabase auth user with your work email | Hanguk admin | Supabase Studio → Authentication → Add user |
| `profiles.role = 'uni_db_reviewer'` for that user | Hanguk admin | `update public.profiles set role = 'uni_db_reviewer' where user_id = '<your auth.users.id>';` |
| Read access to `docs/runbooks/` (this file) | Hanguk admin | Repo or shared drive |
| Korean-language keyboard or IME on your work laptop | You | OS settings (Korean Microsoft IME on Windows; built-in on macOS) |
| TOPIK 4 (or evidence of equivalent) confirmed | Hanguk admin + you | Skip if already on file |

Until `role='uni_db_reviewer'` is set, the review-queue views return
empty. That's the system working as designed (RLS enforced via
`fn_is_app_user()` plus role check), not a bug.

## 3. The tools you'll use

### 3.1 Phase 2 — Supabase Studio (today)

Until the in-app `/admin/review` route ships in Phase 3, you work
against Supabase Studio directly. URL is on the [credentials run-list](../credentials.md).

The two views you'll live in:

- **`v_review_queue_dashboard`** — everything currently waiting, sorted
  by SLA priority (P1 first). One row per pending review item.
- **`v_review_queue_overdue`** — same, filtered to items that have
  blown their SLA window. Should be empty most days.

You can edit rows from Studio's table editor (right-click → "Edit row")
but for the actual review action use the SQL helpers in §6 below — they
write the audit log atomically.

### 3.2 Phase 3 — the `/admin/review` Flutter route (later)

When Phase 3 ships, the reviewer surface moves from Supabase Studio
into the Hanguk app itself. Side-by-side panels: original PDF page on
the left, extracted JSON form on the right, accept / edit / reject
buttons at the bottom. We'll re-train then; the SQL helpers stay as a
fallback.

### 3.3 Korean-source viewer

PDFs we cached are accessible via 15-minute signed URLs (per
[ADR-009](../decisions/009-pdf-blob-access.md)). The dashboard view
includes a `pdf_signed_url` column — click and you have 15 minutes to
scroll through the source before the link expires. If it expires, just
re-run the dashboard query.

## 4. The decision flow — accept, edit, reject

Every queue item has three actions:

| Action | When | What happens in the database |
|---|---|---|
| **Accept** | The extracted JSON matches the source PDF exactly | Row promotes from `review_queue` to its target table (`recruitment_units`, `tuition_rates`, etc.). `review_decisions` gets an `action='accepted'` row. |
| **Edit** | Most fields are right but one or two need correcting | You write the corrected JSON. The corrected row promotes. `review_decisions` records the field-level diff. |
| **Reject** | The extraction is unusable (wrong document, wrong year, archetype misclassified, hallucinated table) | Row drops out of the queue. `review_decisions` records `action='rejected'` with your reason. The discovery worker re-queues the source for re-extraction at the next crawl. |

**`review_decisions` is append-only** (per plan §G.5). You can't edit
or delete a past decision. If you accept then realise you were wrong,
file a correction notice in the queue itself — that triggers a P1
re-review, which is the right path because it preserves the audit
trail.

## 5. SLA targets (per ADR-005)

| Priority | What it means | Budget |
|---|---|---|
| **P1** | Correction notice (정정공고) detected on a tracked university | 4 hours |
| **P2** | Attachment changed since last verified version | 12 hours |
| **P3** | Difficulty-3 field (e.g. document checklist) with a diff | 24 hours |
| **P4** | Difficulty-2 field (e.g. tuition refresh, no diff) | 48 hours |
| **P5** | Difficulty-1 (e.g. address normalisation) | 96 hours |

If the queue overflows your weekly hours (~10 h/week budget), flag
that to Hanguk admin — sustained > 100 items/week for 4 weeks triggers
hiring reviewer #3.

## 6. SQL helpers — the actual review actions

These are saved snippets in Supabase Studio's SQL editor under
"uni_db review actions" (Hanguk admin will save them once; you reuse
them).

```sql
-- ACCEPT a queue item exactly as extracted
select fn_review_accept(
  queue_item_id => '<uuid from v_review_queue_dashboard>',
  reviewer_user_id => auth.uid()
);

-- EDIT then accept — pass the corrected JSON
select fn_review_edit_accept(
  queue_item_id => '<uuid>',
  corrected_payload => '{...}'::jsonb,
  reviewer_user_id => auth.uid()
);

-- REJECT with a reason code
select fn_review_reject(
  queue_item_id => '<uuid>',
  reason => 'wrong_year',           -- one of: wrong_year, wrong_archetype,
                                     -- hallucinated_field, ocr_garbled,
                                     -- source_404, other
  reason_detail => 'PDF is 2025-cycle; we want 2026',
  reviewer_user_id => auth.uid()
);
```

Don't bypass these helpers and edit the target table directly. Doing
so skips the audit log and silently breaks the round-robin assignment
trigger.

## 7. What to look for — the things the model gets wrong

After reading hundreds of Korean admission PDFs, these are the failure
modes that come up repeatedly. Spend a few minutes on each.

### 7.1 Cycle confusion

A 모집요강 PDF rarely has the academic year stamped on every page. The
LLM sometimes pulls dates from a header that says "2025학년도" and labels
them as 2026 cycle. Always confirm the cycle by looking at the PDF's
title page or the source URL slug — they'll have `2026` or `26학년도`.

If the year doesn't match the queue item's `admission_cycle_id`,
**reject** with `wrong_year`.

### 7.2 Applicant category drift

Korean admissions distinguish:

- 외국인 전형 (foreign applicants — most Hanguk students)
- 재외국민 전형 (overseas Koreans)
- 정시 / 수시 (regular / early — for domestic Korean applicants)

The crawler tags by `applicant_category`. When the LLM pulls a 수시
deadline into a 외국인 row, the row has been classified wrong. **Reject**
with `wrong_archetype`.

### 7.3 TOPIK tier tables

Scholarships often look like:

```
TOPIK 6급 → 등록금 100% 면제
TOPIK 5급 → 등록금 70% 면제
TOPIK 4급 → 등록금 50% 면제
```

The extractor produces a JSON list of `{topik_level, discount_percent}`.
Common errors: discount swapped between rows; `면제` (waiver) confused
with `장학금` (cash scholarship); percent-of-tuition confused with
percent-of-total-cost. Always cross-check at least two of the rows
against the original table.

### 7.4 정정공고 (correction notices)

These are addenda posted after the original 모집요강. They override
specific fields. The LLM does NOT automatically merge them — instead
they show up as a P1 review item with the old → new diff. Your job is
to confirm the diff matches the correction notice text, then accept.

**Never** edit the original 모집요강 row to merge a correction. The
correction lives as its own row with `supersedes_id` pointing at the
original. The view layer handles the rest.

### 7.5 Document checklist routing

Per [audit §4.7](../../UNIVERSITY_DB_AUDIT.md), document requirements
depend on the applicant's country of origin. The extractor produces a
matrix `{country_code: required_documents[]}`. For Hanguk's primary
cohorts (Uzbekistan, Vietnam, China, Mongolia, Kazakhstan), confirm
that:

- Uzbekistan rows correctly indicate apostille (not consular) for
  schools that accept apostille
- China rows correctly indicate CHESICC (academic verification)
- The `_blocked_countries` field is present for schools that don't
  accept apostille — those students can't apply

If a school's checklist is missing your country, **reject** with
`hallucinated_field` and `reason_detail` describing which country.

### 7.6 Numbers in Korean

Korean admission docs use mixed numerals: 백만 (1,000,000) vs 1,000,000.
We have a parser that handles compound numbers (백만, 천만, 억) but it
gets fooled by formatting like `1억 2천만원`. Eyeball every tuition
amount over 10,000,000 KRW.

## 8. When to escalate back to engineering

Slack channel `#uni-db-hitl` (or Hanguk admin will tell you the actual
channel name). File a message when:

- Same archetype rejected 3+ times this week with the same reason
  (probably a prompt regression — engineering needs to update the
  archetype calibration)
- The dashboard shows zero rows for a known-active university (probably
  a crawler regression)
- A signed-URL link expires before opening (might be a clock skew bug)
- Anything with the `pdf_access_log` audit table (tampering is unusual
  enough that we should look)

For everything else, just work the queue.

## 9. Weekly cadence

| Day | Action | Time |
|---|---|---|
| Mon | Open `v_review_queue_overdue` first; clear P1/P2 | ~2 h |
| Tue–Thu | Work the dashboard; accept/edit/reject as items arrive | ~2 h/day |
| Fri | Quick audit pass on the week's `review_decisions` rows you wrote — sanity-check the diffs | ~30 min |
| Fri | Weekly throughput report to Hanguk admin (item count, time-to-decision per priority) | 15 min |

Average week is 8–10 hours. If you're consistently over 12 hours,
that's the trigger to flag for reviewer #3.

## 10. Cross-training — the second hat

Per [ADR-005](../decisions/005-hitl-reviewer.md) the reviewer role
doubles into counselor-side work over time. As you read more
admission PDFs you'll naturally build expertise on what each university
actually requires. Hanguk's counselor team will start asking you
questions ("does Yonsei still require apostille for Uzbek HS
diplomas?"); you'll know.

That's by design. The role grows.

## 11. What's still being built (so you know what's coming)

- **Phase 3** ([`PHASE_3_DESIGN.md`](../../services/uni_db/PHASE_3_DESIGN.md))
  brings the in-app `/admin/review` route, push notifications when
  tracked-university items hit the queue, and the English translation
  pipeline (you'll start seeing `_en` fields next to the Korean
  originals).
- **Uzbek translation** is gated on a native-Uzbek-speaker reviewer
  joining (per [ADR-004](../decisions/004-uzbek-translation-timing.md)).
  Until then the app shows Korean original + English; Uzbek-speaking
  students rely on the counselor (you, eventually) to verbally
  translate prose.

## 12. First-week checklist for you

- [ ] Day 1 — log into Supabase Studio, confirm you can see at least
      one row in `v_review_queue_dashboard`. If empty, talk to admin
      (the role probably isn't set).
- [ ] Day 1 — read [`ADR-005`](../decisions/005-hitl-reviewer.md) end
      to end. It's short.
- [ ] Day 2 — shadow Hanguk's existing reviewer (or admin) on five
      queue items. Watch them accept / edit / reject.
- [ ] Day 3 — work five items yourself with the existing reviewer
      watching.
- [ ] Day 4 — work the queue solo. Check in at end of day.
- [ ] Day 5 — file your first weekly throughput report. Format is in
      §9.

After week one you're independent.

---

**Appendix — useful queries for the curious**

```sql
-- Your decisions this week
select target_table, action, reviewed_at, reason
from review_decisions
where reviewer_user_id = auth.uid()
  and reviewed_at >= now() - interval '7 days'
order by reviewed_at desc;

-- Overall queue health (Hanguk admin will run this)
select priority,
       count(*) filter (where status = 'pending') as pending,
       count(*) filter (where status = 'pending'
                          and queued_at < now() - sla_window) as overdue
from review_queue
group by priority
order by priority;

-- Universities with the most pending items
select i.name_ko_short, count(*) as pending
from review_queue rq
join recruitment_units ru on ru.id = rq.target_id
join institutions i on i.id = ru.institution_id
where rq.status = 'pending'
group by 1
order by 2 desc
limit 10;
```
