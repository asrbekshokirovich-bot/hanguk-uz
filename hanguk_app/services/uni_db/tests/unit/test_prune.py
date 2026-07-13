"""Schema-guided pruning: validation strips unknown keys instead of rejecting.

Covers the production failure taxonomy: unexpected-but-real fields
(is_correction_notice, label_ko, duration, …) must never fail a whole job;
the newly modelled fields must validate as first-class; and a job may only
fail when required core fields are absent after pruning.
"""

from __future__ import annotations

import jsonschema
import pytest

from uni_db.extract.prune import prune_to_schema
from uni_db.extract.schemas import FIELD_GROUP_SCHEMAS


def _validate(field_group: str, payload: dict) -> None:
    jsonschema.validate(instance=payload, schema=FIELD_GROUP_SCHEMAS[field_group])


# --------------------------------------------------------------------------- #
# prune-not-reject


class TestPruneStrictLevels:
    def test_requirements_row_unknown_key_is_pruned_not_rejected(self) -> None:
        # requirements rows are additionalProperties:False — historically one
        # wrong-group field (document_type) failed the whole job.
        payload = {"rows": [{
            "source_text_ko": "TOPIK 3급 이상",
            "topik_min_level": 3,
            "document_type": "hallucinated-from-another-group",
        }]}
        pruned, dropped = prune_to_schema("requirements", payload)
        assert dropped == ("$.rows[0].document_type",)
        assert "document_type" not in pruned["rows"][0]
        assert pruned["rows"][0]["topik_min_level"] == 3
        _validate("requirements", pruned)  # must now pass

    def test_nested_english_test_unknown_key_pruned(self) -> None:
        payload = {"rows": [{
            "source_text_ko": "IELTS 5.5",
            "english_test": {"ielts": 5.5, "notes": "unmodelled"},
        }]}
        pruned, dropped = prune_to_schema("requirements", payload)
        assert dropped == ("$.rows[0].english_test.notes",)
        assert pruned["rows"][0]["english_test"] == {"ielts": 5.5}
        _validate("requirements", pruned)

    def test_recruitment_units_row_pruned(self) -> None:
        payload = {"rows": [{
            "faculty_ko": "공과대학", "department_ko": "기계공학과",
            "source_text_ko": "x", "made_up_field": 1,
        }]}
        pruned, dropped = prune_to_schema("recruitment_units", payload)
        assert dropped == ("$.rows[0].made_up_field",)
        _validate("recruitment_units", pruned)

    def test_lenient_levels_keep_extras(self) -> None:
        # documents_required rows tolerate extras — pruning must NOT eat them.
        payload = {"rows": [{
            "source_text_ko": "여권 사본", "copies": 2, "weird_extra": True,
        }]}
        pruned, dropped = prune_to_schema("documents_required", payload)
        assert dropped == ()
        assert pruned["rows"][0]["copies"] == 2
        assert pruned["rows"][0]["weird_extra"] is True
        _validate("documents_required", pruned)

    def test_input_is_not_mutated(self) -> None:
        payload = {"rows": [{"source_text_ko": "x", "document_type": "drop-me"}]}
        prune_to_schema("requirements", payload)
        assert "document_type" in payload["rows"][0]

    def test_unknown_field_group_passthrough(self) -> None:
        payload = {"rows": [{"anything": 1}]}
        pruned, dropped = prune_to_schema("not_a_group", payload)
        assert pruned == payload and dropped == ()


class TestRequiredCoreFieldsStillFail:
    def test_missing_required_field_fails_after_pruning(self) -> None:
        # A tuition row without its required core fields must STILL fail —
        # pruning never invents data.
        payload = {"rows": [{"faculty_group": "인문"}]}
        pruned, _ = prune_to_schema("tuition", payload)
        with pytest.raises(jsonschema.ValidationError):
            _validate("tuition", pruned)

    def test_missing_rows_wrapper_fails(self) -> None:
        pruned, _ = prune_to_schema("tuition", {"note": "no rows here"})
        with pytest.raises(jsonschema.ValidationError):
            _validate("tuition", pruned)


# --------------------------------------------------------------------------- #
# each newly modelled schema field validates as first-class


class TestNewSchemaFields:
    def test_calendar_top_level_meta_fields(self) -> None:
        payload = {
            "events": [{
                "event_type": "apply_open",
                "starts_at": "2026-09-01T09:00:00+09:00",
                "source_text_ko": "원서접수",
                "is_correction_notice": True,
                "correction_text_ko": "일정 변경",
                "admission_track": "외국인전형",
                "target_semester": "2027-1",
            }],
            "is_correction_notice": True,
            "correction_text_ko": "정정공고",
            "admission_track": "외국인전형",
            "target_semester": "2027-1",
            "notes_ko": "비고",
        }
        pruned, dropped = prune_to_schema("calendar", payload)
        assert dropped == ()
        _validate("calendar", pruned)
        assert pruned["is_correction_notice"] is True
        assert pruned["events"][0]["admission_track"] == "외국인전형"

    def test_scholarships_row_duration(self) -> None:
        payload = {"rows": [{
            "scope": "university", "name_ko": "성적우수장학",
            "award_type": "tuition_waiver_pct", "source_text_ko": "x",
            "duration": "첫 학기", "notes_ko": "비고",
        }]}
        pruned, dropped = prune_to_schema("scholarships", payload)
        assert dropped == ()
        _validate("scholarships", pruned)
        assert pruned["rows"][0]["duration"] == "첫 학기"

    def test_documents_required_label_and_flags(self) -> None:
        payload = {"rows": [{
            "source_text_ko": "졸업증명서 (공증 및 번역 필수)",
            "label_ko": "졸업증명서", "label_en": "Graduation certificate",
            "is_notarization_required": True,
            "is_translation_required": True,
            "applicant_category": "외국인전형",
        }]}
        pruned, dropped = prune_to_schema("documents_required", payload)
        assert dropped == ()
        _validate("documents_required", pruned)
        assert pruned["rows"][0]["is_notarization_required"] is True

    def test_requirements_korean_hours_min(self) -> None:
        payload = {"rows": [{
            "source_text_ko": "한국어연수 800시간 이수자",
            "korean_hours_min": 800,
        }]}
        pruned, dropped = prune_to_schema("requirements", payload)
        assert dropped == ()
        _validate("requirements", pruned)
        assert pruned["rows"][0]["korean_hours_min"] == 800
