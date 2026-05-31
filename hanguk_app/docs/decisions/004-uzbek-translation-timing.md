# ADR-004 — Uzbek translation timing

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.4, plan §P.3, plan §I-Phase-3

## Question

The plan ships English translation in Phase 2 (week 4–6) and Uzbek in
Phase 3 (week 7–9). Should we accelerate Uzbek to Phase 2?

## Decision

**Keep Uzbek at Phase 3.** No first-party ko→uz translation provider
exists; the only path is ko→en→uz pivot through Claude. Two-hop
translation loses nuance, and shipping broken Uzbek prose to the
primary user cohort (ADR-007: contracted Uzbek-speaking students) would
destroy trust faster than waiting three weeks.

Phase 3 explicitly couples the Uzbek translation rollout with **a
native Uzbek-speaker reviewer in the HITL queue** (ADR-005). That's
non-negotiable for Uzbek prose quality.

## Phase 2 user experience for Uzbek-speaking users

- All structured fields (dates, tuition amounts, quotas) are localised
  via client-side `intl` formatters — no translation needed for
  numbers / dates.
- Prose fields (scholarship narratives, requirement descriptions) show
  the **Korean original** with the "View English translation" toggle.
- The "View original (한국어)" toggle (plan §P.4) is the safety valve —
  Uzbek-speaking users get exact source text plus English translation,
  which is enough for a counselor (ADR-007) to verbally explain.

## Reversal trigger

If during Phase 2 the in-office reviewer (ADR-005) demonstrates fluent
Korean→Uzbek capability AND the translation pipeline's back-translation
QC distance lands consistently below 0.3, accelerate Uzbek to Phase 2.5.
