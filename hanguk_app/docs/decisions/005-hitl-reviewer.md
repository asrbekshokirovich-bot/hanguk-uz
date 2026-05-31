# ADR-005 — HITL reviewer #2

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.5, plan §G, plan §K

## Question

Who reviews the AI's extraction output once volume exceeds what one
person can sustain (~30–50 PDFs/week)?

## Decision

**An in-office worker on the consulting company's payroll.** Hired,
trained, and managed directly by Hanguk. Korean reading capability
required (intermediate-or-better, e.g. TOPIK 4+). Estimated 10
hours/week.

## Why this is the best case

- **Trust:** in-office colleagues already understand the company's
  quality bar. No vendor management overhead.
- **Latency:** in-person training gets them productive within days
  rather than the 2–3 weeks needed for a remote freelancer.
- **Cross-training:** the reviewer's domain knowledge of Korean
  admissions becomes useful for counselor-side work (ADR-007), so
  the role doubles.
- **Recruit risk:** zero — the role is filled internally.

## Workflow

1. Reviewer is granted `profiles.role='uni_db_reviewer'` in production.
2. Reviewer logs into Supabase Studio (Phase 1) and works the
   `v_review_queue_dashboard` view daily.
3. When the Phase 2 admin route lands (`/admin/review`), reviewer
   migrates to that.
4. Reviewer's decisions are logged immutably to `review_decisions`
   with field-level diffs (audit log per plan §G.5).

## SLA for the reviewer

Per `v_review_queue_overdue` view (Phase 1):
- P1 (correction notices): 4-hour budget
- P2 (attachment changes): 12 hours
- P3 (D3 fields with diff): 24 hours
- P4–P5: 48–96 hours

If sustained >100 items/week for 4 weeks, hire reviewer #3.
