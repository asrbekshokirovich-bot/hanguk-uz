# ADR-001 — Budget ceiling

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.1, plan §J cost projection

## Question

Are we OK with the system spending **~$300/month** average, with bursts up
to **~$960/month** during the Sep–Dec Korean admissions high season?

## Decision

**Accepted both numbers as ceilings.** We do NOT cap LLM concurrency to
flatten the burst — fast time-to-publish on 정정공고 (correction notices)
is the system's most user-visible promise, and capping concurrency would
add 12–48h latency to those during the season they matter most.

## Reframing for the internal-tool pivot (see ADR-007)

Plan §J's $300/mo figure was sized for a public service tracking 5,000+
user-tracked institutions. For Hanguk's internal use (contracted students
only, ~50–200 active applications), realistic burn is **~$30–80/month**
even at full functionality. The §J ceiling stays as the upper bound we
authorise but is unlikely to be hit in practice.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Cap LLM concurrency at N/min | Adds latency during the only weeks the system's value is most acute |
| Pre-pay annual Anthropic credits | We don't yet know v1 volume well enough to commit |
| Drop AI entirely, use OSS only | Quality cliff (see ADR-002) |

## Implications

- Anthropic key configured with a billing alert at $200/mo
- High-season alert at $400/mo
- Hard cap at $1000/mo via Anthropic console
