"""Prompt assembler.

Plan §F.3 / Audit §5.2. Composes:

  glossary header  +  field-group system message  +  archetype-specific
  few-shot examples  +  user template (with the actual source slice)  +
  strict JSON envelope reminder.

Tests pass synthetic Korean text through the assembler and assert the
final envelope (a) is well-formed, (b) embeds the required tokens
(authoritative glossary terms, schema reminders, source span markers),
and (c) is stable enough that prompt regressions are caught in code
review via `extract.prompts.snapshots`.
"""

from __future__ import annotations

from dataclasses import dataclass
from importlib.resources import files
from typing import Iterable, Literal

from .schemas import FIELD_GROUP_SCHEMAS

FieldGroup = Literal[
    "calendar",
    "tuition",
    "basic_requirements",
    "recruitment_units",
    "document_checklist",
    # Old aliases — kept for backwards compatibility with Phase 0 callers.
    "requirements",
    "scholarships",
    "documents_required",
]

# Mapping from field_group → markdown filename in the prompts/ subfolder.
PROMPT_FILES: dict[FieldGroup, str] = {
    "calendar":            "calendar.md",
    "tuition":             "tuition.md",
    # `basic_requirements` and `requirements` both resolve to the same
    # prompt file — historically there were two divergent versions
    # (basic_requirements.md had a worked example; requirements.md did
    # not). The terser file was the one actually invoked by parse_worker
    # via the `requirements` alias, which is why KAIST `requirements`
    # extractions hallucinated more than the other field groups. The
    # files were consolidated into requirements.md (with rows-array
    # output + 3 few-shots including the empty case).
    "basic_requirements":  "requirements.md",
    "recruitment_units":   "recruitment_units.md",
    "document_checklist":  "document_checklist.md",
    # Phase 0 aliases:
    "requirements":        "requirements.md",
    "scholarships":        "scholarships.md",
    "documents_required":  "documents_required.md",
}

ARCHETYPE_FEWSHOT_FILES: dict[str, str] = {
    "A": "_archetype_a_few_shots.md",
    "B": "_archetype_b_few_shots.md",
    "C": "_archetype_c_few_shots.md",
    "D": "_archetype_d_few_shots.md",
    "E": "_archetype_e_few_shots.md",
    "F": "_archetype_f_few_shots.md",
    "G": "_archetype_g_few_shots.md",
    "H": "_archetype_h_few_shots.md",
}


@dataclass(frozen=True, slots=True)
class GlossaryEntry:
    term_ko: str
    term_value: str
    category: str


@dataclass(frozen=True, slots=True)
class AssembledPrompt:
    system: str
    user: str
    schema_name: str
    estimated_input_tokens: int


def _read_prompt_file(filename: str) -> str:
    """Load a prompt fragment via importlib.resources so it works whether
    the package is installed or run from the source tree."""
    package = files("uni_db.extract.prompts")
    return (package / filename).read_text(encoding="utf-8")


def _render_glossary(entries: Iterable[GlossaryEntry]) -> str:
    lines = [
        "# Authoritative glossary",
        "",
        "Use these mappings verbatim. Do NOT translate them.",
        "",
    ]
    for e in entries:
        lines.append(f"- **{e.term_ko}** → {e.term_value} _(category: {e.category})_")
    return "\n".join(lines)


def _correction_notice_addendum() -> str:
    """Audit §6.5 — when the source bears 정정공고 / 변경공고 / 일정변경
    we tell the model to extract the *amended* values and label them
    so the diff engine knows to upgrade priority.
    """
    return (
        "## Correction-notice handling\n\n"
        "If the source contains the markers 정정공고, 변경공고, or 일정변경, "
        "treat the document as an AMENDMENT to a prior guideline. For each "
        "extracted row, set `is_correction_notice=true` and copy the "
        "verbatim sentence describing the change into `correction_text_ko`. "
        "Do not silently merge corrected values with prior values — emit "
        "ONLY the corrected ones and let the downstream diff engine record "
        "the supersession.\n"
    )


