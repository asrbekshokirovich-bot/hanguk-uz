"""Normalize LLM extraction output before schema validation.

The model occasionally drifts from the exact envelope: it returns a bare
array, omits the `rows`/`events` key, names the array differently, or emits a
calendar `event_type` outside our enum. Rather than failing the whole
extraction (which dumps a raw error on the reviewer), we repair these
structural quirks first. Genuine emptiness still normalizes to `{"rows": []}`
/ `{"events": []}`, which Layer 1 queue-hygiene then drops from the queue.

Pure / no IO.
"""

from __future__ import annotations

import re
from typing import Any

from .event_types import (
    CALENDAR_EVENT_TYPES,
    EVENT_TO_PERIOD_FIELD,
    EVENT_TYPE_SYNONYMS,
    canonical_event_type,
)

# Field groups whose content array is "events"; everything else is "rows".
_CONTENT_KEY: dict[str, str] = {"calendar": "events"}

# Per-row free-text Korean fields where two artifacts have been observed:
#   (a) the English translation concatenated after the Korean, and
#   (b) the same clause emitted twice in one value.
# We clean these conservatively (see _clean_ko_text) so the student-facing
# fields stay Korean-only and de-duplicated. The real fix is the prompt
# instruction not to produce them; this is the safety net for drift.
_KO_TEXT_FIELDS: tuple[str, ...] = (
    "prose_ko",
    "notes_ko",
    "source_text_ko",
    "correction_text_ko",
)

_HANGUL_RE = re.compile(r"[가-힣]")

# A long trailing run that is overwhelmingly a multi-word English sentence
# appended after Korean text, optionally introduced by a "**"/"||"/"//"
# separator. The match is only *stripped* under the extra guards in
# _clean_ko_text (Hangul present, >= 4 spaces, not a URL), so test names
# ("TOEFL iBT 80"), short document codes, and URLs survive untouched.
_TRAILING_LATIN_RE = re.compile(
    r"\s*(?:\*\*+|\|\||//|::)?\s*"
    r"([A-Za-z][A-Za-z0-9 ,.\-:;'\"()/&%]{39,})\s*$"
)

# Event-type vocabulary lives in extract/event_types.py — the ONE canonical
# table BOTH lanes import (Phase 3; verify/checks.py reads the same names).
# The alias keeps this module's historical name working.
_CALENDAR_EVENT_SYNONYMS = EVENT_TYPE_SYNONYMS


def content_key_for(field_group: str) -> str:
    return _CONTENT_KEY.get(field_group, "rows")


def _strip_trailing_translation(text: str) -> str:
    """Drop a multi-word English sentence appended after Korean text.

    Targets the bilingual-concatenation artifact (a `*_ko` field whose tail
    is the English translation of the Korean that precedes it). Only fires
    when the value contains Hangul, the trailing Latin run is a real
    sentence (>= 4 spaces) and isn't a URL — otherwise the value is
    returned unchanged.
    """
    if not _HANGUL_RE.search(text):
        return text  # purely-Latin field (e.g. an English-only source span)
    match = _TRAILING_LATIN_RE.search(text)
    if not match:
        return text
    tail = match.group(1)
    if tail.count(" ") < 4:
        return text  # too short to be an appended sentence (codes, test names)
    low = tail.lower()
    if "://" in low or "www." in low:
        return text  # never strip a URL
    head = text[: match.start()].rstrip(" *|/:")
    # Only strip if a Korean-bearing remainder survives.
    if head.strip() and _HANGUL_RE.search(head):
        return head.strip()
    return text


def _collapse_adjacent_duplicate(text: str) -> str:
    """Collapse a value that is exactly its first half repeated.

    Handles the observed `"X X"` / `"X  X"` artifact where one field carries
    the same clause twice. Conservative: only when the two halves are
    identical after trimming a small joining separator.
    """
    s = text.strip()
    if len(s) < 8:
        return text
    # Try splitting on a separator at the midpoint, then exact bisection.
    for sep in (" ", "  ", " / ", " | ", " — "):
        idx = s.find(sep, 1)
        while idx != -1:
            left, right = s[:idx].strip(), s[idx + len(sep):].strip()
            if left and left == right:
                return left
            idx = s.find(sep, idx + 1)
    half = len(s) // 2
    if s[:half].strip() and s[:half].strip() == s[half:].strip():
        return s[:half].strip()
    return text


def _clean_ko_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    return _collapse_adjacent_duplicate(_strip_trailing_translation(value))


def _clean_row(row: Any) -> None:
    if not isinstance(row, dict):
        return
    for field in _KO_TEXT_FIELDS:
        if field in row:
            row[field] = _clean_ko_text(row[field])


# Calendar `events[]` carry the dated milestones; the student-facing form
# reads the structured `periods[]` fields. When extraction filled events but
# not periods, derive a period so the labelled fields (application window,
# interview, results) aren't shown as "Not specified" while the data sits
# unseen in events. The event_type → period-field mapping is the shared
# canonical table (event_types.EVENT_TO_PERIOD_FIELD), keyed by canonical
# names — synonyms are canonicalized first.


def _derive_period_from_events(events: list) -> dict[str, Any]:
    """Build one `periods[]` row from the dated events (first value wins)."""
    period: dict[str, Any] = {}
    for ev in events:
        if not isinstance(ev, dict):
            continue
        canonical = canonical_event_type(ev.get("event_type"))
        field = EVENT_TO_PERIOD_FIELD.get(canonical) if canonical else None
        starts = ev.get("starts_at")
        if field and starts and field not in period:
            period[field] = starts
    return period


def normalize_output(field_group: str, parsed: Any) -> Any:
    """Repair structural drift so valid-but-oddly-shaped output passes.

    Never touches a `_extraction_failed` marker. Returns a dict with the
    expected content key present.
    """
    key = content_key_for(field_group)

    # A bare array → wrap it in the envelope.
    if isinstance(parsed, list):
        parsed = {key: parsed}

    if not isinstance(parsed, dict):
        return {key: []}

    if "_extraction_failed" in parsed:
        return parsed

    # Ensure the content key exists. If the model used a single differently
    # named array key, adopt it; otherwise default to empty.
    if key not in parsed:
        array_keys = [k for k, v in parsed.items() if isinstance(v, list)]
        if len(array_keys) == 1:
            parsed[key] = parsed.pop(array_keys[0])
        else:
            parsed[key] = []

    # Calendar: map any unknown event_type to "other" so one odd label
    # doesn't fail the whole batch.
    if field_group == "calendar" and isinstance(parsed.get(key), list):
        for row in parsed[key]:
            if isinstance(row, dict):
                et = row.get("event_type")
                if isinstance(et, str):
                    et = _CALENDAR_EVENT_SYNONYMS.get(et, et)
                    row["event_type"] = et if et in CALENDAR_EVENT_TYPES else "other"

    # Calendar: if events were extracted but periods weren't, derive the
    # structured period so the labelled timeline fields populate (Phase 3 —
    # stop hiding extracted dates behind "Not specified").
    if field_group == "calendar" and isinstance(parsed.get(key), list):
        existing = parsed.get("periods")
        if not (isinstance(existing, list) and existing):
            derived = _derive_period_from_events(parsed[key])
            if derived:
                parsed["periods"] = [derived]

    # Clean per-row Korean free-text: strip an appended English translation
    # and collapse exact duplicate clauses (see module docstring).
    if isinstance(parsed.get(key), list):
        for row in parsed[key]:
            _clean_row(row)

    return parsed
