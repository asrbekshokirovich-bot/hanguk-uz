"""Archetype A–H classifier.

Plan §F.1, audit §5.2. Replaces the Phase 0 stub with a real signal-fusion
classifier. Inputs: PDF metadata + filename + announcement title + first-
pages body text. Output: an ArchetypeFingerprint with confidence and a
human-readable rationale.

Confidence threshold: below 0.55 the parse_worker routes the document to
HITL with reason='low_confidence' instead of dispatching to a typed
extractor (plan §F.4 — D4/D5 always-HITL rules apply to the archetype
choice itself when confidence is low).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from .archetype_signals import (
    ArchetypeSignals,
    detect_bilingual_layout,
    estimate_avg_columns,
    estimate_table_density,
    extract_signals,
)

ArchetypeLabel = Literal["A", "B", "C", "D", "E", "F", "G", "H"]
ALL_LABELS: tuple[ArchetypeLabel, ...] = ("A", "B", "C", "D", "E", "F", "G", "H")

# Confidence below this routes to HITL instead of trusting the choice.
CONFIDENCE_HITL_THRESHOLD: float = 0.55


@dataclass(frozen=True, slots=True)
class ArchetypeFingerprint:
    label: ArchetypeLabel
    confidence: float                      # 0.0 .. 1.0
    rationale: str
    signals: ArchetypeSignals
    requires_hitl: bool                    # confidence < threshold


# ---------------------------------------------------------------------------
# Page-count brackets — audit §5.2 fingerprints.
# Each entry: (label, low, high, weight). When the actual page count
# falls inside the bracket the label gets `weight` added to its score.
# ---------------------------------------------------------------------------
# Page-bracket weights are SOFT signals (body anchors dominate). Each
# bracket contributes at most ~0.4 so a single anchor hit (×1.5) outranks
# a generic page-count match.
PAGE_BRACKETS: tuple[tuple[ArchetypeLabel, int, int, float], ...] = (
    ("H", 1, 25, 0.4),    # 전문대 minimal: 8–20 pages
    ("D", 18, 55, 0.3),   # mid-private: 20–50
    ("C", 28, 55, 0.4),   # regional national: 30–50
    ("E", 30, 65, 0.3),   # women's: 35–60
    ("G", 25, 65, 0.3),   # STEM specialized: 30–60
    ("B", 45, 85, 0.4),   # top Seoul private: 50–80
    ("F", 35, 90, 0.3),   # arts/PE: 40–80
    ("A", 75, 130, 0.5),  # SNU flagship: 80–120
)


def classify_archetype(
    first_pages_text: str,
    *,
    page_count: int | None = None,
    table_density: float | None = None,
    avg_columns: float | None = None,
    has_bilingual_layout: bool | None = None,
    filename: str | None = None,
    announcement_title: str | None = None,
) -> ArchetypeFingerprint:
    """Top-level entry point.

    Backwards-compatible with the Phase 0 signature: if only
    `first_pages_text` is supplied, the function falls back to
    body-only signal scoring (the Phase 0 default behaviour, but now
    cleanly factored).
    """
    pc = page_count if page_count is not None else _estimate_page_count(first_pages_text)
    td = table_density if table_density is not None else 0.0
    cols = (
        avg_columns
        if avg_columns is not None
        else estimate_avg_columns([first_pages_text])
    )
    bilingual = (
        has_bilingual_layout
        if has_bilingual_layout is not None
        else detect_bilingual_layout(first_pages_text)
    )

    signals = extract_signals(
        page_count=pc,
        table_density=td,
        avg_columns=cols,
        has_bilingual_layout=bilingual,
        filename=filename,
        announcement_title=announcement_title,
        body_text_first_pages=first_pages_text,
    )
    return _classify_from_signals(signals)


def classify_from_signals(signals: ArchetypeSignals) -> ArchetypeFingerprint:
    """Pure entry point used by tests that synthesise signals directly."""
    return _classify_from_signals(signals)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------


def _classify_from_signals(signals: ArchetypeSignals) -> ArchetypeFingerprint:
    scores: dict[ArchetypeLabel, float] = dict.fromkeys(ALL_LABELS, 0.0)
    rationale_parts: list[str] = []

    # 1. Body anchors — per-label hit count, weighted ×1.5 each.
    for label in ALL_LABELS:
        hits = signals.body_hits.get(label, 0)
        scores[label] += hits * 1.5
        if hits:
            rationale_parts.append(f"{label}:body={hits}")

    # 2. Filename hints — strong (×1.5 each).
    for label in signals.filename_hints:
        scores[label] += 1.5
        rationale_parts.append(f"{label}:fname")

    # 3. Title hints — moderate (×1.2 each).
    for label in signals.title_hints:
        scores[label] += 1.2
        rationale_parts.append(f"{label}:title")

    # 4. Page-count brackets.
    for label, low, high, weight in PAGE_BRACKETS:
        if low <= signals.page_count <= high:
            scores[label] += weight
            rationale_parts.append(f"{label}:pages[{low}-{high}]")

    # 5. Bilingual layout — small boost to A/B; small penalty for G.
    if signals.has_bilingual_layout:
        scores["A"] += 0.4
        scores["B"] += 0.3
        scores["G"] -= 0.2
        rationale_parts.append("bilingual=True")

    # 6. Table density — high density (>2 tables/page) suggests C/B.
    #    Low density (<0.3) suggests D/H. Weights kept small.
    if signals.table_density > 2.0:
        scores["C"] += 0.4
        scores["B"] += 0.2
        rationale_parts.append(f"density={signals.table_density:.2f}>2")
    elif signals.table_density < 0.3:
        scores["D"] += 0.3
        scores["H"] += 0.3
        rationale_parts.append(f"density={signals.table_density:.2f}<0.3")

    # 7. Two-column layout — small boost to A/B brochure-style.
    if signals.avg_columns >= 2.0:
        scores["A"] += 0.2
        scores["B"] += 0.2
        rationale_parts.append("two-column")

    # Pick the winner.
    best_label: ArchetypeLabel = max(ALL_LABELS, key=lambda l: scores[l])
    best_score = scores[best_label]

    # Specific-signal count: did anything *content-specific* fire? Body
    # anchors, filename hints, or title hints all count. Generic signals
    # (page brackets, density, columns) do NOT — those alone are not enough
    # to assert an archetype.
    specific_hits = (
        sum(signals.body_hits.values())
        + len(signals.filename_hints)
        + len(signals.title_hints)
    )

    # Confidence — softmax-ish with floor + ceiling.
    total = sum(max(0.0, s) for s in scores.values())
    raw_share = (best_score / total) if total > 0 else 0.0
    confidence = max(0.0, min(0.97, raw_share * 1.6))

    # Dampen confidence when ONLY generic signals fired so the dispatcher
    # routes ambiguous documents to HITL (plan §F.4).
    if specific_hits == 0:
        confidence *= 0.3
    elif specific_hits == 1:
        confidence *= 0.7

    requires_hitl = confidence < CONFIDENCE_HITL_THRESHOLD
    rationale = (
        f"label={best_label} score={best_score:.2f} share={raw_share:.2f} "
        f"signals=[{', '.join(rationale_parts)}]"
    )
    return ArchetypeFingerprint(
        label=best_label,
        confidence=confidence,
        rationale=rationale,
        signals=signals,
        requires_hitl=requires_hitl,
    )


def _estimate_page_count(text: str) -> int:
    """When the caller didn't pass a page count, estimate from form-feed
    characters (PyMuPDF's get_text('text') uses '\\f' between pages) or
    fall back to a chars/2000 heuristic.
    """
    if "\f" in text:
        return text.count("\f") + 1
    return max(1, len(text) // 2000)


# ---------------------------------------------------------------------------
# Section anchors used by the parse_worker after archetype dispatch.
# Kept here for backwards compatibility with the Phase 0 callers.
# ---------------------------------------------------------------------------
SECTION_ANCHORS: dict[str, re.Pattern[str]] = {
    "calendar": re.compile(
        r"(전형\s*일정|모집\s*일정|주요\s*일정|입학\s*일정|시험\s*일정)"
    ),
    "tuition": re.compile(r"(등록금|학기별\s*등록금|입학금)"),
    "scholarships": re.compile(r"(장학금|장학\s*제도|국가장학금)"),
    "requirements": re.compile(
        r"(지원\s*자격|지원자격|TOPIK|한국어\s*능력)"
    ),
    "documents_required": re.compile(
        r"(제출\s*서류|구비\s*서류|첨부\s*서류|제출\s*해야\s*할\s*서류)"
    ),
    "recruitment_units": re.compile(
        r"(모집\s*단위|모집\s*인원|학과별\s*모집|단과대학별\s*모집)"
    ),
}


def find_section_offsets(text: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for section, pattern in SECTION_ANCHORS.items():
        m = pattern.search(text)
        if m:
            out[section] = m.start()
    return out


# Re-export from signals module so existing imports keep working.
__all__ = [
    "ALL_LABELS",
    "CONFIDENCE_HITL_THRESHOLD",
    "ArchetypeFingerprint",
    "ArchetypeLabel",
    "classify_archetype",
    "classify_from_signals",
    "estimate_table_density",
    "find_section_offsets",
]