def _language_eligibility_addendum() -> str:
    """Audit follow-up — capture BOTH language-eligibility routes.

    Our applicants qualify on either the Korean (TOPIK) or the English
    (IELTS/TOEFL) track, so dropping one route silently excludes a whole cohort
    of qualified students. Applied to the requirements group only.
    """
    return (
        "## Language eligibility — capture BOTH tracks\n\n"
        "Applicants qualify on EITHER track: Korean (TOPIK) or English "
        "(IELTS / TOEFL / Duolingo / TEPS). When the source lists a Korean-track "
        "requirement AND an English-track requirement, extract BOTH with their "
        "numeric cutoffs — never drop one. Put the Korean requirement in "
        "`topik_min_level` / `topik_status`, and the English requirement in "
        "`english_test` (the specific test + `min_score`) / `english_status`. Use "
        "`not_required` when the source explicitly waives a test (면제) and "
        "`not_stated` when the excerpt is silent — never invent a cutoff.\n"
    )


def _footnote_addendum() -> str:
    return (
        "## Footnote handling\n\n"
        "Korean admissions tables mark exceptions in 비고 (remarks) columns "
        "or as 註 footnotes (often `※` / `*` glyphs). Always preserve the "
        "footnote's verbatim Korean in `notes_ko`; encode the structured "
        "exception (e.g. `applicant_category=재외국민` only) into the "
        "appropriate row field. Never drop a footnote silently.\n"
    )


def assemble_prompt(
    *,
    field_group: FieldGroup,
    archetype: str,
    source_text_ko: str,
    glossary: Iterable[GlossaryEntry] = (),
) -> AssembledPrompt:
    if field_group not in PROMPT_FILES:
        raise ValueError(f"unknown field_group: {field_group}")

    schema_name = field_group.upper() + "_SCHEMA"

    glossary_md = _render_glossary(list(glossary)) if glossary else ""
    field_group_md = _read_prompt_file(PROMPT_FILES[field_group])
    language_md = (
        _language_eligibility_addendum()
        if field_group in ("requirements", "basic_requirements")
        else ""
    )
    archetype_md = ""
    if archetype in ARCHETYPE_FEWSHOT_FILES:
        try:
            archetype_md = _read_prompt_file(ARCHETYPE_FEWSHOT_FILES[archetype])
        except FileNotFoundError:        # pragma: no cover — defensive
            archetype_md = ""

    system = "\n\n".join(
        section
        for section in (
            glossary_md,
            field_group_md,
            language_md,
            archetype_md,
            _correction_notice_addendum(),
            _footnote_addendum(),
            "## Output\n\nReturn ONLY a JSON object that validates against "
            f"`{schema_name}` (defined in extract/schemas.py). "
            "No prose, no markdown code fences, no commentary.",
        )
        if section
    )

    user = (
        "Source span (Korean source-of-truth — preserve verbatim in "
        "`source_text_ko` for every emitted row):\n\n"
        "```\n"
        f"{source_text_ko}\n"
        "```\n"
    )

    estimated = _estimate_tokens(system) + _estimate_tokens(user)
    return AssembledPrompt(
        system=system,
        user=user,
        schema_name=schema_name,
        estimated_input_tokens=estimated,
    )


def _estimate_tokens(text: str) -> int:
    """Rough Korean-aware token estimate.

    Anthropic's tokenizer treats Korean syllables as ~1 token each plus
    bookkeeping; English at roughly 4 chars/token. We blend the two by
    counting Hangul codepoints separately.
    """
    if not text:
        return 0
    hangul = sum(1 for ch in text if "가" <= ch <= "힣")
    other = len(text) - hangul
    return hangul + max(1, other // 4)


def lookup_schema(schema_name: str) -> dict[str, object] | None:
    """Resolve a SCHEMA name back to the dict in `schemas.py`."""
    key = schema_name.removesuffix("_SCHEMA").lower()
    aliases = {
        "calendar": "calendar",
        "tuition": "tuition",
        "basic_requirements": "requirements",   # canonical schema is `requirements`
        "recruitment_units": "recruitment_units",
        "document_checklist": "documents_required",
        "requirements": "requirements",
        "scholarships": "scholarships",
        "documents_required": "documents_required",
    }
    canonical = aliases.get(key, key)
    return FIELD_GROUP_SCHEMAS.get(canonical)
