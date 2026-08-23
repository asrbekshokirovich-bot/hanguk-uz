"""Degree-level classifier for admission guidelines.

A guideline PDF can be for undergraduate (학부 신입학), graduate master's
(석사), doctoral (박사), the integrated master+doctoral track (석박사통합),
an associate degree at a junior college (전문학사), or a SINGLE combined PDF
that covers both undergraduate and graduate admission.

The rest of the extraction pipeline (archetypes, prompts, few-shots) is
tuned for undergraduate foreign-freshman guidelines, so we must recognise
which degree level a document targets and tag it — and flag combined PDFs
so they are split into separate admission cycles instead of being parsed as
one undergraduate document.

This module is pure (no IO) and signal-based, mirroring `archetype_signals`.
It maps its verdict onto the DB's `admission_cycles.cycle_track` and
`programs.degree_level` vocabularies so downstream code can set them directly.

Korean markers are intentionally specific:
  - "대학원", "일반대학원", "석사", "박사", "석박사통합" → graduate
  - "학부 신입학", "학사과정", "신입학" (without 대학원) → undergraduate
  - "전문학사", "전문대학", "2년제", "3년제" → associate (junior college)

Note: bare "학부" is NOT a reliable undergraduate marker — it is also the
suffix of recruitment units (경영학부, 글로벌인재학부). Only the stronger
phrases above count.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DegreeLevel = Literal[
    "undergraduate", "master", "doctoral", "integrated", "associate", "unknown"
]

# Maps the verdict onto admission_cycles.cycle_track (foreign-cohort tracks).
CYCLE_TRACK_UNDERGRAD_FOREIGN = "foreign"
CYCLE_TRACK_GRAD_FOREIGN = "grad_foreign"

CONFIDENCE_HITL_THRESHOLD: float = 0.55


@dataclass(frozen=True, slots=True)
class DegreeClassification:
    primary_level: DegreeLevel
    # programs.degree_level values present in the document.
    degree_levels: tuple[str, ...]
    # Suggested admission_cycles.cycle_track for the foreign cohort.
    cycle_track: str
    has_undergraduate: bool
    has_graduate: bool
    is_combined: bool
    confidence: float
    rationale: str
    # True only when the document names a specific graduate PROGRAMME
    # (석사 / 박사 / 석박사통합), as opposed to merely containing the word
    # 대학원 somewhere. `has_graduate` is satisfied by the latter, which is
    # why it must not be the sole basis for telling a reviewer that a
    # document mixes two admission levels: "대학원 진학 시" in an
    # undergraduate footnote sets it, and that is a sentence about the
    # future, not a graduate admission section.
    has_explicit_graduate_program: bool = False

    @property
    def requires_split(self) -> bool:
        return self.is_combined


# --- marker vocabularies -----------------------------------------------------
_GRAD_GENERAL = ("대학원", "일반대학원", "전문대학원", "graduate school", "graduate admission")
_MASTER = ("석사", "석사과정", "master's", "master degree", "master program")
_DOCTORAL = ("박사", "박사과정", "doctoral", "ph.d", "phd")
_INTEGRATED = ("석박사통합", "석·박사통합", "석박사 통합", "석·박사 통합", "통합과정", "integrated master")
_UNDERGRAD = (
    "학부 신입학", "학부신입학", "학사과정", "학사학위", "외국인 학부",
    "대학(학부)", "신입학모집", "undergraduate", "bachelor",
)
_ASSOCIATE = ("전문학사", "전문대학", "전문대", "2년제", "3년제", "associate degree")

# "신입학" alone leans undergraduate, but only when no graduate marker is present.
_UNDERGRAD_WEAK = ("신입학", "수시모집", "정시모집")


# Substrings that look like a degree marker but are the tail of an ordinary
# noun. Korean writes compounds without spaces, so a plain `"석사" in text`
# test matches inside longer words — and junior-college guidelines are full of
# them, because they list the certificates their graduates can earn:
#
#   투자분석사, 사회조사분석사, 빅데이터분석사, 재무빅데이터분석사
#            └ 분석사 = "analyst", and it ENDS IN 석사.
#
# All three colleges flagged on 2026-08-23 (신안산대, 가톨릭상지대, 한국골프대)
# were pure 전문대 undergraduate guidelines whose only "master's" evidence was
# a certificate list. `대학원` behaved the same way: every occurrence was
# "대학원 진학(가능)" — a careers line about where graduates can go next, not a
# graduate admission section.
_MARKER_EXCLUSIONS: dict[str, tuple[str, ...]] = {
    # A marker only counts if it is NOT part of one of these longer words.
    "석사": ("분석사",),
    "대학원": ("대학원 진학", "대학원진학", "대학원 진학가능"),
    # "간호학 박사들로 구성된 교수진" — a faculty's credentials, seen on 혜전대학교.
    # A plural of people is never a programme on offer.
    "박사": ("박사들",),
}

# Deliberately NOT excluded: 전문기술석사 (professional technical master's).
# 혜전대학교 runs one and says so, so its card rests on a real signal and a
# human glancing at it is the right outcome. The exclusions above remove
# matches that are not degrees at all; they are not a knob for tuning the
# queue down to zero, which would blind the detector to the case it exists
# for.


def _occurrences(text: str, marker: str) -> int:
    """How many times `marker` appears NOT inside one of its exclusions."""
    excl = _MARKER_EXCLUSIONS.get(marker)
    if not excl:
        return text.count(marker)
    total = text.count(marker)
    for word in excl:
        # Each exclusion word contains the marker exactly once in practice;
        # subtracting its count removes those matches from the tally.
        total -= text.count(word)
    return max(0, total)


def _count(text: str, markers: tuple[str, ...]) -> int:
    low = text.lower()
    return sum(1 for m in markers if _occurrences(low, m.lower()) > 0)


def classify_degree_level(
    *,
    first_pages_text: str,
    title: str | None = None,
    full_text: str | None = None,
) -> DegreeClassification:
    """Classify the degree level of a guideline.

    Title hits weigh double — the title/heading is the most reliable
    degree signal. `full_text` (when supplied) is scanned for combined
    detection so a graduate section deep in the document still counts.
    """
    title = title or ""
    scan = "\n".join(p for p in (title, title, first_pages_text, full_text or "") if p)

    n_grad_general = _count(scan, _GRAD_GENERAL)
    n_master = _count(scan, _MASTER)
    n_doctoral = _count(scan, _DOCTORAL)
    n_integrated = _count(scan, _INTEGRATED)
    n_undergrad = _count(scan, _UNDERGRAD)
    n_associate = _count(scan, _ASSOCIATE)
    n_undergrad_weak = _count(scan, _UNDERGRAD_WEAK)

    has_graduate = bool(
        n_grad_general or n_master or n_doctoral or n_integrated
    )
    has_undergraduate = bool(n_undergrad) or (
        bool(n_undergrad_weak) and not has_graduate
    )
    has_associate = bool(n_associate)

    parts: list[str] = []
    if n_grad_general:
        parts.append(f"grad_general×{n_grad_general}")
    if n_master:
        parts.append(f"master×{n_master}")
    if n_doctoral:
        parts.append(f"doctoral×{n_doctoral}")
    if n_integrated:
        parts.append(f"integrated×{n_integrated}")
    if n_undergrad:
        parts.append(f"undergrad×{n_undergrad}")
    if n_associate:
        parts.append(f"associate×{n_associate}")

    # --- decide the degree_levels set + primary -----------------------------
    levels: list[str] = []
    if has_associate:
        levels.append("associate")
    if has_undergraduate:
        levels.append("bachelor")
    if n_integrated:
        levels.extend(["integrated", "master", "doctoral"])
    else:
        if n_master:
            levels.append("master")
        if n_doctoral:
            levels.append("doctoral")
        if n_grad_general and not (n_master or n_doctoral):
            # Graduate, but the document didn't say master vs doctoral.
            levels.extend(["master", "doctoral"])

    # de-dup, stable order
    seen: set[str] = set()
    degree_levels = tuple(x for x in levels if not (x in seen or seen.add(x)))

    is_combined = has_undergraduate and has_graduate

    primary, cycle_track = _pick_primary(
        has_undergraduate=has_undergraduate,
        has_associate=has_associate,
        n_master=n_master,
        n_doctoral=n_doctoral,
        n_integrated=n_integrated,
        n_grad_general=n_grad_general,
        is_combined=is_combined,
    )

    confidence = _score(
        title=title,
        n_grad_general=n_grad_general,
        n_master=n_master,
        n_doctoral=n_doctoral,
        n_integrated=n_integrated,
        n_undergrad=n_undergrad,
        n_associate=n_associate,
        primary=primary,
        is_combined=is_combined,
    )

    rationale = (
        f"level={primary} combined={is_combined} "
        f"levels={list(degree_levels)} signals=[{', '.join(parts) or 'none'}]"
    )

    return DegreeClassification(
        primary_level=primary,
        degree_levels=degree_levels or ("bachelor",),
        cycle_track=cycle_track,
        has_undergraduate=has_undergraduate,
        has_graduate=has_graduate,
        is_combined=is_combined,
        confidence=confidence,
        rationale=rationale,
        has_explicit_graduate_program=bool(n_master or n_doctoral or n_integrated),
    )


def _pick_primary(
    *,
    has_undergraduate: bool,
    has_associate: bool,
    n_master: int,
    n_doctoral: int,
    n_integrated: int,
    n_grad_general: int,
    is_combined: bool,
) -> tuple[DegreeLevel, str]:
    has_graduate = bool(n_master or n_doctoral or n_integrated or n_grad_general)

    if is_combined:
        # Primary stays undergraduate (the larger cohort) but the caller
        # must split; cycle_track is the undergrad track for the primary pass.
        return "undergraduate", CYCLE_TRACK_UNDERGRAD_FOREIGN
    if has_graduate:
        if n_integrated:
            return "integrated", CYCLE_TRACK_GRAD_FOREIGN
        if n_master and n_doctoral:
            return "master", CYCLE_TRACK_GRAD_FOREIGN  # both present, non-combined grad doc
        if n_doctoral:
            return "doctoral", CYCLE_TRACK_GRAD_FOREIGN
        if n_master:
            return "master", CYCLE_TRACK_GRAD_FOREIGN
        return "master", CYCLE_TRACK_GRAD_FOREIGN  # general 대학원, level unspecified
    if has_associate:
        return "associate", CYCLE_TRACK_UNDERGRAD_FOREIGN
    if has_undergraduate:
        return "undergraduate", CYCLE_TRACK_UNDERGRAD_FOREIGN
    # No explicit markers — the corpus is overwhelmingly undergraduate foreign
    # admission, so default there but with low confidence so HITL can catch.
    return "undergraduate", CYCLE_TRACK_UNDERGRAD_FOREIGN


def _score(
    *,
    title: str,
    n_grad_general: int,
    n_master: int,
    n_doctoral: int,
    n_integrated: int,
    n_undergrad: int,
    n_associate: int,
    primary: DegreeLevel,
    is_combined: bool,
) -> float:
    total_specific = (
        n_grad_general + n_master + n_doctoral + n_integrated
        + n_undergrad + n_associate
    )
    if total_specific == 0:
        return 0.3  # default-undergraduate guess, below HITL threshold

    base = min(0.92, 0.5 + 0.12 * total_specific)

    # Title carries the strongest signal — boost when the relevant marker
    # appears in the title itself.
    title_low = title.lower()
    title_markers = {
        "undergraduate": _UNDERGRAD,
        "master": _MASTER + _GRAD_GENERAL,
        "doctoral": _DOCTORAL + _GRAD_GENERAL,
        "integrated": _INTEGRATED,
        "associate": _ASSOCIATE,
    }.get(primary, ())
    if any(m.lower() in title_low for m in title_markers):
        base = min(0.95, base + 0.1)

    # Combined documents are inherently ambiguous to parse as one unit —
    # keep confidence in the "needs a human to confirm the split" band.
    if is_combined:
        base = min(base, 0.7)

    return round(base, 3)
