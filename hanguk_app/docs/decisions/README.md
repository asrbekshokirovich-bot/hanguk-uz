# Architecture Decision Records (ADRs)

This directory holds the answers to the open questions in
[`UNIVERSITY_DB_BUILD_PLAN.md` §O](../../UNIVERSITY_DB_BUILD_PLAN.md).
Each `0NN-name.md` records one decision with:

- the question that needed answering
- the chosen option and any constraints
- the alternatives considered and why they lost
- the date and the cost / scope implications

ADRs are append-only. If a decision changes, write a new ADR that
supersedes the old one (link both ways) — never edit the old record.
This keeps the project's reasoning history intact for future agents,
new hires, and your own future self.

## Index

| ADR | Question | Decision | Date |
|---|---|---|---|
| [001](001-budget-ceiling.md) | Budget ceiling | Accept $300/mo steady, $960/mo burst | 2026-05-07 |
| [002](002-ocr-vendor.md) | OCR vendor | EasyOCR (open-source) | 2026-05-07 |
| [003](003-worker-placement.md) | Crawler runtime | Hetzner VPS | 2026-05-07 |
| [004](004-uzbek-translation-timing.md) | Uzbek translation | Phase 3, with native reviewer | 2026-05-07 |
| [005](005-hitl-reviewer.md) | HITL reviewer #2 | In-office worker | 2026-05-07 |
| [006](006-is-partner-flag.md) | `is_partner` semantics | Keep as separate CRM flag | 2026-05-07 |
| [007](007-internal-only-no-premium.md) | Premium tier / scope | Internal-only for contracted students | 2026-05-07 |
| [008](008-counselor-mode.md) | Counselor mode | Skip / defer | 2026-05-07 |
| [009](009-pdf-blob-access.md) | PDF blob access | Signed URLs to authenticated app users | 2026-05-07 |
| [010](010-data-residency.md) | Data residency | Seoul (`ap-northeast-2`) confirmed | 2026-05-07 |
