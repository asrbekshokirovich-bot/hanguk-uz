# ADR-006 — `is_partner` flag semantics

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.6, audit §0.4.3

## Question

The current `universities.is_partner` column means "Hanguk has a
business partnership with this university" (CRM concept). The new
`recruitment_units` and admission data are factual and don't depend on
partnership. Should we keep them as separate concepts?

## Decision

**Keep them separate.** `institutions.is_partner` (which inherits
from the legacy `universities.is_partner`) remains a CRM flag for
counselor-side filtering ("show me only universities I have a deal
with"). The recruitment / cycle / requirements data is partnership-
agnostic and serves all institutions equally.

## Why

- Partnership status is volatile (deals come and go); recruitment data
  is stable (changes once per cycle).
- Conflating them would force every CRM mutation to also touch the
  uni_db, and every uni_db read to filter by partnership — a clean
  separation of concerns is structurally simpler.
- The `v_institutions_for_map` view exposes both fields side-by-side,
  so the UI can filter on one or the other depending on context.

## Implementation note

The Phase 1 migrations already preserve `is_partner` on `institutions`.
No code change needed; this ADR documents the intent.
