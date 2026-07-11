"""LLM verification agents (Gate 0 identity, Gate 2 grounding judge, Gate 4
critics). Each takes an injectable `call_json(system, user, model) -> dict` so
the whole gauntlet unit-tests offline; the default is the live Claude call.

Cheap model (`anthropic_model_classify`, e.g. haiku) is the default for these —
they judge, they don't extract, so they don't need the extractor's Sonnet.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from ..config import settings
from . import prompts
from .llm import call_json as _live_call_json
from .models import CriticIssue, GroundingIssue, IdentityVerdict

log = logging.getLogger(__name__)

_KOREAN_UNIV_TAIL = re.compile(r"(대학교|대학|대|university|univ)\.?", re.IGNORECASE)


def _default_model() -> str:
    return settings.anthropic_model_classify or "claude-haiku-4-5"


def _norm_name(name: str | None) -> str:
    if not name:
        return ""
    return _KOREAN_UNIV_TAIL.sub("", name).replace(" ", "").lower().strip()


def names_match(doc_name: str | None, inst_ko: str | None, inst_en: str | None) -> bool:
    """Deterministic cross-check: does the doc's university name look like ours?
    Substring either direction after stripping the 대학교/University suffix."""
    d = _norm_name(doc_name)
    if not d:
        return False
    for cand in (_norm_name(inst_ko), _norm_name(inst_en)):
        if cand and (cand in d or d in cand):
            return True
    return False


def check_identity(
    *,
    university_name_ko: str,
    university_name_en: str | None,
    target_year: int,
    target_term: str | None,
    head_text: str,
    filename: str | None = None,
    url: str | None = None,
    call_json: Any = None,
    model: str | None = None,
) -> IdentityVerdict:
    """Gate 0. Returns a verdict; `.accepted` is the go/no-go. The LLM's
    university match is AND-ed with a deterministic name cross-check, so a
    confident-but-wrong 'matches_target_university=true' can't sneak a different
    school's guideline through."""
    call = call_json or _live_call_json
    system, user = prompts.identity_prompt(
        university_name_ko=university_name_ko,
        university_name_en=university_name_en,
        target_year=target_year,
        target_term=target_term,
        filename=filename,
        url=url,
        head_text=head_text[:8000],
    )
    data = call(system, user, model or _default_model())

    doc_name = data.get("university_name_ko_in_doc")
    llm_match = bool(data.get("matches_target_university"))
    det_match = names_match(doc_name, university_name_ko, university_name_en)
    # Trust a match only if BOTH the model and the deterministic check agree
    # (or the model is unsure of the name but says match with high confidence).
    matches_uni = llm_match and (det_match or doc_name is None)

    reject = data.get("reject_reason")
    if llm_match and doc_name and not det_match:
        reject = reject or f"doc university '{doc_name}' does not match '{university_name_ko}'"

    return IdentityVerdict(
        document_kind=str(data.get("document_kind") or "other"),
        university_name_ko_in_doc=doc_name if isinstance(doc_name, str) else None,
        matches_target_university=matches_uni,
        academic_year_in_doc=_as_int(data.get("academic_year_in_doc")),
        term_in_doc=_as_term(data.get("term_in_doc")),
        matches_target_cycle=bool(data.get("matches_target_cycle")),
        audience=str(data.get("audience") or "unclear"),
        serves_foreign_applicants=bool(data.get("serves_foreign_applicants")),
        is_old_or_superseded=bool(data.get("is_old_or_superseded")),
        confidence=_as_float(data.get("confidence")),
        reject_reason=reject if isinstance(reject, str) else None,
    )


def grounding_judge(
    *,
    field_group: str,
    source_text_ko: str,
    rows: list[dict[str, Any]],
    call_json: Any = None,
    model: str | None = None,
) -> list[GroundingIssue]:
    """Gate 2 (LLM half). Flags values the source doesn't actually support."""
    if not rows:
        return []
    call = call_json or _live_call_json
    system, user = prompts.grounding_judge_prompt(source_text_ko=source_text_ko, rows=rows)
    data = call(system, user, model or _default_model())
    out: list[GroundingIssue] = []
    for item in _as_list(data.get("unsupported")):
        out.append(
            GroundingIssue(
                field_group=field_group,
                row_index=_as_int(item.get("row_index")) or 0,
                field=str(item.get("field") or "?"),
                problem="value_unsupported",
                quote=_str_or_none(item.get("reason")),
            )
        )
    return out


