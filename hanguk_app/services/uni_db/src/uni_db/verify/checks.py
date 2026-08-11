"""Pure (no-network) verification checks: deterministic sanity rules, source
grounding by substring match, and cross-run consensus. Every function here is
total and side-effect-free so it unit-tests without HTTP/LLM/DB."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime
from itertools import pairwise
from typing import Any

from ..extract.event_types import (
    CALENDAR_EVENT_ORDER,
    PERIOD_FIELD_ORDER,
    canonical_event_type,
)
from ..parse.cycle_detect import cycle_window
from .models import ConsensusField, GroundingIssue, SanityIssue

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

_WS_RE = re.compile(r"\s+")


def _norm(text: str | None) -> str:
    """Whitespace-insensitive form. Korean PDF text extraction inserts/drops
    spaces unpredictably, so we compare with all whitespace removed."""
    return _WS_RE.sub("", text or "")


def _iter_rows(parsed_output: object) -> list[dict[str, Any]]:
    """Return the row/event/period dicts from an extraction payload, ignoring
    meta. `periods` is included so the calendar rows the app actually PUBLISHES
    are grounded, not just the `events` array."""
    if not isinstance(parsed_output, dict):
        return []
    rows: list[dict[str, Any]] = []
    for key in ("rows", "events", "periods"):
        seq = parsed_output.get(key)
        if isinstance(seq, list):
            rows.extend(r for r in seq if isinstance(r, dict))
    return rows


def _list(parsed_output: object, key: str) -> list[dict[str, Any]]:
    if isinstance(parsed_output, dict) and isinstance(parsed_output.get(key), list):
        return [r for r in parsed_output[key] if isinstance(r, dict)]
    return []


def _as_date(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        # Fall back to a leading YYYY-MM-DD if the model emitted trailing junk.
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", value)
        if m:
            try:
                return datetime(int(m[1]), int(m[2]), int(m[3]))
            except ValueError:
                return None
        return None


def _num(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


# ---------------------------------------------------------------------------
# Gate 2 (part) — deterministic grounding: the quote must appear in the PDF
# ---------------------------------------------------------------------------

_MIN_QUOTE_LEN = 12
# Shortest run of quote characters that counts as evidence rather than
# coincidence. Korean is dense — 8 chars is already several syllable blocks.
_MIN_RUN = 8
# Fraction of the quote that must be covered by such runs.
_MIN_COVERAGE = 0.75


def _covered_fraction(nq: str, norm_pdf: str) -> float:
    """How much of the quote is made of runs (>= _MIN_RUN chars) found in the PDF.

    Walks the quote left to right; at each position takes the LONGEST run
    starting there that occurs in the PDF and skips past it. Coverage is those
    runs' total length over the quote's length, so it does not depend on where
    the reformatting falls — or on how long the quote is.
    """
    n = len(nq)
    if n == 0:
        return 1.0
    covered = i = 0
    while i < n:
        best = 0
        lo, hi = _MIN_RUN, n - i
        while lo <= hi:                      # binary search: runs are prefix-closed
            mid = (lo + hi) // 2
            if nq[i:i + mid] in norm_pdf:
                best = mid
                lo = mid + 1
            else:
                hi = mid - 1
        if best:
            covered += best
            i += best
        else:
            i += 1
    return covered / n


def _quote_grounded(nq: str, norm_pdf: str) -> bool:
    """Whitespace-insensitive grounding: the quote is grounded if it appears
    whole, or if at least `_MIN_COVERAGE` of it is covered by runs found in the
    PDF. That tolerates interior reformatting (a date rewritten `2026년 9월 1일`
    → `2026.9.1`, or a table row the model stitched from a header cell and a
    body cell that sit apart in the extracted text) while a fabricated quote,
    sharing no long run with the source, still fails.

    Coverage replaced a majority-of-fixed-20-char-chunks vote, which made
    strictness *inversely* proportional to quote length: a 23-char quote became
    one chunk that had to match exactly — zero tolerance — while an 81-char
    quote could be 40 characters wrong and still pass. Short, genuine quotes
    were the common case, so most `quote_not_in_source` flags were false.
    """
    if not nq or nq in norm_pdf:
        return True
    return _covered_fraction(nq, norm_pdf) >= _MIN_COVERAGE


def check_grounding_deterministic(
    field_group: str, parsed_output: object, pdf_text: str
) -> list[GroundingIssue]:
    """Flag any row whose `source_text_ko` does not actually occur in the PDF —
    a fabricated citation."""
    norm_pdf = _norm(pdf_text)
    issues: list[GroundingIssue] = []
    for i, row in enumerate(_iter_rows(parsed_output)):
        quote = row.get("source_text_ko")
        if not isinstance(quote, str) or len(quote.strip()) < _MIN_QUOTE_LEN:
            continue
        if _quote_grounded(_norm(quote), norm_pdf):
            continue
        issues.append(
            GroundingIssue(
                field_group=field_group,
                row_index=i,
                field="source_text_ko",
                problem="quote_not_in_source",
                quote=quote[:120],
            )
        )
    return issues


# ---------------------------------------------------------------------------
# Gate 5 — deterministic sanity rules
# ---------------------------------------------------------------------------

# Plausible per-semester tuition band for a Korean university (KRW).
_TUITION_MIN_KRW = 500_000
_TUITION_MAX_KRW = 30_000_000

# Event-type names come from the shared canonical table (Phase 3 — ONE table,
# both lanes import it). Event types read from payloads are canonicalized
# before comparison, so `document_submission_deadline` and `documents_deadline`
# order/aggregate identically here and in the extraction lane.
_CAL_ORDER = list(CALENDAR_EVENT_ORDER)
# The date fields the app actually publishes (university_admission_periods),
# in the order they must occur.
_PERIOD_ORDER = list(PERIOD_FIELD_ORDER)


def sanity_checks(
    field_group: str,
    parsed_output: object,
    *,
    target_year: int | None = None,
    target_term: str | None = None,
) -> list[SanityIssue]:
    if field_group == "calendar":
        return _sanity_calendar(parsed_output, target_year, target_term)
    if field_group == "tuition":
        return _sanity_tuition(parsed_output, target_year)
    if field_group in ("requirements", "basic_requirements"):
        return _sanity_requirements(parsed_output)
    if field_group == "scholarships":
        return _sanity_scholarships(parsed_output)
    return []


def _sanity_calendar(
    parsed_output: object,
    target_year: int | None = None,
    target_term: str | None = None,
) -> list[SanityIssue]:
    issues: list[SanityIssue] = []
    first: dict[str, datetime] = {}
    for row in _iter_rows(parsed_output):
        et = canonical_event_type(row.get("event_type"))
        dt = _as_date(row.get("starts_at"))
        if isinstance(et, str) and dt is not None and et not in first:
            first[et] = dt
    present = [(et, first[et]) for et in _CAL_ORDER if et in first]
    for (a_name, a_dt), (b_name, b_dt) in pairwise(present):
        if a_dt > b_dt:
            issues.append(
                SanityIssue(
                    field_group="calendar",
                    field=f"{a_name}→{b_name}",
                    severity="high",
                    problem="out_of_order_dates",
                    detail=f"{a_name} {a_dt.date()} is after {b_name} {b_dt.date()}",
                )
            )
    # Same ordering rule on the PUBLISHED period rows (what applicants see).
    for idx, p in enumerate(_list(parsed_output, "periods")):
        seq = [(f, _as_date(p.get(f))) for f in _PERIOD_ORDER]
        seq = [(f, d) for f, d in seq if d is not None]
        for (a_name, a_dt), (b_name, b_dt) in pairwise(seq):
            if a_dt > b_dt:
                issues.append(SanityIssue(
                    field_group="calendar",
                    field=f"period[{idx}].{a_name}→{b_name}",
                    severity="high",
                    problem="out_of_order_dates",
                    detail=f"{a_name} {a_dt.date()} is after {b_name} {b_dt.date()}",
                ))
    issues.extend(_cycle_window_issues(parsed_output, target_year, target_term))
    return issues


def _cycle_window_issues(
    parsed_output: object, target_year: int | None, target_term: str | None
) -> list[SanityIssue]:
    """Phase 3 hard gate: EVERY extracted calendar date must fall inside the
    target-cycle window (2027 spring: 2026-08-01 .. 2027-06-30). A date outside
    it means the calendar was lifted from an older (or wrong-term) guideline —
    the forensic audit found 78/83 stored documents were off-cycle — so the
    violation is a HIGH `stale_cycle` issue, which lands the group RED."""
    if target_year is None:
        return []
    lo, hi = cycle_window(target_year, target_term)
    issues: list[SanityIssue] = []

    def _check(where: str, value: object) -> None:
        dt = _as_date(value)
        if dt is not None and not (lo <= dt.date() <= hi):
            issues.append(SanityIssue(
                field_group="calendar",
                field=where,
                severity="high",
                problem="stale_cycle",
                detail=f"{where} {dt.date()} outside target-cycle window "
                       f"{lo.isoformat()}..{hi.isoformat()}",
            ))

    for i, ev in enumerate(_list(parsed_output, "events")):
        _check(f"events[{i}].starts_at", ev.get("starts_at"))
        _check(f"events[{i}].ends_at", ev.get("ends_at"))
    for i, p in enumerate(_list(parsed_output, "periods")):
        for field, value in p.items():
            if isinstance(value, str):
                _check(f"period[{i}].{field}", value)
    return issues


def _sanity_tuition(parsed_output: object, target_year: int | None) -> list[SanityIssue]:
    issues: list[SanityIssue] = []
    for row in _iter_rows(parsed_output):
        amt = _num(row.get("amount_krw"))
        fac = row.get("faculty_group")
        if amt is not None and not (_TUITION_MIN_KRW <= amt <= _TUITION_MAX_KRW):
            issues.append(
                SanityIssue(
                    field_group="tuition",
                    field="amount_krw",
                    severity="high",
                    problem="tuition_out_of_range",
                    detail=f"{fac}: {int(amt):,} KRW/semester outside "
                    f"[{_TUITION_MIN_KRW:,}, {_TUITION_MAX_KRW:,}]",
                )
            )
        yr = row.get("academic_year")
        if target_year is not None and isinstance(yr, int) and abs(yr - target_year) > 1:
            issues.append(
                SanityIssue(
                    field_group="tuition",
                    field="academic_year",
                    severity="medium",
                    problem="year_mismatch",
                    detail=f"tuition academic_year {yr} != target {target_year}",
                )
            )
    return issues


def _sanity_requirements(parsed_output: object) -> list[SanityIssue]:
    issues: list[SanityIssue] = []
    for row in _iter_rows(parsed_output):
        topik = row.get("topik_min_level")
        if isinstance(topik, int) and not (1 <= topik <= 6):
            issues.append(SanityIssue("requirements", "topik_min_level", "high",
                                      "topik_out_of_range", f"TOPIK {topik} not in 1..6"))
        gpa = _num(row.get("gpa_floor_pct"))
        if gpa is not None and not (0 <= gpa <= 100):
            issues.append(SanityIssue("requirements", "gpa_floor_pct", "high",
                                      "gpa_out_of_range", f"GPA floor {gpa}% not in 0..100"))
        et = row.get("english_test")
        english_scores: list[str] = []
        if isinstance(et, dict):
            ielts = _num(et.get("ielts"))
            if ielts is not None and not (0 <= ielts <= 9):
                issues.append(SanityIssue("requirements", "english_test.ielts", "high",
                                          "ielts_out_of_range", f"IELTS {ielts} not in 0..9"))
            toefl = _num(et.get("toefl_ibt"))
            if toefl is not None and not (0 <= toefl <= 120):
                issues.append(SanityIssue("requirements", "english_test.toefl_ibt", "high",
                                          "toefl_out_of_range", f"TOEFL iBT {toefl} not in 0..120"))
            english_scores = [
                k for k in ("ielts", "toefl_ibt", "toefl_pbt", "teps", "duolingo", "min_score")
                if _num(et.get(k)) is not None
            ]
        # Language-eligibility completeness. Our applicants qualify on EITHER
        # track — Korean (TOPIK) or English (IELTS/TOEFL) — so a stated
        # requirement must carry its actual threshold; a "required" status with
        # no number is a dropped cutoff that would wrongly filter a qualified
        # student. (Deferred/면제 is a legitimate no-number case, so it's allowed.)
        if row.get("english_status") == "required" and not english_scores:
            issues.append(SanityIssue(
                "requirements", "english_test", "medium", "english_required_no_score",
                "English proficiency required but no IELTS/TOEFL score threshold captured",
            ))
        if (row.get("topik_status") == "required"
                and row.get("topik_min_level") is None
                and not row.get("topik_deferred")):
            issues.append(SanityIssue(
                "requirements", "topik_min_level", "medium", "topik_required_no_level",
                "TOPIK required but no minimum level captured",
            ))
    return issues


def _sanity_scholarships(parsed_output: object) -> list[SanityIssue]:
    issues: list[SanityIssue] = []
    for row in _iter_rows(parsed_output):
        if row.get("award_type") == "tuition_waiver_pct":
            val = _num(row.get("award_value"))
            if val is not None and not (0 <= val <= 100):
                issues.append(SanityIssue("scholarships", "award_value", "medium",
                                          "waiver_pct_out_of_range",
                                          f"tuition waiver {val}% not in 0..100"))
    return issues


# ---------------------------------------------------------------------------
# Gate 3 — consensus across N independent extractions
# ---------------------------------------------------------------------------


def critical_signature(field_group: str, parsed_output: object) -> dict[str, Any]:
    """Reduce an extraction to the handful of facts that MUST be right, in a
    form comparable across runs (order-independent). Disagreement here is what
    routes a guideline to red."""
    rows = _iter_rows(parsed_output)
    if field_group == "calendar":
        out: dict[str, Any] = {}
        for row in _list(parsed_output, "events"):
            et = canonical_event_type(row.get("event_type"))
            dt = _as_date(row.get("starts_at"))
            if isinstance(et, str) and et in _CAL_ORDER and dt is not None:
                out.setdefault(f"date:{et}", dt.date().isoformat())
        # Published period dates too (order-independent list per field).
        for f in _PERIOD_ORDER:
            dates = sorted(
                d.date().isoformat()
                for p in _list(parsed_output, "periods")
                for d in [_as_date(p.get(f))] if d is not None
            )
            if dates:
                out[f"period:{f}"] = dates
        return out
    if field_group == "tuition":
        # Per-faculty amount, so a run that SWAPS two faculties' tuition (same
        # min + same faculty set) is still caught as a disagreement.
        by_fac: dict[str, int] = {}
        for row in rows:
            amt = _num(row.get("amount_krw"))
            fac = row.get("faculty_group")
            if amt is not None and fac:
                key = str(fac)
                by_fac[key] = min(by_fac.get(key, int(amt)), int(amt))
        return {f"tuition:{k}": v for k, v in sorted(by_fac.items())}
    if field_group in ("requirements", "basic_requirements"):
        topiks = [t for row in rows if isinstance((t := row.get("topik_min_level")), int)]
        eng: list[float] = []
        for row in rows:
            et = row.get("english_test")
            if isinstance(et, dict):
                for k in ("ielts", "min_score", "toefl_ibt"):
                    v = _num(et.get(k))
                    if v is not None:
                        eng.append(v)
                        break
        gpas = [g for row in rows if (g := _num(row.get("gpa_floor_pct"))) is not None]
        return {
            "req:topik_min": min(topiks) if topiks else None,
            "req:english_min": min(eng) if eng else None,
            "req:gpa_floor": min(gpas) if gpas else None,
        }
    if field_group == "documents_required":
        docs = sorted({str(row.get("document_type")) for row in rows
                       if row.get("is_required", True) and row.get("document_type")})
        return {"docs:required": docs}
    if field_group == "scholarships":
        # Name → (award_type, award_value), so a changed award value on the same
        # scholarship name is a disagreement (was invisible with a name-set).
        out2: dict[str, Any] = {}
        for row in rows:
            name = row.get("name_ko")
            if name:
                out2[f"sch:{name}"] = [row.get("award_type"), _num(row.get("award_value"))]
        return dict(sorted(out2.items()))
    return {}


def consensus(field_group: str, runs: list[object]) -> list[ConsensusField]:
    """Compare the critical signatures of N independent extractions field by
    field. `unanimous=False` on any critical field is a red flag."""
    if len(runs) < 2:
        return []
    sigs = [critical_signature(field_group, r) for r in runs]
    keys = sorted({k for sig in sigs for k in sig})
    out: list[ConsensusField] = []
    for key in keys:
        values = [sig.get(key) for sig in sigs]
        encoded = [json.dumps(v, sort_keys=True, ensure_ascii=False) for v in values]
        _, mode_count = Counter(encoded).most_common(1)[0]
        out.append(
            ConsensusField(
                field_group=field_group,
                field=key,
                values=values,
                agreement=mode_count / len(runs),
                unanimous=mode_count == len(runs),
            )
        )
    return out
