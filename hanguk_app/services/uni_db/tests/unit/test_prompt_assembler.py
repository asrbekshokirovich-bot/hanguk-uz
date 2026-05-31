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
