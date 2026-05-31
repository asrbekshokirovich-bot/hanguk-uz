"""Korean date parser — coverage of the formats catalogued in audit §4.2."""

from uni_db.parse.dates_ko import (
    parse_korean_date,
    parse_korean_date_range,
)


class TestSimpleFormats:
    def test_dotted_with_dow(self) -> None:
        out = parse_korean_date("2026.09.30(화) 17:00")
        assert out is not None
        assert out.iso8601 == "2026-09-30T17:00:00+09:00"
        assert out.is_tentative is False

    def test_year_month_day_korean(self) -> None:
        out = parse_korean_date("2026년 3월 15일")
        assert out is not None
        assert out.iso8601.startswith("2026-03-15T00:00:00")

    def test_dashed(self) -> None:
        out = parse_korean_date("2026-03-15 17:00:00")
        assert out is not None
        assert out.iso8601 == "2026-03-15T17:00:00+09:00"

    def test_slash(self) -> None:
        out = parse_korean_date("2026/03/15")
        assert out is not None
        assert out.iso8601.startswith("2026-03-15")

    def test_year_inferred_from_default(self) -> None:
        out = parse_korean_date("03.15(수)", default_year=2027)
        assert out is not None
        assert out.iso8601.startswith("2027-03-15")


class TestAmPm:
    def test_ohu_5_si_is_17(self) -> None:
        out = parse_korean_date("2026년 9월 30일 오후 5시")
        assert out is not None
        assert out.iso8601 == "2026-09-30T17:00:00+09:00"

    def test_ojeon_12_si_is_midnight(self) -> None:
        out = parse_korean_date("2026년 9월 30일 오전 12시")
        assert out is not None
        assert out.iso8601 == "2026-09-30T00:00:00+09:00"


class TestTentativeMarker:
    def test_kkaji_marker_is_not_tentative(self) -> None:
        # 까지 = "until" — the deadline itself is firm.
        out = parse_korean_date("2026.09.30(화) 17:00까지")
        assert out is not None
        assert out.is_tentative is False

    def test_yejeong_marker_is_tentative(self) -> None:
        out = parse_korean_date("2026.10.20(월) 발표 예정")
        assert out is not None
        assert out.is_tentative is True


class TestRange:
    def test_range_with_tilde(self) -> None:
        start, end = parse_korean_date_range(
            "2026.09.01(월) 09:00 ~ 09.30(화) 17:00"
        )
        assert start is not None and end is not None
        assert start.iso8601 == "2026-09-01T09:00:00+09:00"
        assert end.iso8601 == "2026-09-30T17:00:00+09:00"

    def test_range_with_em_dash(self) -> None:
        start, end = parse_korean_date_range("2026-09-01 — 2026-09-30")
        assert start is not None and end is not None
        assert start.iso8601.startswith("2026-09-01")
        assert end.iso8601.startswith("2026-09-30")

    def test_single_date_without_range_separator(self) -> None:
        start, end = parse_korean_date_range("2026.10.20(월)")
        assert start is not None
        assert end is None


class TestNoMatch:
    def test_returns_none_for_garbage(self) -> None:
        assert parse_korean_date("hello world") is None

    def test_empty_string(self) -> None:
        assert parse_korean_date("") is None

    def test_year_missing_and_no_default(self) -> None:
        assert parse_korean_date("03.15") is None
