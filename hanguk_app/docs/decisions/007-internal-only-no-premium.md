# ADR-007 — Internal-only deployment, no premium tier (yet)

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.7, supersedes plan §A v3 vision

## Question

Plan §A described a public consumer product with a $4.99/mo premium
tier (break-even at ~95 paying users). What's the actual deployment
model?

## Decision

**The Hanguk uni_db is an internal tool for our consulting company's
contracted students.** Only students who have signed a contract with
Hanguk for South Korea application support can use it. No public
discoverability, no marketing, no premium tier billing.

Monetization decisions are deferred until external user demand is
validated.

## What this changes

### User base

- Bounded: ~50–200 active student applications at any time
- Known: every user has a contract with Hanguk
- Trusted: counselors can verify the student's identity offline
- Korean-language: ~all students are Uzbek-speaking, learning Korean

### Cost profile

- Plan §J's $300/mo steady-state was sized for 5,000 tracked institutions
  across thousands of public users
- Internal use realistically lands at **~$30–80/mo** even at full
  functionality
- Most §J line items can stay on free tiers (DeepL, Papago, Sentry,
  Cloudflare R2 → Supabase Storage instead) for the foreseeable future

### Roadmap deferrals

| Plan section | Status now |
|---|---|
| Plan §I-Phase-4 (public REST API for partners) | **Deferred indefinitely** |
| Plan §I-Phase-5 (counselor mode, premium tier) | **Deferred** — see ADR-008 |
| Plan §K (counselor partnership / customer success FTE) | **Deferred** |
| Plan §J unit-economics math | **Suspended** (no revenue path yet) |

### Things that get more important

- **Counselor workflow**: you and your in-office team are simultaneously
  the operators AND the counselors using the system. The CRM-side UX
  matters as much as the student-side UX.
- **Per-student application tracker**: the Applications tab is the heart
  of the product, not a side feature.
- **Document-checklist accuracy** with Uzbek-specific apostille routing:
  audit §4.7 lists `consular_legalization: true` for Uzbek students;
  getting this right is non-optional.
- **Uzbek translation quality** (ADR-004): the entire user cohort
  reads it.

## Reversal trigger

If at any point Hanguk decides to open the system to non-contracted
users, ADR-007 is superseded by a new ADR that introduces:
- Public registration flow
- Premium tier billing (Stripe / Paddle integration)
- Public REST API
- Counselor mode (ADR-008)

Until then: contracted-students-only.

## RLS implications

The Phase 0/1 RLS policies already enforce per-user data scoping via
`auth.uid()`. No additional gating is needed for internal-only mode —
the existing Hanguk auth flow (magic-code login for contracted
students) is the access boundary.
