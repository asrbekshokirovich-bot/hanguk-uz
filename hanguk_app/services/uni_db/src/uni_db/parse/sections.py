"""Section detectors.

Phase 1 ships a tuition-section detector that pairs the heading with the
table immediately below it and tags each row with a faculty_group from
audit §4.4. Other section detectors (calendar, requirements,
documents_required) reuse the SECTION_ANCHORS regex map from
`extract.archetype`.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable, Literal

log = logging.getLogger(__name__)


FacultyGroup = Literal[
    "humanities",
    "social",
    "natural_science",
    "engineering",
    "arts_pe",
    "medicine",
    "dentistry",
    "veterinary",
    "pharmacy",
    "theology",
    "interdisciplinary",
]


# Audit §4.4 keyword → canonical faculty_group mapping.
FACULTY_GROUP_TOKENS: dict[FacultyGroup, tuple[str, ...]] = {
    "humanities":      ("인문", "Humanities", "Liberal Arts"),
    "social":          ("사회", "상경", "경영", "Social"),
    "natural_science": ("자연", "Natural Sciences", "이학"),
    "engineering":     ("공학", "공과", "Engineering", "IT"),
    "arts_pe":         ("예체능", "예술", "체육", "음악", "미술", "Arts", "PE"),
    "medicine":        ("의학", "의과", "Medicine"),
    "dentistry":       ("치의학", "치과", "Dentistry"),
    "veterinary":      ("수의학", "수의", "Veterinary"),
    "pharmacy":        ("약학", "약대", "Pharmacy"),
    "theology":        ("신학", "Theology", "신과대학"),
    "interdisciplinary": ("자유전공", "융합", "Interdisciplinary", "글로벌인재"),
}


@dataclass(frozen=True, slots=True)
class TuitionRow:
    faculty_group: FacultyGroup
    semester_number: int
    amount_krw: int
    is_first_semester: bool
    source_text_ko: str


@dataclass(frozen=True, slots=True)
class TuitionSection:
    rows: list[TuitionRow]
    found_heading: str | None


_TUITION_HEADING_RE = re.compile(r"(등록금|학기별\s*등록금|입학금)")


def classify_faculty_group(label_ko: str) -> FacultyGroup | None:
    """Map a free-form label like '인문계열' or '공과대학' to a canonical group."""
    if not label_ko:
        return None
    for group, tokens in FACULTY_GROUP_TOKENS.items():
        if any(t in label_ko for t in tokens):
            return group
    return None


def detect_tuition_section(
    text: str,
    *,
    tables_after_heading: Iterable[list[list[str]]] | None = None,
    academic_year: int,
    default_first_semester: bool = True,
) -> TuitionSection:
    """Detect a tuition section in the supplied text.

    The caller is responsible for slicing `text` to the candidate window
    (starting at the offset returned by `find_section_offsets`). When the
    table extractor has already produced rows, pass them via
    `tables_after_heading` so this function can normalise them; otherwise
    we fall back to inline-line parsing.
    """
    if not text:
        return TuitionSection(rows=[], found_heading=None)

    heading_match = _TUITION_HEADING_RE.search(text)
    found_heading = heading_match.group(1) if heading_match else None

    rows: list[TuitionRow] = []

    if tables_after_heading is not None:
        for table in tables_after_heading:
            rows.extend(_rows_from_table(table, academic_year, default_first_semester))
    else:
        rows.extend(_rows_from_inline_lines(text, academic_year, default_first_semester))

    return TuitionSection(rows=rows, found_heading=found_heading)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _rows_from_table(
    table: list[list[str]],
    academic_year: int,
    default_first_semester: bool,
) -> list[TuitionRow]:
    from .numbers_ko import parse_korean_amount

    if not table:
        return []
    out: list[TuitionRow] = []
    # Detect header row position. We accept any of:
    #   ['계열', '1학기', '2학기']
    #   ['단과대학', '학기', '등록금']
    header_idx = 0
    if len(table) > 1 and any(_looks_like_header_token(c) for c in table[0]):
        header_idx = 1
    for row in table[header_idx:]:
        if not row:
            continue
        label = row[0]
        group = classify_faculty_group(label)
        if group is None:
            continue
        for col_idx, cell in enumerate(row[1:], start=1):
            amount = parse_korean_amount(cell)
            if amount is None:
                continue
            semester = col_idx
            out.append(
                TuitionRow(
                    faculty_group=group,
                    semester_number=semester,
                    amount_krw=amount.amount_krw,
                    is_first_semester=(semester == 1) and default_first_semester,
                    source_text_ko=" | ".join(row),
                )
            )
    return out


def _rows_from_inline_lines(
    text: str,
    academic_year: int,
    default_first_semester: bool,
) -> list[TuitionRow]:
    """Inline form: '인문계열 1학기 등록금: 4,800,000원'."""
    from .numbers_ko import parse_korean_amount

    out: list[TuitionRow] = []
    line_re = re.compile(
        r"(?P<label>[가-힣A-Za-z·\s]+?)\s*(?P<sem>\d+)학기\s*등록금[:\s]*"
        r"(?P<amount>[\d,]+(?:\s*(?:만|억|천|백))?\s*원?)"
    )
    for m in line_re.finditer(text):
        group = classify_faculty_group(m.group("label"))
        if group is None:
            continue
        amount = parse_korean_amount(m.group("amount"))
        if amount is None:
            continue
        sem = int(m.group("sem"))
        out.append(
            TuitionRow(
                faculty_group=group,
                semester_number=sem,
                amount_krw=amount.amount_krw,
                is_first_semester=(sem == 1) and default_first_semester,
                source_text_ko=m.group(0).strip(),
            )
        )
    return out


def _looks_like_header_token(cell: str) -> bool:
    return any(
        t in cell
        for t in ("계열", "단과", "학과", "구분", "학기", "등록금", "amount", "semester")
    )
