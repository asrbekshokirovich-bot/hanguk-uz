"""Unit tests for the combined-PDF degree splitter."""

from uni_db.parse.degree_sections import DegreeSegment, is_combined, split_by_degree


class TestSplitByDegree:
    def test_combined_splits_into_two_ordered_segments(self) -> None:
        text = (
            "외국인 학부 신입학 전형 안내. 학사과정 모집단위 표...\n"
            "===\n"
            "대학원 외국인 석사 박사 과정 모집. 지도교수 사전 컨택..."
        )
        segs = split_by_degree(text)
        assert [s.level for s in segs] == ["undergraduate", "graduate"]
        # boundary: undergraduate segment must not contain the grad header
        assert "대학원" not in segs[0].text
        assert "대학원" in segs[1].text

    def test_graduate_before_undergraduate_order_preserved(self) -> None:
        text = (
            "대학원 석사과정 외국인전형 안내...\n"
            "그리고 학부 신입학 전형도 함께 안내합니다..."
        )
        segs = split_by_degree(text)
        assert [s.level for s in segs] == ["graduate", "undergraduate"]

    def test_undergraduate_only_single_segment(self) -> None:
        text = "외국인 학부 신입학 전형. 학사과정 모집단위..."
        segs = split_by_degree(text)
        assert len(segs) == 1
        assert segs[0].level == "undergraduate"
        assert segs[0].text == text

    def test_graduate_only_single_segment(self) -> None:
        text = "일반대학원 외국인 석사과정 모집. 박사과정 포함..."
        segs = split_by_degree(text)
        assert len(segs) == 1
        assert segs[0].level == "graduate"

    def test_no_headers_defaults_to_undergraduate(self) -> None:
        text = "환영합니다. 지원 안내 일반 정보입니다."
        segs = split_by_degree(text)
        assert len(segs) == 1
        assert segs[0].level == "undergraduate"

    def test_is_combined_true_and_false(self) -> None:
        combined = "학부 신입학 ... 대학원 석사과정 ..."
        assert is_combined(combined) is True
        ug_only = "외국인 학부 신입학 전형 안내"
        assert is_combined(ug_only) is False

    def test_segment_is_dataclass(self) -> None:
        segs = split_by_degree("외국인 학부 신입학 전형")
        assert isinstance(segs[0], DegreeSegment)
        assert segs[0].start_offset >= 0