def run_critics(
    *,
    field_group: str,
    source_text_ko: str,
    rows: list[dict[str, Any]],
    target_year: int,
    target_term: str | None,
    call_json: Any = None,
    model: str | None = None,
) -> list[CriticIssue]:
    """Gate 4. Runs the three adversarial critics and returns their issues."""
    if not rows:
        return []
    call = call_json or _live_call_json
    m = model or _default_model()
    issues: list[CriticIssue] = []

    issues += _accuracy(call, m, field_group, source_text_ko, rows)
    issues += _completeness(call, m, field_group, source_text_ko, rows)
    issues += _scope(call, m, field_group, source_text_ko, rows, target_year, target_term)
    return issues


def _accuracy(call, model, field_group, source_text_ko, rows) -> list[CriticIssue]:
    system, user = prompts.accuracy_critic_prompt(source_text_ko=source_text_ko, rows=rows)
    data = _safe_call(call, system, user, model, critic="accuracy")
    return [
        CriticIssue(
            critic="accuracy",
            severity=_as_severity(it.get("severity")),
            problem=str(it.get("problem") or "unsupported value"),
            field_group=field_group,
            row_index=_as_int(it.get("row_index")),
            field=_str_or_none(it.get("field")),
            source_quote=_str_or_none(it.get("source_quote")),
        )
        for it in _as_list(data.get("issues"))
    ]


def _completeness(call, model, field_group, source_text_ko, rows) -> list[CriticIssue]:
    system, user = prompts.completeness_critic_prompt(
        source_text_ko=source_text_ko, rows=rows, field_group=field_group
    )
    data = _safe_call(call, system, user, model, critic="completeness")
    return [
        CriticIssue(
            critic="completeness",
            severity=_as_severity(it.get("severity")),
            problem="missing: " + str(it.get("what") or "required item"),
            field_group=field_group,
            source_quote=_str_or_none(it.get("source_quote")),
        )
        for it in _as_list(data.get("missing"))
    ]


def _scope(call, model, field_group, source_text_ko, rows, target_year, target_term) -> list[CriticIssue]:
    system, user = prompts.scope_critic_prompt(
        source_text_ko=source_text_ko, rows=rows,
        target_year=target_year, target_term=target_term,
    )
    data = _safe_call(call, system, user, model, critic="scope")
    return [
        CriticIssue(
            critic="scope",
            severity="high",   # wrong-audience data is always high — it misleads students
            problem="out of scope: " + str(it.get("actual") or "different audience/year"),
            field_group=field_group,
            row_index=_as_int(it.get("row_index")),
            field=_str_or_none(it.get("field")),
            source_quote=_str_or_none(it.get("source_quote")),
        )
        for it in _as_list(data.get("misscoped"))
    ]


def _safe_call(call, system, user, model, *, critic: str) -> dict[str, Any]:
    """A critic that errors must not sink the whole verification — log + empty."""
    try:
        data = call(system, user, model)
        return data if isinstance(data, dict) else {}
    except Exception as exc:  # a critic failing is non-fatal
        log.warning("verify: %s critic failed: %s: %s", critic, type(exc).__name__, str(exc)[:160])
        return {}


# --- tolerant coercions (LLM output is untrusted) --------------------------

def _as_list(value: object) -> list[dict[str, Any]]:
    return [v for v in value if isinstance(v, dict)] if isinstance(value, list) else []


def _as_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value)
    return None


def _as_float(value: object) -> float:
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def _as_term(value: object) -> str | None:
    return value if value in ("spring", "fall") else None


def _as_severity(value: object) -> str:
    return value if value in ("high", "medium", "low") else "medium"


def _str_or_none(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None
