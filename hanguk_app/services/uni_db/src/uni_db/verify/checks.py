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
    """Return the row/event dicts from an extraction payload, ignoring meta."""
    if not isinstance(parsed_output, dict):
        return []
    rows: list[dict[str, Any]] = []
    for key in ("rows", "events"):
        seq = parsed_output.get(key)
        if isinstance(seq, list):
            rows.extend(r for r in seq if isinstance(r, dict))
    return rows


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
_PREFIX_LEN = 40


def check_grounding_deterministic(
    field_group: str, parsed_output: object, pdf_text: str
) -> list[GroundingIssue]:
    """Flag any row whose `source_text_ko` does not actually occur in the PDF —
    a fabricated citation. Whitespace-insensitive; a 40-char prefix match is
    accepted since the model sometimes trims/joins the tail of a quote."""
    norm_pdf = _norm(pdf_text)
    issues: list[GroundingIssue] = []
    for i, row in enumerate(_iter_rows(parsed_output)):
        quote = row.get("source_text_ko")
        if not isinstance(quote, str) or len(quote.strip()) < _MIN_QUOTE_LEN:
            continue
        nq = _norm(quote)
        if nq and (nq in norm_pdf or nq[:_PREFIX_LEN] in norm_pdf):
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

_CAL_ORDER = ["apply_open", "apply_close", "document_submission_deadline", "final_results"]


def sanity_checks(
    field_group: str, parsed_output: object, *, target_year: int | None = None
) -> list[SanityIssue]:
    if field_group == "calendar":
        return _sanity_calendar(parsed_output)
    if field_group == "tuition":
        return _sanity_tuition(parsed_output, target_year)
    if field_group in ("requirements", "basic_requirements"):
        return _sanity_requirements(parsed_output)
    if field_group == "scholarships":
        return _sanity_scholarships(parsed_output)
    return []


def _sanity_calendar(parsed_output: object) -> list[SanityIssue]:
    issues: list[SanityIssue] = []
    first: dict[str, datetime] = {}
    for row in _iter_rows(parsed_output):
        et = row.get("event_type")
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
        for row in rows:
            et = row.get("event_type")
            dt = _as_date(row.get("starts_at"))
            if isinstance(et, str) and et in _CAL_ORDER and dt is not None:
                out.setdefault(f"date:{et}", dt.date().isoformat())
        return out
    if field_group == "tuition":
        amounts = [int(a) for row in rows if (a := _num(row.get("amount_krw"))) is not None]
        facs = sorted({str(row.get("faculty_group")) for row in rows if row.get("faculty_group")})
        return {"tuition:min_krw": min(amounts) if amounts else None,
                "tuition:faculties": facs}
    if field_group in ("requirements", "basic_requirements"):
        topiks = [t for row in rows if isinstance((t := row.get("topik_min_level")), int)]
        return {"req:topik_min": min(topiks) if topiks else None}
    if field_group == "documents_required":
        docs = sorted({str(row.get("document_type")) for row in rows
                       if row.get("is_required", True) and row.get("document_type")})
        return {"docs:required": docs}
    if field_group == "scholarships":
        names = sorted({str(row.get("name_ko")) for row in rows if row.get("name_ko")})
        return {"sch:names": names}
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
