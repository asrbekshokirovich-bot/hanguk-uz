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

# Headings that mark the START of a degree section. Kept narrow so a stray
# mention (e.g. "대학원 진학 시" in an undergrad note) does not create a
# spurious boundary — we require the term to look like a section header
# (followed by 모집/신입학/전형/과정/안내 or at a line start).
_GRAD_HEADER = re.compile(
    r"(대학원\s*(외국인|신입|모집|전형|과정|입학)"
    r"|일반대학원"
    r"|석사\s*과정"
    r"|박사\s*과정"
    r"|석박사\s*통합"
    r"|석·박사\s*통합)"
)
_UNDERGRAD_HEADER = re.compile(
    r"(학부\s*(외국인|신입학|모집|전형)"
    r"|학사\s*과정"
    r"|대학\s*\(학부\)"
    r"|외국인\s*학부\s*신입학)"
)


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
    return m.start(), m.group(0).strip()


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
