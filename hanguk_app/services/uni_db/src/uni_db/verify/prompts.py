"""The verification prompts. Each returns (system, user). Kept in one place so
prompt regressions are caught in review, mirroring extract/prompt_assembler.

Every prompt hard-forbids outside knowledge — a verifier may only use the text
it is shown — and asks for strict JSON so the caller can parse deterministically.
"""

from __future__ import annotations

import json
from typing import Any

_JSON_ONLY = "Return ONLY a JSON object — no prose, no markdown fences, no commentary."


# ---------------------------------------------------------------------------
# Gate 0 — identity / right-PDF gatekeeper (cheap model)
# ---------------------------------------------------------------------------

def identity_prompt(
    *,
    university_name_ko: str,
    university_name_en: str | None,
    target_year: int,
    target_term: str | None,
    filename: str | None,
    url: str | None,
    head_text: str,
) -> tuple[str, str]:
    term = target_term or "any term"
    system = (
        "You are a strict admissions-document gatekeeper for a Korean university "
        "database. You are given the FIRST PAGES of a downloaded PDF plus its "
        "filename and source URL. Decide ONLY whether this is the exact document "
        f"we want: the {target_year}학년도 ({target_year}, {term}) FOREIGN-applicant "
        f"admission guideline (외국인전형 모집요강) for '{university_name_ko}'"
        + (f" / '{university_name_en}'" if university_name_en else "")
        + ". Do NOT extract admission details. Use ONLY the text shown — no outside "
        "knowledge. If you are unsure of any field, fail closed (set the matching "
        "boolean to false and lower confidence). " + _JSON_ONLY + "\n\n"
        "JSON shape:\n"
        "{\n"
        '  "document_kind": "guideline|notice|correction|results|tender|other",\n'
        '  "university_name_ko_in_doc": string|null,\n'
        '  "matches_target_university": boolean,\n'
        '  "academic_year_in_doc": integer|null,\n'
        '  "term_in_doc": "spring|fall|null",\n'
        '  "matches_target_cycle": boolean,\n'
        '  "audience": "foreign|overseas_korean|domestic|mixed|unclear",\n'
        '  "serves_foreign_applicants": boolean,\n'
        '  "is_old_or_superseded": boolean,\n'
        '  "confidence": number (0..1),\n'
        '  "reject_reason": string|null\n'
        "}"
    )
    user = (
        f"University we are looking for: {university_name_ko}"
        + (f" ({university_name_en})" if university_name_en else "")
        + f"\nTarget cycle: {target_year}학년도, {term}\n"
        f"filename: {filename or '(none)'}\n"
        f"source_url: {url or '(none)'}\n\n"
        "PDF first pages:\n```\n" + head_text + "\n```"
    )
    return system, user


# ---------------------------------------------------------------------------
# Gate 2 — grounding judge: is every value backed by the quote?
# ---------------------------------------------------------------------------

def grounding_judge_prompt(*, source_text_ko: str, rows: list[dict[str, Any]]) -> tuple[str, str]:
    system = (
        "You verify that a structured extraction is fully grounded in its source. "
        "You are given (1) the verbatim Korean source span and (2) JSON rows "
        "extracted from it. For every NON-NULL field of every row, decide whether "
        "the source span EXPLICITLY states that value. Use no outside knowledge and "
        "do not reward plausible-but-unstated values. " + _JSON_ONLY + "\n\n"
        "JSON shape:\n"
        '{ "unsupported": [ {"row_index": int, "field": string, '
        '"value": any, "reason": string} ] }\n'
        "Return an empty array if everything is grounded."
    )
    user = (
        "Source span:\n```\n" + source_text_ko + "\n```\n\n"
        "Extracted rows:\n```json\n"
        + json.dumps(rows, ensure_ascii=False, indent=2)
        + "\n```"
    )
    return system, user


# ---------------------------------------------------------------------------
# Gate 4 — adversarial critics (three lenses)
# ---------------------------------------------------------------------------

def accuracy_critic_prompt(*, source_text_ko: str, rows: list[dict[str, Any]]) -> tuple[str, str]:
    system = (
        "You are a skeptical fact-checker. Given the Korean source span and the "
        "JSON extracted from it, list EVERY value that is WRONG or NOT SUPPORTED by "
        "the source. Default to flagging when uncertain — a false alarm is cheaper "
        "than bad data reaching a student. Use no outside knowledge. " + _JSON_ONLY
        + "\n\nJSON shape:\n"
        '{ "issues": [ {"row_index": int, "field": string, '
        '"severity": "high|medium|low", "problem": string, "source_quote": string|null} ] }\n'
        "Empty array if you find nothing wrong."
    )
    user = _source_and_rows(source_text_ko, rows)
    return system, user


def completeness_critic_prompt(
    *, source_text_ko: str, rows: list[dict[str, Any]], field_group: str
) -> tuple[str, str]:
    system = (
        "You check for OMISSIONS. Given the Korean source span and the JSON "
        f"extracted for the '{field_group}' group, list every REQUIRED item the "
        "source clearly states but the extraction MISSED — a missing deadline, a "
        "required document, a TOPIK level, a tuition row, a scholarship. Only list "
        "items actually present in the source. Use no outside knowledge. " + _JSON_ONLY
        + "\n\nJSON shape:\n"
        '{ "missing": [ {"what": string, "source_quote": string, '
        '"severity": "high|medium|low"} ] }\n'
        "Empty array if nothing required was omitted."
    )
    user = _source_and_rows(source_text_ko, rows)
    return system, user


def scope_critic_prompt(
    *, source_text_ko: str, rows: list[dict[str, Any]], target_year: int, target_term: str | None
) -> tuple[str, str]:
    term = target_term or "any term"
    system = (
        f"Our target audience is FOREIGN applicants (외국인전형) for {target_year}학년도 "
        f"({term}). Flag every extracted row that actually belongs to a DIFFERENT "
        "applicant category (재외국민 overseas-Korean, 북한이탈 defector, 편입 transfer, "
        "정원내 domestic), a DIFFERENT academic year, or a DIFFERENT track. These must "
        "not be shown as our foreign-applicant data. Use no outside knowledge. "
        + _JSON_ONLY + "\n\nJSON shape:\n"
        '{ "misscoped": [ {"row_index": int, "field": string, '
        '"actual": string, "source_quote": string|null} ] }\n'
        "Empty array if every row is in scope."
    )
    user = _source_and_rows(source_text_ko, rows)
    return system, user


def _source_and_rows(source_text_ko: str, rows: list[dict[str, Any]]) -> str:
    return (
        "Source span:\n```\n" + source_text_ko + "\n```\n\n"
        "Extracted rows:\n```json\n"
        + json.dumps(rows, ensure_ascii=False, indent=2)
        + "\n```"
    )
