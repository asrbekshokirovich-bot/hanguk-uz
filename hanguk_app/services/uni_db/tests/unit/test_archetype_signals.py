"""Audit §5.2 signal extraction."""

import pytest

from uni_db.extract.archetype_signals import (
    detect_bilingual_layout,
    estimate_avg_columns,
    estimate_table_density,
    extract_signals,
)


class TestExtractSignalsBodyHits:
    def test_snu_anchors_register(self) -> None:
        sig = extract_signals(
            page_count=100,
            table_density=1.0,
            avg_columns=2.0,
            has_bilingual_layout=True,
            filename=None,
            announcement_title=None,
            body_text_first_pages="서울대학교 외국인전형 신입학 — 전형별 모집인원",
        )
        assert sig.body_hits["A"] >= 2
        assert sig.body_hits["B"] == 0

    def test_filename_hint_picks_up_kaist(self) -> None:
        sig = extract_signals(
            page_count=40,
            table_density=1.0,
            avg_columns=1.0,
            has_bilingual_layout=False,
            filename="Degree-Program-KAIST-Undergraduate-Spring-2026.pdf",
            announcement_title=None,
            body_text_first_pages="Some body",
        )
        assert "G" in sig.filename_hints

    def test_title_hint_picks_up_jeonmun(self) -> None:
        sig = extract_signals(
            page_count=10,
            table_density=0.5,
            avg_columns=1.0,
            has_bilingual_layout=False,
            filename=None,
            announcement_title="2026 전문대학 외국인전형 안내",
            body_text_first_pages="",
        )
        assert "H" in sig.title_hints


class TestTableDensityEstimator:
    def test_empty_returns_zero(self) -> None:
        assert estimate_table_density([]) == 0.0

    def test_average_across_pages(self) -> None:
        assert estimate_table_density([1, 2, 3, 4]) == pytest.approx(2.5)


class TestAvgColumnsEstimator:
    def test_long_lines_are_single_column(self) -> None:
        page = "x" * 80 + "\n" + "y" * 90
        assert estimate_avg_columns([page]) == 1.0

    def test_short_lines_signal_two_column_layout(self) -> None:
        # Many pages full of short lines (< 35 chars).
        pages = ["short\nbits\nhere\n" * 5] * 4
        assert estimate_avg_columns(pages) == 2.0


class TestBilingualLayoutDetector:
    def test_korean_plus_english_window_is_bilingual(self) -> None:
        text = "서울대학교 외국인전형 모집요강 안내 " + "the quick brown fox jumps over the lazy dog " * 3
        assert detect_bilingual_layout(text) is True

    def test_only_korean_is_not_bilingual(self) -> None:
        text = "서울대학교 외국인전형 모집요강" * 5
        assert detect_bilingual_layout(text) is False

    def test_only_english_is_not_bilingual(self) -> None:
        assert detect_bilingual_layout("Plain English text " * 30) is False
