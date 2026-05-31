# ADR-008 — Counselor mode

- **Status:** Skipped / deferred
- **Date:** 2026-05-07
- **Context:** plan §O.8, plan §I-Phase-5+

## Question

For Phase 5+, counselor mode (per-seat B2B vs revshare with applicant
referrals)?

## Decision

**Skip / defer.** Per ADR-007 (internal-only), Hanguk staff ARE the
counselors. There is no separate B2B "counselor" persona to monetise
yet. The decision is revisited only if the system is opened to
non-Hanguk counselors (which would re-open ADR-007).

## Implementation impact

- No counselor billing infrastructure built
- No counselor-seat UI work
- No revshare attribution tracking
- The Phase 1 `profiles.role='counselor'` enum value REMAINS in the
  baseline migration — it costs nothing to keep and it's already used
  by the existing CRM workflow.
