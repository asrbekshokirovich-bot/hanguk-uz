"""Phase 3 verification: the target-cycle date window (stale_cycle hard flag)
and the shared canonical event-type table both lanes import."""

from __future__ import annotations

from uni_db.extract.event_types import (
    CALENDAR_EVENT_ORDER,
    EVENT_TO_PERIOD_FIELD,
    canonical_event_type,
)
from uni_db.verify.checks import _CAL_ORDER, sanity_checks
from uni_db.verify.engine import aggregate


def _issues(payload: dict, *, year: int | None = 2027, term: str | None = "spring"):
    return sanity_checks("calendar", payload, target_year=year, target_term=term)


class TestCycleWindow:
    def test_date_outside_window_is_stale_cycle_high(self) -> None:
        # 2027 spring window is 2026-08-01 .. 2027-06-30 (the plan's example).
        payload = {"events": [
            {"event_type": "apply_open", "starts_at": "2025-09-01T09:00:00+09:00"},
        ]}
        issues = _issues(payload)
        assert [(i.problem, i.severity) for i in issues] == [("stale_cycle", "high")]

    def test_date_inside_window_is_clean(self) -> None:
        payload = {"events": [
            {"event_type": "apply_open", "starts_at": "2026-09-01T09:00:00+09:00"},
            {"event_type": "final_results", "starts_at": "2026-12-20T09:00:00+09:00"},
        ]}
        assert _issues(payload) == []

    def test_window_edges_are_inclusive(self) -> None:
        payload = {"events": [
            {"event_type": "apply_open", "starts_at": "2026-08-01"},
            {"event_type": "other", "starts_at": "2027-06-30"},
        ]}
        assert _issues(payload) == []
        assert _issues({"events": [{"event_type": "other", "starts_at": "2027-07-01"}]}) != []

    def test_period_dates_are_checked_too(self) -> None:
        payload = {"events": [], "periods": [
            {"application_start": "2025-09-01", "application_end": "2025-09-30"},
        ]}
        issues = _issues(payload)
        assert len(issues) == 2
        assert all(i.problem == "stale_cycle" and i.severity == "high" for i in issues)

    def test_no_target_year_skips_the_check(self) -> None:
        payload = {"events": [{"event_type": "apply_open", "starts_at": "2020-01-01"}]}
        assert _issues(payload, year=None, term=None) == []

    def test_stale_cycle_flags_hard_red(self) -> None:
        payload = {"events": [{"event_type": "apply_open", "starts_at": "2025-09-01"}]}
        report = aggregate(field_group="calendar", sanity_issues=_issues(payload))
        assert report.overall == "red"


class TestSharedEventTypeTable:
    def test_both_lanes_read_the_same_order_table(self) -> None:
        # verify/checks orders on the canonical table — not its own copy.
        assert list(CALENDAR_EVENT_ORDER) == _CAL_ORDER
        assert "documents_deadline" in _CAL_ORDER
        assert "document_submission_deadline" not in _CAL_ORDER

    def test_synonyms_canonicalize_consistently(self) -> None:
        assert canonical_event_type("document_submission_deadline") == "documents_deadline"
        assert canonical_event_type("result_announcement") == "final_results"
        assert canonical_event_type("apply_open") == "apply_open"
        assert canonical_event_type(None) is None

    def test_apply_close_maps_to_application_end(self) -> None:
        assert EVENT_TO_PERIOD_FIELD["apply_close"] == "application_end"
        assert EVENT_TO_PERIOD_FIELD["documents_deadline"] == "document_deadline"

    def test_ordering_check_now_sees_canonical_documents_deadline(self) -> None:
        # Regression: normalize emits the canonical `documents_deadline`, which
        # the old checks-lane copy (`document_submission_deadline`) never
        # matched — this out-of-order pair was silently passing.
        payload = {"events": [
            {"event_type": "apply_close", "starts_at": "2026-10-05"},
            {"event_type": "documents_deadline", "starts_at": "2026-10-01"},
        ]}
        issues = _issues(payload)
        assert any(i.problem == "out_of_order_dates" for i in issues)

    def test_ordering_check_canonicalizes_legacy_synonyms(self) -> None:
        payload = {"events": [
            {"event_type": "apply_close", "starts_at": "2026-10-05"},
            {"event_type": "document_submission_deadline", "starts_at": "2026-10-01"},
        ]}
        issues = _issues(payload)
        assert any(i.problem == "out_of_order_dates" for i in issues)

    def test_ordering_check_is_scoped_per_round(self) -> None:
        # 2차's apply_open legitimately falls after 1차's final_results — that
        # is two separate rounds, not one out-of-order round. Comparing
        # across rounds (the old event_type-only keying) would have raised a
        # false out_of_order_dates here.
        payload = {"events": [
            {"event_type": "apply_open", "starts_at": "2026-09-01", "round_label": "1차"},
            {"event_type": "apply_close", "starts_at": "2026-09-15", "round_label": "1차"},
            {"event_type": "final_results", "starts_at": "2026-09-25", "round_label": "1차"},
            {"event_type": "apply_open", "starts_at": "2026-10-05", "round_label": "2차"},
            {"event_type": "apply_close", "starts_at": "2026-10-19", "round_label": "2차"},
        ]}
        issues = _issues(payload)
        assert not any(i.problem == "out_of_order_dates" for i in issues)

    def test_ordering_check_still_catches_a_real_defect_within_one_round(self) -> None:
        payload = {"events": [
            {"event_type": "apply_open", "starts_at": "2026-09-15", "round_label": "1차"},
            {"event_type": "apply_close", "starts_at": "2026-09-01", "round_label": "1차"},
        ]}
        issues = _issues(payload)
        assert any(i.problem == "out_of_order_dates" for i in issues)
