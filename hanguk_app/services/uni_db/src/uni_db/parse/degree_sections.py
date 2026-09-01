"""Split a combined undergraduate+graduate guideline into degree segments.

Some universities publish ONE PDF that covers both 학부 (undergraduate) and
대학원 (graduate) foreign admission. The undergraduate-tuned extraction
prompts mis-handle such a document if it is parsed as a single unit, so we
segment it on the degree-section headings and let the worker run extraction
per segment (and emit separate admission cycles).

Pure / no IO. Heading detection is heuristic — it finds the byte offsets of
the strongest undergraduate and graduate section headers and slices the text
into contiguous segments between them. When only one degree is present a
single whole-document segment is returned.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

SegmentLevel = Literal["undergraduate", "graduate"]

# Headings that mark the START of a degree section.
#
# The terms split into two tiers, because they are not equally reliable.
#
# STRONG terms are section titles wherever they appear: 일반대학원, or 대학원
# immediately followed by an admission word. Prose does not write those.
#
# WEAK terms — 석사 과정, 박사 과정, 학사 과정 — read exactly the same in a
# section title and in a sentence. Korean admission PDFs are full of the
# sentence form:
#
#     졸업 후 석사 과정 진학이 가능합니다      ("graduates may go on to …")
#     박사 과정 소지자로 구성된 교수진          (a faculty's credentials)
#
# The module docstring has always claimed detection is "kept narrow so a
# stray mention does not create a spurious boundary", but the weak terms
# carried no positional constraint at all, so one careers sentence 55k
# characters into a junior-college guideline was read as the start of a
# graduate section. That produced a `graduate` segment covering the whole
# file, one segment instead of two, and a degree_check card on a document
# with no graduate admission in it.
#
# So a weak term counts only with heading context: it must open a line
# (after the ornaments Korean admission PDFs put in front of a title), it
# must not be followed by a "go on to study" verb, and an admission word
# must follow it on the same line.

# Bullets, numbering and brackets that can precede a section title.
_ORNAMENT = r"[\s\-–—•·※□■○●◇◆▪▷▶◈☞\d０-９.)\]】]*"

# Verbs that turn a degree term into a sentence about a student's future
# rather than a programme on offer here.
_NOT_A_HEADING_AFTER = r"(?:\s*(?:진학|졸업|취득|소지|이수|수료|재학|출신))"

# An admission word must appear on the same line for a weak term to be read
# as the title of an admission section.
_ADMISSION_NEARBY = r"(?=.{0,40}(?:모집|전형|안내|입학|신입|지원|선발))"

_GRAD_STRONG = (
    r"(?:대학원(?!" + _NOT_A_HEADING_AFTER + r")\s*"
    r"(?:외국인|신입|모집|전형|과정|입학|안내|석사|박사)"
    r"|일반대학원"
    r"|전문대학원"
    r"|석박사\s*통합"
    r"|석·박사\s*통합)"
)
_GRAD_WEAK = r"(?:석사\s*과정|박사\s*과정|석사학위\s*과정|박사학위\s*과정)"

_UNDERGRAD_STRONG = (
    r"(?:학부\s*(?:외국인|신입학|모집|전형)"
    r"|대학\s*\(학부\)"
    r"|외국인\s*학부\s*신입학)"
)
_UNDERGRAD_WEAK = r"(?:학사\s*과정|학사학위\s*과정)"


def _header_pattern(strong: str, weak: str) -> re.Pattern[str]:
    """A two-tier header matcher.

    Group 1 is a strong term matched anywhere; group 2 is a weak term that
    had to earn its match by opening a line and being followed by an
    admission word. Exactly one of the two groups is set on any match, and
    `_first` reads the offset off whichever it is — so the reported offset
    is always the start of the degree term itself, never of the ornament.
    """
    return re.compile(
        r"(?m)(?:"
        r"(" + strong + r")"
        r"|^" + _ORNAMENT + r"(" + weak + r")"
        r"(?!" + _NOT_A_HEADING_AFTER + r")" + _ADMISSION_NEARBY +
        r")"
    )


_GRAD_HEADER = _header_pattern(_GRAD_STRONG, _GRAD_WEAK)
_UNDERGRAD_HEADER = _header_pattern(_UNDERGRAD_STRONG, _UNDERGRAD_WEAK)


@dataclass(frozen=True, slots=True)
class DegreeSegment:
    level: SegmentLevel
    text: str
    start_offset: int
    header: str


def _first(pattern: re.Pattern[str], text: str) -> tuple[int, str] | None:
    m = pattern.search(text)
    if m is None:
        return None
    # Whichever tier matched, report the degree term's own offset.
    idx = 1 if m.group(1) is not None else 2
    return m.start(idx), m.group(idx).strip()


def split_by_degree(full_text: str) -> list[DegreeSegment]:
    """Return the document's degree segments in document order.

    - Both degrees present  → two (or more) contiguous segments split at the
      boundary between the undergraduate and graduate headers.
    - One degree present    → a single whole-document segment of that level.
    - Neither               → a single 'undergraduate' segment (the default
      assumption for the foreign-admission corpus).
    """
    ug = _first(_UNDERGRAD_HEADER, full_text)
    gr = _first(_GRAD_HEADER, full_text)

    if ug is None and gr is None:
        return [DegreeSegment("undergraduate", full_text, 0, "")]
    if gr is None:
        return [DegreeSegment("undergraduate", full_text, ug[0], ug[1])]
    if ug is None:
        return [DegreeSegment("graduate", full_text, gr[0], gr[1])]

    # Both present — order by offset and slice at the boundary.
    ug_off, ug_hdr = ug
    gr_off, gr_hdr = gr
    if ug_off <= gr_off:
        return [
            DegreeSegment("undergraduate", full_text[:gr_off], ug_off, ug_hdr),
            DegreeSegment("graduate", full_text[gr_off:], gr_off, gr_hdr),
        ]
    return [
        DegreeSegment("graduate", full_text[:ug_off], gr_off, gr_hdr),
        DegreeSegment("undergraduate", full_text[ug_off:], ug_off, ug_hdr),
    ]


def is_combined(full_text: str) -> bool:
    """True iff both an undergraduate and a graduate section header appear."""
    return (
        _UNDERGRAD_HEADER.search(full_text) is not None
        and _GRAD_HEADER.search(full_text) is not None
    )
