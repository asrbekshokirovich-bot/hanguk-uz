# ADR-010 — Data residency

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.10, audit §10.4

## Question

Confirm production data residency in Korea
(Supabase region `ap-northeast-2`, Seoul)?

## Decision

**Confirmed.** All production data lives in Seoul.

| Resource | Region |
|---|---|
| Supabase production (Hanguk 2026) | `ap-northeast-2` (Seoul) ✓ |
| Supabase staging (hanguk-staging) | `ap-northeast-2` (Seoul) ✓ |
| Naver Cloud OCR (when re-enabled per ADR-002) | KR cloud regions |
| Hetzner VPS (per ADR-003) | EU — out-of-region but only the *crawler* runs there; no user data stored |
| Cloudflare R2 / Supabase Storage | Storage is colocated with Supabase |

## Why Seoul

- **PIPA compliance** (audit §10.4) — Korea's Personal Information
  Protection Act has strict cross-border transfer rules; in-country
  storage sidesteps most of them
- Lowest latency to Korean upstreams (admission boards, MOE okep,
  Adiga, NIIED)
- Aligns with Naver Cloud OCR if/when it's re-enabled per ADR-002

## App store privacy disclosure

The Hanguk Flutter app's privacy policy must list:
- Supabase (Seoul) — auth + database
- Anthropic (US) — AI extraction (text-only, no PII)
- DeepL (EU) — translation (text-only, no PII)
- Sentry (US/EU) — error monitoring

Anthropic / DeepL / Sentry receive **anonymised** data only (PDF
text, error stacks). No student PII is sent to them.
