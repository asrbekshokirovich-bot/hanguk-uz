"""Tuition-section detector tests."""

from uni_db.parse.sections import (
    classify_faculty_group,
    detect_tuition_section,
)


class TestFacultyGroupClassifier:
    def test_humanities(self) -> None:
        assert classify_faculty_group("인문계열") == "humanities"

    def test_engineering(self) -> None:
        assert classify_faculty_group("공과대학") == "engineering"

    def test_arts_pe(self) -> None:
        assert classify_faculty_group("예체능계열") == "arts_pe"

    def test_natural_science(self) -> None:
        assert classify_faculty_group("자연과학대학") == "natural_science"

    def test_unknown_returns_none(self) -> None:
        assert classify_faculty_group("이상한 라벨") is None


class TestDetectTuitionSectionInline:
    def test_extracts_inline_lines(self) -> None:
        text = (
            "등록금\n"
            "인문계열 1학기 등록금: 4,800,000원\n"
            "인문계열 2학기 등록금: 4,560,000원\n"
            "공학계열 1학기 등록금: 6,220,000원\n"
        )
        sec = detect_tuition_section(text, academic_year=2026)
        assert sec.found_heading == "등록금"
        assert len(sec.rows) == 3
        assert sec.rows[0].faculty_group == "humanities"
        assert sec.rows[0].semester_number == 1
        assert sec.rows[0].amount_krw == 4_800_000
        assert sec.rows[2].faculty_group == "engineering"

    def test_first_semester_flag(self) -> None:
        text = "등록금\n인문계열 1학기 등록금: 4,800,000원\n"
        sec = detect_tuition_section(text, academic_year=2026)
        assert sec.rows[0].is_first_semester is True

    def test_returns_empty_when_no_heading(self) -> None:
        sec = detect_tuition_section("plain text", academic_year=2026)
        assert sec.found_heading is None
        assert sec.rows == []


class TestDetectTuitionSectionTable:
    def test_table_with_faculty_label_in_column_zero(self) -> None:
        table = [
            ["계열", "1학기", "2학기"],
            ["인문계열", "4,800,000", "4,560,000"],
            ["공학계열", "6,220,000", "6,000,000"],
        ]
        sec = detect_tuition_section(
            "등록금",
            tables_after_heading=[table],
            academic_year=2026,
        )
        assert len(sec.rows) == 4
        amounts = sorted(r.amount_krw for r in sec.rows)
        assert amounts == [4_560_000, 4_800_000, 6_000_000, 6_220_000]
