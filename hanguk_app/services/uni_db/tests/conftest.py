"""Shared pytest fixtures.

Phase 0 tests run entirely against fixtures — no live HTTP, no live LLM,
no live OCR. The harness asserts that as a hard invariant before any
adapter constructs.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

# Force the test environment to keep every paid integration off, even if
# someone has populated their local .env.
os.environ.setdefault("UNI_DB_LIVE_APIS", "false")
os.environ.setdefault("UNI_DB_LIVE_CRAWL", "false")


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


@pytest.fixture
def snu_list_fixture(fixtures_dir: Path) -> Path:
    return fixtures_dir / "snu_list.html"


@pytest.fixture
def rss_fixture(fixtures_dir: Path) -> Path:
    return fixtures_dir / "sample_rss.xml"


@pytest.fixture
def naver_search_fixture(fixtures_dir: Path) -> Path:
    return fixtures_dir / "sample_naver_search.json"


# ---------------------------------------------------------------------------
# Tiny ASCII PDF fixture
#
# We don't ship a real `.ac.kr` PDF (per the user's guard) and we can't
# render Korean glyphs in PyMuPDF's bundled fonts without bundling a CJK
# font. Instead we generate two artifacts at test time:
#
#   * a minimal ASCII PDF — exercises PyMuPDF wrapper end-to-end
#   * a Korean-text payload that the parse worker can ingest directly
#     (bypassing the PDF binary, since extraction is independently
#     tested elsewhere)
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_pdf_path(tmp_path: Path) -> Path:
    """Generate a minimal valid PDF with PyMuPDF.

    Skips the test if PyMuPDF isn't installed (so `pytest -k` runs in a
    bare environment still work).
    """
    pymupdf = pytest.importorskip("pymupdf")
    out = tmp_path / "sample.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(
        (50, 100),
        "HANGUK UNI DB — Phase 0 sample\n"
        "fixture for tests; replaced with real archetype "
        "anchors during Phase 1.",
        fontsize=12,
    )
    doc.save(str(out))
    doc.close()
    return out


@pytest.fixture
def korean_guideline_text() -> str:
    """Standalone Korean text payload that mimics a top-private 모집요강.

    Used by parse_worker tests to hit archetype + section detection
    without depending on PDF-glyph rendering.
    """
    return (
        "연세대학교 2026학년도 외국인전형 모집요강\n"
        "\n"
        "전형 일정\n"
        "원서접수: 2026.09.01(월) 09:00 ~ 09.30(화) 17:00\n"
        "1단계 합격자 발표: 2026.10.20(월)\n"
        "면접: 2026.11.01(토)\n"
        "최종 합격자 발표: 2026.12.13(금)\n"
        "\n"
        "지원 자격\n"
        "TOPIK 4급 이상. 졸업 전 취득 가능.\n"
        "\n"
        "등록금\n"
        "인문계열 1학기 등록금: 4,800,000원 (입학금 포함)\n"
        "\n"
        "장학금\n"
        "성적우수 장학금 — 등록금 50% 감면 (TOPIK 5급 이상)\n"
        "\n"
        "제출 서류\n"
        "성적증명서, 졸업증명서, 여권사본\n"
    )
