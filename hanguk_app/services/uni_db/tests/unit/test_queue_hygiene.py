"""Layer 1 queue-hygiene helpers: empty / failed extraction detection."""

from uni_db.workers.parse_worker import (
    _extend_to_boundary,
    _is_empty_output,
    _is_failed_output,
    _looks_truncated,
    _slice_for,
)


class TestIsFailedOutput:
    def test_failed_marker(self) -> None:
        assert _is_failed_output({"_extraction_failed": "AnthropicResponseError"}) is True

    def test_normal_output_not_failed(self) -> None:
        assert _is_failed_output({"rows": [{"a": 1}]}) is False

    def test_non_dict(self) -> None:
        assert _is_failed_output("nope") is False


class TestIsEmptyOutput:
    def test_empty_rows(self) -> None:
        assert _is_empty_output({"rows": []}) is True

    def test_empty_events(self) -> None:
        assert _is_empty_output({"events": []}) is True

    def test_empty_dict(self) -> None:
        assert _is_empty_output({}) is True

    def test_populated_rows(self) -> None:
        assert _is_empty_output({"rows": [{"name_ko": "x"}]}) is False

    def test_populated_events(self) -> None:
        assert _is_empty_output({"events": [{"event_type": "apply_open"}]}) is False

    def test_failed_is_not_empty(self) -> None:
        # A failed extraction is "failed", not "empty" — they're routed differently.
        assert _is_empty_output({"_extraction_failed": "boom"}) is False

    def test_only_empty_lists_and_blank_strings(self) -> None:
        assert _is_empty_output({"rows": [], "notes": "", "meta": {}}) is True

    def test_scalar_value_counts_as_content(self) -> None:
        assert _is_empty_output({"count": 3}) is False

    def test_bool_only_is_empty(self) -> None:
        # Booleans alone (e.g. flags) don't count as reviewable content.
        assert _is_empty_output({"is_required": False, "rows": []}) is True


class TestBoundaryAwareSlicing:
    def test_extends_to_next_whitespace(self) -> None:
        # A cut at length 10 lands mid-word ("Proficien|cy"); extend to the
        # next space rather than clipping the token.
        text = "English Proficiency Test scores required"
        out = _extend_to_boundary(text, 0, 10)
        assert out == "English Proficiency"

    def test_returns_remainder_when_past_end(self) -> None:
        text = "short text"
        assert _extend_to_boundary(text, 0, 999) == text

    def test_slice_for_uses_offset(self) -> None:
        text = "AAAA SECTION body of the section here BBBB"
        offsets = {"requirements": text.index("SECTION")}
        out = _slice_for(text, "requirements", offsets, length=7)
        assert out.startswith("SECTION")

    def test_slice_for_fallback_when_group_missing(self) -> None:
        text = "x" * 20000
        out = _slice_for(text, "tuition", {})
        assert len(out) <= 8000 + 600


class TestLooksTruncated:
    def test_dangling_single_letter(self) -> None:
        assert _looks_truncated({"rows": [{"source_text_ko": "English Proficiency T"}]}) is True

    def test_complete_korean_clause(self) -> None:
        assert _looks_truncated({"rows": [{"source_text_ko": "모든 서류를 제출"}]}) is False

    def test_trailing_number_not_truncated(self) -> None:
        assert _looks_truncated({"rows": [{"source_text_ko": "TOEFL iBT 80"}]}) is False

    def test_checks_events_too(self) -> None:
        assert _looks_truncated({"events": [{"source_text_ko": "원서접수 시작 A"}]}) is True

    def test_non_dict_safe(self) -> None:
        assert _looks_truncated("nope") is False

    def test_empty_rows_safe(self) -> None:
        assert _looks_truncated({"rows": []}) is False
