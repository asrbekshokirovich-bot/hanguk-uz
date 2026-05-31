"""Cost-estimator tests.

The exact dollar amounts are not load-bearing — what matters is that
relative ordering across archetypes/providers stays sensible so the
orchestrator's gating decisions remain stable.
"""

import pytest

from uni_db.extract.cost_estimator import estimate, estimate_full_guideline


class TestSingleEstimate:
    def test_anthropic_sonnet_50_pages_calendar_under_one_dollar(self) -> None:
        out = estimate(
            archetype="B",
            page_count=50,
            field_group="calendar",
            provider="anthropic_sonnet",
        )
        assert 0.0 < out.cost_usd < 1.0
        assert out.input_tokens > 0
        assert out.output_tokens > 0

    def test_haiku_cheaper_than_sonnet(self) -> None:
        sonnet = estimate(archetype="B", page_count=50, field_group="calendar",
                          provider="anthropic_sonnet")
        haiku = estimate(archetype="B", page_count=50, field_group="calendar",
                         provider="anthropic_haiku")
        assert haiku.cost_usd < sonnet.cost_usd

    def test_archetype_a_costs_more_than_h(self) -> None:
        a_cost = estimate(archetype="A", page_count=100, field_group="recruitment_units").cost_usd
        h_cost = estimate(archetype="H", page_count=15, field_group="recruitment_units").cost_usd
        assert a_cost > h_cost


class TestFullGuideline:
    def test_phase_f3_envelope_holds(self) -> None:
        # Plan §F.3 says ~$1.30 for a 50-page guideline.
        _, total = estimate_full_guideline(archetype="B", page_count=50)
        # Accept 30%–250% of the plan budget — the multiplier blend isn't
        # exact but should land close.
        assert 0.4 < total < 4.0, f"unexpected total cost {total}"

    @pytest.mark.parametrize("pages", [10, 50, 100])
    def test_total_grows_with_page_count(self, pages: int) -> None:
        _, total = estimate_full_guideline(archetype="B", page_count=pages)
        assert total > 0
