"""Deterministic admission-cycle detection from guideline text.

One shared implementation for every place that needs "which cycle does this
document actually describe": the guideline finder's stale-cycle gate, the
`backfill_document_cycle.py` script that classifies the already-stored blobs,
and the verify lane's cycle-window sanity check.

Pure / no IO. Korean 학년도 semantics: 전기/1학기/3월 입학 is the SPRING (March)
intake of that 학년도; 후기/2학기/9월 입학 is the FALL (September) intake.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import date

# 4-digit year immediately before 학년도 (allowing whitespace).
_YEAR_KO_RE = re.compile(r"(20[2-3][0-9])\s*학년도")
# English "2027 Spring" / "Fall 2026" style (either order).
_YEAR_EN_RE = re.compile(
    r"(?:(20[2-3][0-9])\s*[.\-/, ]?\s*(Fall|Autumn|Spring)"
    r"|(Fall|Autumn|Spring)\s*[.\-/, ]?\s*(20[2-3][0-9]))",
    re.IGNORECASE,
)

_SPRING_MARKERS = ("전기", "1학기", "3월 입학", "3월입학")
_FALL_MARKERS = ("후기", "2학기", "9월 입학", "9월입학")
_SPRING_EN_RE = re.compile(r"\bSpring\b", re.IGNORECASE)
_FALL_EN_RE = re.compile(r"\b(Fall|Autumn)\b", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class DetectedCycle:
    academic_year: int | None
    #: 'spring' | 'fall' | None (both markers present, or none at all)
    semester: str | None
    #: True when both spring and fall markers appear (a full-year guideline).
    covers_both_terms: bool


def detect_cycle(text: str) -> DetectedCycle:
    """Classify the admission cycle a guideline text describes.

    Year = the most frequent 학년도 year (English "2027 Spring" forms count
    too); on a tie the LATER year wins (guidelines quote the previous cycle
    for context more often than the next one). Term = spring/fall markers;
    both present → covers_both_terms (semester None).
    """
    years: Counter[int] = Counter(int(y) for y in _YEAR_KO_RE.findall(text))
    for m in _YEAR_EN_RE.finditer(text):
        y = m.group(1) or m.group(4)
        if y:
            years[int(y)] += 1

    year: int | None = None
    if years:
        top = max(years.values())
        year = max(y for y, c in years.items() if c == top)

    spring = sum(text.count(t) for t in _SPRING_MARKERS) + len(_SPRING_EN_RE.findall(text))
    fall = sum(text.count(t) for t in _FALL_MARKERS) + len(_FALL_EN_RE.findall(text))

    if spring and fall:
        return DetectedCycle(academic_year=year, semester=None, covers_both_terms=True)
    if spring:
        return DetectedCycle(academic_year=year, semester="spring", covers_both_terms=False)
    if fall:
        return DetectedCycle(academic_year=year, semester="fall", covers_both_terms=False)
    return DetectedCycle(academic_year=year, semester=None, covers_both_terms=False)


_TERM_ORDER = {"spring": 0, "fall": 1}


def cycle_is_older(
    doc_year: int | None,
    doc_term: str | None,
    *,
    target_year: int,
    target_term: str | None,
) -> bool:
    """True when a document's cycle is strictly OLDER than the crawl target —
    i.e. its data can never describe the target intake. Unknown year is never
    "older" (it is handled as unknown, not stale)."""
    if doc_year is None:
        return False
    if doc_year < target_year:
        return True
    if doc_year > target_year:
        return False
    if doc_term in _TERM_ORDER and target_term in _TERM_ORDER:
        return _TERM_ORDER[doc_term] < _TERM_ORDER[target_term]
    return False


def cycle_window(target_year: int, target_term: str | None) -> tuple[date, date]:
    """The calendar window every schedule date of the TARGET cycle must fall in.

    Spring (March) intake of 학년도 Y: applications open around August of Y-1
    and everything (results, registration, orientation) completes by end of
    June Y — e.g. 2027 Spring → 2026-08-01 .. 2027-06-30. Fall (September)
    intake of Y runs inside calendar year Y. Unknown term → the union.
    """
    if target_term == "spring":
        return date(target_year - 1, 8, 1), date(target_year, 6, 30)
    if target_term == "fall":
        return date(target_year, 1, 1), date(target_year, 12, 31)
    return date(target_year - 1, 8, 1), date(target_year, 12, 31)
