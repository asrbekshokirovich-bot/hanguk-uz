"""End-to-end pipeline test (fixture-only, no live anything).

Walks the seven contracts in order:

  fixture
    → archetype detector  (signal vector → label)
    → parser              (sections + dates + tuition rows)
    → prompt assembler    (envelope + schema reference)
    → mocked LLM          (deterministic mock_llm output)
    → validator           (per-difficulty HITL gate)
    → review_queue        (entries assembled but not persisted)

Asserts each step's contract independently so failures pinpoint the
broken stage instead of a generic "pipeline failed".
"""

from __future__ import annotations

from uuid import uuid4

import jsonschema
import pytest

from uni_db.extract.archetype import classify_archetype, find_section_offsets
from uni_db.extract.cost_estimator import estimate_full_guideline
from uni_db.extract.llm_anthropic import extract_field_group
from uni_db.extract.prompt_assembler import (
    GlossaryEntry,
    assemble_prompt,
    lookup_schema,
)
from uni_db.extract.validators import evaluate as validate_field
from uni_db.parse.dates_ko import iter_dates_in
from uni_db.parse.sections import detect_tuition_section
from uni_db.workers.parse_worker import parse_one_document

from ..fixtures.archetypes.fixtures import ARCHETYPE_B


@pytest.fixture
def glossary() -> list[GlossaryEntry]:
    return [
        GlossaryEntry(
            term_ko="연세대학교",
            term_value="Yonsei University",
            category="institution_name",
        ),
        GlossaryEntry(
            term_ko="외국인전형",
            term_value="Foreign Applicant Track",
            category="official_term",
        ),
    ]


class TestStageByStage:
    def test_step_1_archetype_detector(self) -> None:
        out = classify_archetype(
            ARCHETYPE_B.korean_text,
            filename=ARCHETYPE_B.filename_hint,
            announcement_title=ARCHETYPE_B.title_hint,
        )
        assert out.label == "B"
        assert out.requires_hitl is False

    def test_step_2_section_detector(self) -> None:
        offsets = find_section_offsets(ARCHETYPE_B.korean_text)
        assert {"calendar", "tuition", "requirements"} <= set(offsets.keys())

    def test_step_3_korean_parsers_normalise_dates(self) -> None:
        dates = list(iter_dates_in(ARCHETYPE_B.korean_text))
        # Yonsei fixture has ≥3 distinct dates (apply open/close + final).
        assert len(dates) >= 3
        # All should be ISO-8601 KST.
        for d in dates:
            assert d.iso8601.endswith("+09:00"), d.iso8601

    def test_step_4_tuition_section_extracts_rows(self) -> None:
        sec = detect_tuition_section(ARCHETYPE_B.korean_text, academic_year=2026)
        groups = {r.faculty_group for r in sec.rows}
        assert "humanities" in groups
        assert "engineering" in groups

    def test_step_5_prompt_assembler_envelope(
        self, glossary: list[GlossaryEntry]
    ) -> None:
        prompt = assemble_prompt(
            field_group="calendar",
            archetype="B",
            source_text_ko=ARCHETYPE_B.korean_text,
            glossary=glossary,
        )
        assert "CALENDAR_SCHEMA" in prompt.system
        assert "Yonsei University" in prompt.system
        assert "연세대학교" in prompt.user

    def test_step_6_mocked_llm_response_validates(self) -> None:
        # extract_field_group returns a deterministic mock when
        # UNI_DB_LIVE_APIS=false (the conftest forces this).
        result = extract_field_group(
            field_group="calendar",
            archetype="B",
            source_text_ko=ARCHETYPE_B.korean_text,
        )
        schema = lookup_schema("CALENDAR_SCHEMA")
        assert schema is not None
        # The mock output already validates inside extract_field_group; this
        # is a belt-and-braces check.
        jsonschema.validate(instance=result.parsed_output, schema=schema)
        assert result.llm_provider == "mock"

    def test_step_7_validator_routes_d4_to_hitl(self) -> None:
        verdict = validate_field(
            field_name="scholarships",
            confidence=0.95,
        )
        assert verdict.requires_hitl is True


class TestFullPipelineIntoReviewQueue:
    """`parse_one_document` walks every stage internally; we assert the
    output shape that the persistence layer would consume."""

    def test_full_pass_yields_extraction_results_and_hitl_entries(self) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=ARCHETYPE_B.korean_text[:1500],
            pdf_text_full=ARCHETYPE_B.korean_text,
        )
        # Archetype routed correctly.
        assert outcome.archetype.label == "B"
        # Five mock field-group runs.
        groups = {r.field_group for r in outcome.extraction_results}
        assert groups == {
            "calendar",
            "tuition",
            "requirements",
            "scholarships",
            "documents_required",
        }
        # Layer 1 queue hygiene: the tuition / scholarships / documents_required
        # mocks are empty ({"rows": []}) → NOT enqueued.
        review_groups = {e["field_group"] for e in outcome.review_queue_entries}
        assert "scholarships" not in review_groups
        assert "documents_required" not in review_groups
        assert "tuition" not in review_groups
        # Fully-automated: both content-bearing groups are queued `approved`.
        # Calendar (high confidence) is clean; requirements (low confidence) is
        # published but flagged needs_attention. Neither waits on a human.
        assert "calendar" in review_groups
        assert "requirements" in review_groups
        by_group = {e["field_group"]: e for e in outcome.review_queue_entries}
        assert by_group["calendar"]["status"] == "approved"
        assert by_group["calendar"]["needs_attention"] is False
        assert by_group["requirements"]["status"] == "approved"
        assert by_group["requirements"]["needs_attention"] is True


class TestCostBudgetGate:
    """The orchestrator's cost gate — we don't actually invoke it here,
    we just assert the envelope numbers stay sane."""

    def test_phase_f3_50_page_envelope_remains_within_budget(self) -> None:
        _, total = estimate_full_guideline(archetype="B", page_count=50)
        # Plan §F.3 ~$1.30 budget; we accept up to ~$4 here to leave
        # room for prompt growth without flapping CI.
        assert total < 4.0
