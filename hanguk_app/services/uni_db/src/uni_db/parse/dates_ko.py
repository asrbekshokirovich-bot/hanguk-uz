"""Korean date parsing.

Audit §4.2 plus the audit's calendar-field rows in §5.3. Real Korean
admissions PDFs use a broad set of formats; we normalise them to ISO-8601
KST while keeping the original verbatim string for HITL audit.

Supported inputs (covered by tests):

  2026.03.15
  2026.03.15(수)              # day-of-week tag
  2026. 03. 15.               # spaces and trailing dot
  2026년 3월 15일
  2026년 03월 15일 (수)
  2026-03-15
  2026/03/15
  03/15(수)                    # year inferred from `default_year`
  03.15                        # ditto
  2026.03.15 17:00
  2026년 3월 15일 17시
  2026년 3월 15일 오후 5시      # 오전/오후 with hour
  2026.03.15(수) 17:00 KST
  2026.09.30(화) 17:00까지     # trailing 까지/예정/예상

Output:

  ParsedDate(
    iso8601="2026-09-30T17:00:00+09:00",
    is_tentative=True if 예정/예상/잠정 marker present,
    original="2026.09.30(화) 17:00까지",
  )
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable

KST = timezone.utc      # placeholder; we serialize with explicit "+09:00" suffix


@dataclass(frozen=True, slots=True)
class ParsedDate:
    iso8601: str
    is_tentative: bool
    original: str


# ---------------------------------------------------------------------------
# Regexes — ordered by specificity. The matcher tries each in turn and
# stops at the first hit so '2026년 3월 15일' beats '3월 15일'.
# ---------------------------------------------------------------------------

_HANGUL_WEEKDAY = r"[월화수목금토일]"
_DOW = rf"\(\s*{_HANGUL_WEEKDAY}\s*\)"

_PATTERNS: tuple[re.Pattern[str], ...] = (
    # 2026년 3월 15일 17시 / 2026년 03월 15일 (수) 오후 5시 30분
    re.compile(
        rf"(?P<y>\d{{4}})\s*년\s*(?P<m>\d{{1,2}})\s*월\s*(?P<d>\d{{1,2}})\s*일"
        rf"(?:\s*{_DOW})?"
        r"(?:\s*(?P<ampm>오전|오후))?"
        r"(?:\s*(?P<H>\d{1,2})\s*시(?:\s*(?P<M>\d{1,2})\s*분)?)?"
    ),
    # 2026.03.15(수) 17:00 / 2026/03/15 / 2026-03-15 17:00:00
    re.compile(
        r"(?P<y>\d{4})[\.\-/]\s*(?P<m>\d{1,2})[\.\-/]\s*(?P<d>\d{1,2})\.?"
        rf"(?:\s*{_DOW})?"
        r"(?:\s+(?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2}))?)?"
    ),
    # MM.DD or MM/DD with no year — caller must supply default_year.
    re.compile(
        r"(?<![\d])(?P<m>\d{1,2})[\./](?P<d>\d{1,2})\.?"
        rf"(?:\s*{_DOW})?"
        r"(?:\s+(?P<H>\d{1,2}):(?P<M>\d{2}))?"
    ),
)

_TENTATIVE_MARKERS: tuple[str, ...] = (
    "예정",
    "예상",
    "잠정",
    "추후",
    "추후공지",
    "변경 가능",
    "변경가능",
)


def parse_korean_date(
    text: str,
    *,
    default_year: int | None = None,
) -> ParsedDate | None:
    """Try to match the first date in `text`.

    `default_year` is required when the input lacks a year (e.g.
    "03.15(수)" appearing inside a per-cycle table).
    """
    if not text:
        return None
    for pattern in _PATTERNS:
        m = pattern.search(text)
        if not m:
            continue
        groups = m.groupdict()
        try:
            y = int(groups["y"]) if groups.get("y") else default_year
            if y is None:
                # Year is missing AND no default supplied — caller bug.
                continue
            month = int(groups["m"])
            day = int(groups["d"])
            hour = int(groups["H"]) if groups.get("H") else 0
            minute = int(groups["M"]) if groups.get("M") else 0
            second = int(groups["S"]) if groups.get("S") else 0
            ampm = groups.get("ampm")
            if ampm == "오후" and 1 <= hour <= 11:
                hour += 12
            elif ampm == "오전" and hour == 12:
                hour = 0
            dt = datetime(y, month, day, hour, minute, second)
        except (KeyError, ValueError):
            continue

        is_tentative = any(marker in text for marker in _TENTATIVE_MARKERS)
        # Format with explicit +09:00 KST suffix so downstream consumers
        # don't have to decide between offset-aware / naive datetimes.
        iso = dt.strftime("%Y-%m-%dT%H:%M:%S") + "+09:00"
        return ParsedDate(iso8601=iso, is_tentative=is_tentative, original=text.strip())
    return None


def parse_korean_date_range(
    text: str,
    *,
    default_year: int | None = None,
) -> tuple[ParsedDate | None, ParsedDate | None]:
    """Split on ~/-/–/까지 and parse both ends.

    Examples:
      "2026.09.01(월) 09:00 ~ 09.30(화) 17:00"
      "2026년 9월 1일 ~ 30일"
      "2026-09-01 — 2026-09-30"
    """
    if not text:
        return None, None
    # ~ is the Korean default; em/en dashes also common; bare ASCII '-'
    # only counts when bracketed by whitespace so we don't split inside
    # an ISO date like 2026-09-01.
    sep_re = re.compile(r"\s*~\s*|\s*[–—]\s*|\s+-{1,2}\s+", re.UNICODE)
    parts = sep_re.split(text, maxsplit=1)
    if len(parts) == 1:
        # Single date or "X까지" form.
        return parse_korean_date(text, default_year=default_year), None
    left, right = parts
    start = parse_korean_date(left, default_year=default_year)
    # Carry the year inferred from the left side into the right side.
    inferred_year = (
        int(start.iso8601[:4]) if start is not None else default_year
    )
    end = parse_korean_date(right, default_year=inferred_year)
    return start, end


def iter_dates_in(text: str, default_year: int | None = None) -> Iterable[ParsedDate]:
    """Yield each Korean date found anywhere in `text`. Dedup-safe."""
    seen: set[str] = set()
    for line in text.splitlines():
        date = parse_korean_date(line, default_year=default_year)
        if date is None:
            continue
        if date.iso8601 in seen:
            continue
        seen.add(date.iso8601)
        yield date
