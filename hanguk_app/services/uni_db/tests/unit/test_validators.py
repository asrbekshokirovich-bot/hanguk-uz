"""Plan §F.4 — auto-publish gates per difficulty."""

from uni_db.extract.validators import evaluate


class TestDifficulty1And2:
    def test_d1_high_confidence_auto_publishes(self) -> None:
        out = evaluate(field_name="application_open_at", confidence=0.91)
        assert out.auto_publish is True
        assert out.requires_hitl is False

    def test_d1_low_confidence_routes_to_hitl(self) -> None:
        out = evaluate(field_name="application_open_at", confidence=0.70)
        assert out.requires_hitl is True


class TestDifficulty3:
    def test_d3_high_confidence_no_diff_auto_publishes(self) -> None:
        out = evaluate(
            field_name="topik_required_level",
            confidence=0.93,
            has_prior_version=False,
        )
        assert out.auto_publish is True

    def test_d3_diverged_from_prior_routes_to_hitl(self) -> None:
        out = evaluate(
            field_name="topik_required_level",
            confidence=0.95,
            has_prior_version=True,
            fields_disagree_with_prior=True,
        )
        assert out.requires_hitl is True


class TestDifficulty4Plus:
    def test_d4_always_hitl(self) -> None:
        out = evaluate(field_name="scholarships", confidence=0.99)
        assert out.requires_hitl is True

    def test_d5_always_hitl(self) -> None:
        out = evaluate(field_name="correction_notice_url", confidence=0.99)
        assert out.requires_hitl is True


class TestUnknownField:
    def test_unknown_defaults_to_d3_treatment(self) -> None:
        out = evaluate(field_name="something_new", confidence=0.91)
        # D3 with no prior → auto-publish
        assert out.auto_publish is True
