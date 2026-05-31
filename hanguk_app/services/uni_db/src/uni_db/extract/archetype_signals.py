"""Multi-signal feature extraction for archetype classification.

Audit §5.2 fingerprints:

  A — SNU flagship (80–120 pages, deep applicant-category sections,
       cross-referenced tuition booklet, bilingual columns side-by-side).
  B — Top Seoul private brochure-style (50–80 pages, glossy first 5–8
       pages, recruitment units organized by 단과대학).
  C — Regional national plain table (30–50 pages, B&W, very long
       department lists, embedded tuition).
  D — Faith-affiliated / mid-private (20–50 pages, mission-statement
       page early, narrative prose more frequent).
  E — Women's university (35–60 pages, gender requirement explicit,
       front-matter scholarship emphasis).
  F — Specialized art/music/PE (40–80 pages, 실기고사 dominant,
       discipline-specific calendar).
  G — STEM specialized (30–60 pages, English-first/only, qualitative
       quotas like 약간명/소수정원, custom application portal).
  H — 전문대 minimal (8–20 pages, plain layout, single calendar).

The classifier reads these signals and returns a confidence-scored label.
Below the confidence threshold the dispatcher routes to HITL instead of
guessing — see plan §F.4.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ArchetypeSignals:
    """Numeric features extracted from a guideline document.

    All fields are computed by `extract_signals()` from independent
    inputs so unit tests can supply them directly without standing up
    a full PDF pipeline.
    """

    page_count: int
    table_density: float                        # avg tables per page
    avg_columns: float                          # 1.0 single, 2.0 two-col
    has_bilingual_layout: bool                  # ko/en side-by-side detected
    filename_hints: tuple[str, ...]
    title_hints: tuple[str, ...]
    body_hits: dict[str, int]                   # archetype label -> hit count


# ---------------------------------------------------------------------------
# Body anchor vocabulary used by extract_body_hits().
# Each archetype's anchors are picked so they fire ONLY for that archetype.
# Order matters: more-specific anchors first.
# ---------------------------------------------------------------------------
BODY_ANCHORS: dict[str, tuple[str, ...]] = {
    "A": (
        "서울대학교", "Seoul National University",
        "KAIST", "POSTECH",
        "외국인전형 신입학", "외국인전형 편입학", "전형별 모집인원",
    ),
    "B": (
        "연세대학교", "고려대학교", "성균관대학교", "한양대학교",
        "단과대학", "글로벌인재학부", "Brand Identity",
    ),
    "C": (
        "거점국립대", "부산대학교", "경북대학교", "전남대학교",
        "충남대학교", "전북대학교", "강원대학교", "제주대학교",
        "정원외", "정원내",
    ),
    "D": (
        "서강대학교", "동국대학교", "원광대학교", "선교", "사명",
        "총장 추천", "신앙",
    ),
    "E": (
        "이화여자대학교", "숙명여자대학교", "여자대학교",
        "여학생만", "여학생 지원자만",
    ),
    "F": (
        "실기고사", "실기 일정", "음악", "미술", "체육",
        "audition", "Audition", "K-Arts",
    ),
    "G": (
        "UNIST", "GIST", "DGIST", "약간명", "소수정원",
        "english-medium", "univapply", "interapply",
    ),
    "H": (
        "전문대학", "전문대", "2년제", "3년제", "산업체",
    ),
}


# ---------------------------------------------------------------------------
# Filename pattern hints (audit §6.4).
# These are the file-name conventions Korean admissions offices use when
# uploading PDFs to their boards. Examples:
#   2026Spring_under.pdf       → SNU intl undergrad spring (archetype A)
#   2026sy_eu_susiguide_*.pdf  → Eulji susi (archetype D-ish)
#   foreign_2026.pdf           → generic foreign track
# ---------------------------------------------------------------------------
FILENAME_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "A": (re.compile(r"(?i)(snu|seoul[-_ ]national|spring_under|fall_under)"),),
    "B": (re.compile(r"(?i)(yonsei|korea[_-]?univ|skku|hanyang|sogang|cau|khu)"),),
    "C": (re.compile(r"(?i)(pnu|knu|jnu|cnu|jbnu|kangwon|jeju|inu)"),),
    "D": (re.compile(r"(?i)(dongguk|wonkwang|sungkyul|sogang_jaeoe|catholic)"),),
    "E": (re.compile(r"(?i)(ewha|sookmyung|sungshin|duksung|seoul[_-]women)"),),
    "F": (re.compile(r"(?i)(k[_-]?arts|knua|chugye|sport|knsu|실기)"),),
    "G": (re.compile(r"(?i)(kaist|postech|unist|gist|dgist|kentech)"),),
    "H": (re.compile(r"(?i)(jeonmun|2년제|inha[_-]?tech|yeungjin|sangji)"),),
}


# Title hints — same idea but on announcement titles, not filenames.
TITLE_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "F": (re.compile(r"(실기|예체능|미술|음악|체육|audition)", re.IGNORECASE),),
    "G": (re.compile(r"(약간명|소수정원|english[ -]?medium)", re.IGNORECASE),),
    "H": (re.compile(r"(전문대|전문대학|2년제|3년제)", re.IGNORECASE),),
}


def extract_signals(
    *,
    page_count: int,
    table_density: float,
    avg_columns: float,
    has_bilingual_layout: bool,
    filename: str | None,
    announcement_title: str | None,
    body_text_first_pages: str,
) -> ArchetypeSignals:
    """Build the feature vector. Pure / no IO."""
    body_hits: dict[str, int] = {}
    for label, anchors in BODY_ANCHORS.items():
        body_hits[label] = sum(1 for a in anchors if a in body_text_first_pages)

    fname_hits: list[str] = []
    if filename:
        for label, patterns in FILENAME_PATTERNS.items():
            for pat in patterns:
                if pat.search(filename):
                    fname_hits.append(label)
                    break

    title_hits: list[str] = []
    if announcement_title:
        for label, patterns in TITLE_PATTERNS.items():
            for pat in patterns:
                if pat.search(announcement_title):
                    title_hits.append(label)
                    break

    return ArchetypeSignals(
        page_count=page_count,
        table_density=table_density,
        avg_columns=avg_columns,
        has_bilingual_layout=has_bilingual_layout,
        filename_hints=tuple(fname_hits),
        title_hints=tuple(title_hits),
        body_hits=body_hits,
    )


# ---------------------------------------------------------------------------
# Heuristic structure features pulled out of the PDF parser layer.
#
# These helpers live here so the classifier doesn't reach into pdfplumber/
# PyMuPDF directly — keeps the classifier deterministic in tests where we
# inject signals as plain dataclasses.
# ---------------------------------------------------------------------------


def estimate_table_density(tables_per_page: list[int]) -> float:
    if not tables_per_page:
        return 0.0
    return sum(tables_per_page) / len(tables_per_page)


def estimate_avg_columns(text_per_page: list[str]) -> float:
    """Heuristic — a page with two clearly-separated half-width text blocks
    suggests a two-column layout. We approximate by counting pages whose
    mean line length is < 35 chars (fragments) vs >= 60 chars (full lines).
    """
    if not text_per_page:
        return 1.0
    short_pages = 0
    for txt in text_per_page:
        lines = [ln for ln in txt.splitlines() if ln.strip()]
        if not lines:
            continue
        mean_len = sum(len(ln) for ln in lines) / len(lines)
        if mean_len < 35:
            short_pages += 1
    return 2.0 if short_pages > len(text_per_page) * 0.5 else 1.0


def detect_bilingual_layout(text_first_pages: str) -> bool:
    """Detect ko/en side-by-side. Crude but works for archetype A/B PDFs:
    look for both Korean characters AND >50 ASCII letters within the same
    400-char window.

    Falls back to scanning the whole text in one pass when shorter than
    a single window — otherwise short bilingual fixtures slip through.
    """
    window_size = 400
    if len(text_first_pages) <= window_size:
        chunks: list[str] = [text_first_pages]
    else:
        chunks = [
            text_first_pages[i : i + window_size]
            for i in range(0, len(text_first_pages) - window_size + 1, 200)
        ]
    for chunk in chunks:
        has_korean = any("가" <= ch <= "힣" for ch in chunk)
        ascii_letters = sum(1 for ch in chunk if "a" <= ch.lower() <= "z")
        if has_korean and ascii_letters > 50:
            return True
    return False
