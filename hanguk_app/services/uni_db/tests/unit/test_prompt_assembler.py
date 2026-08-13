"""Prompt assembler tests.

Asserts the assembled envelope:
  * embeds the authoritative glossary block
  * cites the JSON schema by name
  * embeds the source span verbatim
  * resolves the right archetype calibration file when one exists
  * dispatches via the FIELD_GROUP_SCHEMAS registry for validation
"""

import json

import jsonschema
import pytest

from uni_db.extract.prompt_assembler import (
    GlossaryEntry,
    assemble_combined_prompt,
    assemble_prompt,
    lookup_schema,
)
from uni_db.extract.schemas import FIELD_GROUP_SCHEMAS


@pytest.fixture
def glossary() -> list[GlossaryEntry]:
    return [
        GlossaryEntry(
            term_ko="외국인전형",
            term_value="Foreign Applicant Track",
            category="official_term",
        ),
        GlossaryEntry(
            term_ko="모집요강",
            term_value="Admission Guidelines",
            category="official_term",
        ),
    ]


class TestEnvelope:
    def test_calendar_envelope_contains_required_pieces(
        self, glossary: list[GlossaryEntry]
    ) -> None:
        out = assemble_prompt(
            field_group="calendar",
            archetype="B",
            source_text_ko="원서접수: 2026.09.01 ~ 09.30",
            glossary=glossary,
        )
        # Authoritative glossary embedded
        assert "외국인전형" in out.system
        assert "Foreign Applicant Track" in out.system
        # Schema name referenced
        assert "CALENDAR_SCHEMA" in out.system
        # Archetype calibration loaded
        assert "Archetype B" in out.system
        # Source verbatim in user message
        assert "원서접수: 2026.09.01 ~ 09.30" in out.user
        # Token estimate > 0
        assert out.estimated_input_tokens > 0

    def test_unknown_archetype_falls_back_quietly(self) -> None:
        out = assemble_prompt(
            field_group="tuition",
            archetype="Z",                    # not in {A..H}
            source_text_ko="등록금 4,800,000원",
            glossary=[],
        )
        assert "TUITION_SCHEMA" in out.system
        # No archetype block was loaded for Z but the assembler succeeds
        assert "Archetype Z" not in out.system

    def test_correction_addendum_included_for_every_group(
        self, glossary: list[GlossaryEntry]
    ) -> None:
        for group in (
            "calendar",
            "tuition",
            "basic_requirements",
            "recruitment_units",
            "document_checklist",
        ):
            out = assemble_prompt(
                field_group=group,         # type: ignore[arg-type]
                archetype="B",
                source_text_ko="...",
                glossary=glossary,
            )
            assert "정정공고" in out.system, f"missing correction handling in {group}"
            assert "비고" in out.system, f"missing footnote handling in {group}"


class TestSchemaResolution:
    def test_lookup_schema_resolves_aliases(self) -> None:
        for alias in (
            "CALENDAR_SCHEMA",
            "TUITION_SCHEMA",
            "BASIC_REQUIREMENTS_SCHEMA",
            "RECRUITMENT_UNITS_SCHEMA",
            "DOCUMENT_CHECKLIST_SCHEMA",
            "REQUIREMENTS_SCHEMA",
            "DOCUMENTS_REQUIRED_SCHEMA",
        ):
            schema = lookup_schema(alias)
            assert schema is not None, alias

    def test_lookup_schema_returns_none_for_garbage(self) -> None:
        assert lookup_schema("NOT_A_SCHEMA") is None


class TestMockedLLMRoundTrip:
    """Pass synthetic Korean text through the assembler and assert the
    JSON envelope a mocked LLM would return validates.
    """

    def test_calendar_mock_validates(self, glossary: list[GlossaryEntry]) -> None:
        prompt = assemble_prompt(
            field_group="calendar",
            archetype="B",
            source_text_ko="원서접수: 2026.09.01 ~ 09.30",
            glossary=glossary,
        )
        # Simulate the LLM honouring the schema
        mock_response = {
            "events": [
                {
                    "event_type": "apply_open",
                    "starts_at": "2026-09-01T09:00:00+09:00",
                    "source_text_ko": "원서접수: 2026.09.01",
                    "extractor_confidence": 0.95,
                }
            ]
        }
        schema = lookup_schema(prompt.schema_name)
        assert schema is not None
        jsonschema.validate(instance=mock_response, schema=schema)

    def test_recruitment_units_mock_validates(self) -> None:
        prompt = assemble_prompt(
            field_group="recruitment_units",
            archetype="C",
            source_text_ko="공과대학 | 컴퓨터공학과 | 30",
            glossary=[],
        )
        mock_response = {
            "rows": [
                {
                    "faculty_ko": "공과대학",
                    "department_ko": "컴퓨터공학과",
                    "faculty_group": "engineering",
                    "quota": 30,
                    "is_in_quota": True,
                    "applicant_category": "외국인전형",
                    "is_correction_notice": False,
                    "source_text_ko": "공과대학 | 컴퓨터공학과 | 30",
                    "extractor_confidence": 0.93,
                }
            ]
        }
        schema = FIELD_GROUP_SCHEMAS["recruitment_units"]
        jsonschema.validate(instance=mock_response, schema=schema)

        # Just to make sure the round-trip is JSON-clean.
        json.dumps(mock_response, ensure_ascii=False)


class TestVerbatimQuoteRule:
    """`source_text_ko` is a citation a reviewer can ctrl-F, not a description.

    "preserve verbatim" alone was not enough. Against real guidelines the model
    built sentences of its own — joining a faculty cell to a number cell with
    an em dash and adding a label the document never used:

        "융합인재대학 — 첫 학기 등록금 5,339,000원"

    No such string is in the source, so every row like it is flagged
    `quote_not_in_source` and the card goes RED — burying a correct extraction
    under a citation problem, and taking away the one thing that would let a
    reviewer check it quickly.
    """

    def _user(self) -> str:
        return assemble_prompt(
            field_group="tuition", archetype="H",
            source_text_ko="인문대학 4,496,000원",
        ).user

    def test_the_quote_must_be_an_unbroken_substring(self) -> None:
        user = self._user()
        assert "UNBROKEN" in user
        assert "CHARACTER-FOR-CHARACTER" in user

    def test_it_forbids_the_failure_modes_seen_in_the_wild(self) -> None:
        user = self._user()
        # Joining separated cells is exactly what produced the em-dash
        # sentences, and adding a label is the other half of it.
        assert "join fragments" in user
        assert "add words, labels, dashes" in user
        assert "summarise" in user

    def test_it_says_what_to_do_when_the_value_spans_cells(self) -> None:
        # A rule that only forbids leaves the model to invent a way out.
        user = self._user()
        assert "carries the number" in user
        assert "extractor_confidence" in user

    def test_it_states_the_consequence(self) -> None:
        # Without this the model trades a "nicer" quote against correctness.
        assert "fabricated" in self._user()

    def test_the_source_span_still_reaches_the_model(self) -> None:
        # The rule must not have displaced the payload it describes.
        assert "인문대학 4,496,000원" in self._user()

    def test_the_combined_call_carries_the_same_rule(self) -> None:
        # Single-call mode shares the failure mode, so it must share the rule.
        user = assemble_combined_prompt(
            archetype="H",
            source_text_ko="인문대학 4,496,000원",
            groups=("tuition", "calendar"),
        ).user
        assert "UNBROKEN" in user
        assert "인문대학 4,496,000원" in user
