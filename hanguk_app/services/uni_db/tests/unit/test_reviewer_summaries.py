"""Reviewer-facing summaries (summary_uz / summary_en, label_uz / label_en).

The extraction prompt asks the SAME call to also emit plain-language Uzbek +
English summaries for the review queue. These are OPTIONAL everywhere:
payloads without them must keep validating (old jobs), and payloads with them
must validate too — including on the strict `requirements` row level.
"""

from __future__ import annotations

import jsonschema
import pytest

from uni_db.extract.prompt_assembler import (
    SUMMARY_FIELD_GROUPS,
    assemble_prompt,
)
from uni_db.extract.schemas import FIELD_GROUP_SCHEMAS

REVIEWED_GROUPS = (
    "calendar", "tuition", "requirements", "scholarships", "documents_required",
)


class TestPromptAddendum:
    @pytest.mark.parametrize("group", REVIEWED_GROUPS)
    def test_reviewed_groups_ask_for_summaries(self, group: str) -> None:
        p = assemble_prompt(field_group=group, archetype="A", source_text_ko="원서접수")
        assert "summary_uz" in p.system
        assert "summary_en" in p.system
        assert "label_uz" in p.system

    def test_recruitment_units_is_excluded(self) -> None:
        # Its root schema is additionalProperties: False — a root summary
        # would fail validation, and the group is not human-reviewed.
        p = assemble_prompt(
            field_group="recruitment_units", archetype="A", source_text_ko="모집단위",
        )
        assert "summary_uz" not in p.system
        assert "recruitment_units" not in SUMMARY_FIELD_GROUPS


class TestSchemasAcceptSummaries:
    def test_requirements_payload_with_summaries_and_labels_validates(self) -> None:
        payload = {
            "summary_uz": "Bu universitet kamida TOPIK 3 talab qiladi.",
            "summary_en": "This university requires at least TOPIK 3.",
            "rows": [{
                "source_text_ko": "TOPIK 3급 이상",
                "topik_min_level": 3,
                "label_uz": "Chet elliklar uchun yo'nalish",
                "label_en": "Foreign applicants track",
            }],
        }
        jsonschema.validate(
            instance=payload, schema=FIELD_GROUP_SCHEMAS["requirements"],
        )

    @pytest.mark.parametrize("group", ("tuition", "scholarships", "documents_required"))
    def test_lenient_row_groups_accept_row_labels(self, group: str) -> None:
        row = {"label_uz": "Pasport nusxasi", "label_en": "Passport copy",
               "source_text_ko": "여권 사본"}
        if group == "tuition":
            row.update({"faculty_group": "인문", "academic_year": 2026,
                        "semester_number": 1, "amount_krw": 4200000})
        if group == "scholarships":
            row.update({"scope": "university", "name_ko": "장학금",
                        "award_type": "tuition_waiver_pct"})
        if group == "documents_required":
            row.update({"document_type": "passport_copy"})
        payload = {"summary_uz": "…", "summary_en": "…", "rows": [row]}
        jsonschema.validate(instance=payload, schema=FIELD_GROUP_SCHEMAS[group])

    def test_calendar_payload_with_summaries_validates(self) -> None:
        payload = {
            "summary_uz": "Hujjat topshirish 20-martgacha.",
            "summary_en": "Applications close on 20 March.",
            "events": [{
                "event_type": "apply_close",
                "starts_at": "2026-03-20T17:00:00+09:00",
                "source_text_ko": "원서접수 마감",
            }],
        }
        jsonschema.validate(instance=payload, schema=FIELD_GROUP_SCHEMAS["calendar"])

    def test_old_payload_without_summaries_still_validates(self) -> None:
        payload = {"rows": [{"source_text_ko": "TOPIK 3급 이상", "topik_min_level": 3}]}
        jsonschema.validate(
            instance=payload, schema=FIELD_GROUP_SCHEMAS["requirements"],
        )
