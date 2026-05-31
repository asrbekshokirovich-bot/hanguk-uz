"""Cost estimator.

Plan §F.3 says ~$1.30 per 50-page guideline at Sonnet pricing. This
module turns that into a per-archetype prediction so the orchestrator
can decide:

  * if the predicted cost > settings.max_cost_per_doc, route the doc to
    HITL with reason='high_difficulty_field' and skip the LLM call;
  * during high season (audit §6.7), pre-compute the day's projected
    spend.

Token accounting is approximate — the real Sonnet tokenizer is private
— but the relative numbers are what we use to gate behaviour.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ProviderName = Literal["anthropic_sonnet", "anthropic_haiku", "deepl", "papago"]


@dataclass(frozen=True, slots=True)
class CostEstimate:
    provider: ProviderName
    input_tokens: int
    output_tokens: int
    cost_usd: float
    notes: str


# USD per 1M tokens. Source: plan §F.3 (Anthropic April 2026 pricing) +
# DeepL/Papago published character rates converted to "tokens" at
# ~4 chars/token for English / Korean equivalence.
PRICING: dict[ProviderName, tuple[float, float]] = {
    # provider:  (input $/M, output $/M)
    "anthropic_sonnet": (3.00, 15.00),
    "anthropic_haiku":  (0.80,  4.00),
    "deepl":            (6.25,  6.25),     # $25/M chars * 4 chars/token / 1
    "papago":           (5.00,  5.00),     # $20/M chars * 4 chars/token / 1
}


# Approximate per-page token volume per archetype, derived from audit §5.2:
#   A: 80–120 page voluminous bilingual         → ~700 in / 200 out tokens/page
#   B: 50–80 page glossy brochure-style          → ~600 / 160
#   C: 30–50 page plain table                    → ~520 / 200
#   D: 20–50 page faith / mid-private narrative  → ~480 / 140
#   E: 35–60 page women's univ                   → ~520 / 160
#   F: 40–80 page art/PE                         → ~560 / 160
#   G: 30–60 page STEM specialized               → ~500 / 150
#   H: 8–20 page 전문대                          → ~360 / 100
PER_PAGE_TOKENS: dict[str, tuple[int, int]] = {
    "A": (700, 200),
    "B": (600, 160),
    "C": (520, 200),
    "D": (480, 140),
    "E": (520, 160),
    "F": (560, 160),
    "G": (500, 150),
    "H": (360, 100),
}

# Field-group multiplier — calendar is single-pass, scholarships needs
# multiple passes for rule-rich tables, etc.
FIELD_GROUP_MULTIPLIER: dict[str, float] = {
    "calendar":           0.6,
    "tuition":            0.5,
    "basic_requirements": 0.7,
    "recruitment_units":  1.0,
    "document_checklist": 0.7,
    "scholarships":       1.2,
}


def estimate(
    *,
    archetype: str,
    page_count: int,
    field_group: str,
    provider: ProviderName = "anthropic_sonnet",
) -> CostEstimate:
    in_per_page, out_per_page = PER_PAGE_TOKENS.get(archetype, (500, 150))
    mult = FIELD_GROUP_MULTIPLIER.get(field_group, 1.0)
    input_tokens = int(page_count * in_per_page * mult)
    output_tokens = int(page_count * out_per_page * mult)
    in_rate, out_rate = PRICING[provider]
    cost = (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000
    return CostEstimate(
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=round(cost, 4),
        notes=f"archetype={archetype} pages={page_count} group={field_group} mult={mult}",
    )


def estimate_full_guideline(
    *,
    archetype: str,
    page_count: int,
    field_groups: tuple[str, ...] = (
        "calendar",
        "tuition",
        "basic_requirements",
        "recruitment_units",
        "document_checklist",
        "scholarships",
    ),
    provider: ProviderName = "anthropic_sonnet",
) -> tuple[list[CostEstimate], float]:
    estimates = [
        estimate(
            archetype=archetype,
            page_count=page_count,
            field_group=g,
            provider=provider,
        )
        for g in field_groups
    ]
    total = sum(e.cost_usd for e in estimates)
    return estimates, round(total, 4)
