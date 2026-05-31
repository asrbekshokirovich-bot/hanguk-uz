"""Unit tests for extraction output normalization (Layer 2)."""

import jsonschema

from uni_db.extract.normalize import content_key_for, normalize_output
from uni_db.extract.schemas import FIELD_GROUP_SCHEMAS


class TestContentKey:
    def test_calendar_uses_events(self) -> None:
        assert content_key_for("calendar") == "events"

    def test_others_use_rows(self) -> None:
        for g in ("tuition", "requirements", "scholarships", "documents_required"):
            assert content_key_for(g) == "rows"


class TestNormalizeOutput:
    def test_bare_list_is_wrapped(self) -> None:
        assert normalize_output("scholarships", [{"x": 1}]) == {"rows": [{"x": 1}]}

    def test_bare_list_calendar_uses_events(self) -> None:
        assert normalize_output("calendar", [{"event_type": "apply_open"}]) == {
            "events": [{"event_type": "apply_open"}]
        }

    def test_missing_key_single_array_is_adopted(self) -> None:
        out = normalize_output("scholarships", {"scholarships": [{"a": 1}]})
        assert out == {"rows": [{"a": 1}]}

    def test_missing_key_no_array_defaults_empty(self) -> None:
        assert normalize_output("tuition", {"note": "none found"}) == {
            "note": "none found",
            "rows": [],
        }

    def test_non_dict_non_list_defaults_empty(self) -> None:
        assert normalize_output("tuition", "garbage") == {"rows": []}

    def test_extraction_failed_is_untouched(self) -> None:
        payload = {"_extraction_failed": "boom"}
        assert normalize_output("tuition", payload) == payload

    def test_unknown_calendar_event_type_mapped_to_other(self) -> None:
        out = normalize_output("calendar", {"events": [
            {"event_type": "tuition_payment", "starts_at": "2026-01-01T00:00:00Z"},
            {"event_type": "apply_open", "starts_at": "2026-02-01T00:00:00Z"},
        ]})
        assert out["events"][0]["event_type"] == "other"
        assert out["events"][1]["event_type"] == "apply_open"

    def test_already_valid_rows_unchanged(self) -> None:
        payload = {"rows": [{"scope": "university", "name_ko": "x"}]}
        assert normalize_output("scholarships", payload) == payload


class TestStripTrailingTranslation:
    """`*_ko` fields must stay Korean-only — strip an appended English run."""

    def test_strips_appended_english_after_separator(self) -> None:
        row = {
            "document_type": "transcript",
            "source_text_ko": "y",
            "notes_ko": (
                "한국인 부모가 있는 지원자는 모든 학교의 졸업증명서를 제출하여 "
                "학업이 한국 외에서 완료되었음을 증명해야 한다. "
                "** Applicants of Korean origin with at least one Korean parent "
                "must submit diplomas from all schools attended."
            ),
        }
        out = normalize_output("documents_required", {"rows": [row]})
        note = out["rows"][0]["notes_ko"]
        assert "Applicants of Korean origin" not in note
        assert "졸업증명서를 제출" in note

    def test_strips_appended_english_without_separator(self) -> None:
        text = (
            "마감일 전에 모든 서류를 제출해야 한다. "
            "The applicant must submit all required documents before the deadline."
        )
        out = normalize_output("documents_required", {"rows": [
            {"document_type": "passport", "source_text_ko": "x", "notes_ko": text}
        ]})
        assert "The applicant must submit" not in out["rows"][0]["notes_ko"]

    def test_keeps_short_english_test_names(self) -> None:
        text = "한국어 능력: TOPIK 4급 또는 TOEFL iBT 80 이상 제출"
        out = normalize_output("requirements", {"rows": [
            {"source_text_ko": text}
        ]})
        assert out["rows"][0]["source_text_ko"] == text

    def test_keeps_trailing_url(self) -> None:
        text = "자세한 내용은 다음에서 확인 https://admission.kaist.ac.kr/intl-undergraduate/notice/list/page"
        out = normalize_output("requirements", {"rows": [
            {"source_text_ko": text}
        ]})
        assert out["rows"][0]["source_text_ko"] == text

    def test_english_only_source_text_untouched(self) -> None:
        # No Hangul → nothing to strip (must not blank the field).
        text = "English Proficiency Test scores must be submitted by the deadline."
        out = normalize_output("requirements", {"rows": [
            {"source_text_ko": text}
        ]})
        assert out["rows"][0]["source_text_ko"] == text


class TestCollapseDuplicate:
    def test_exact_doubled_clause_collapses(self) -> None:
        text = "KU 외국인 신입생 장학금 KU 외국인 신입생 장학금"
        out = normalize_output("scholarships", {"rows": [
            {"scope": "university", "name_ko": "x", "source_text_ko": "y",
             "prose_ko": text}
        ]})
        assert out["rows"][0]["prose_ko"] == "KU 외국인 신입생 장학금"

    def test_non_duplicate_prose_unchanged(self) -> None:
        text = "TOPIK 3급 30% / TOPIK 4급 50% / TOPIK 5급 이상 70%"
        out = normalize_output("scholarships", {"rows": [
            {"scope": "university", "name_ko": "x", "source_text_ko": "y",
             "prose_ko": text}
        ]})
        assert out["rows"][0]["prose_ko"] == text


class TestDerivePeriodsFromEvents:
    _EVENTS = {"events": [
        {"event_type": "apply_open", "starts_at": "2026-09-01T09:00:00+09:00", "source_text_ko": "접수 시작"},
        {"event_type": "apply_close", "starts_at": "2026-09-30T17:00:00+09:00", "source_text_ko": "접수 마감"},
        {"event_type": "document_submission_deadline", "starts_at": "2026-10-05T00:00:00+09:00", "source_text_ko": "서류"},
        {"event_type": "interview", "starts_at": "2026-10-15T09:00:00+09:00", "source_text_ko": "면접"},
        {"event_type": "final_results", "starts_at": "2026-11-20T00:00:00+09:00", "source_text_ko": "발표"},
    ]}

    def test_events_become_a_period(self) -> None:
        out = normalize_output("calendar", dict(self._EVENTS))
        assert len(out["periods"]) == 1
        p = out["periods"][0]
        assert p["application_start"].startswith("2026-09-01")
        assert p["application_end"].startswith("2026-09-30")
        assert p["document_deadline"].startswith("2026-10-05")
        assert p["interview_start"].startswith("2026-10-15")
        assert p["result_announcement"].startswith("2026-11-20")
        # derived output must still validate against the calendar schema
        jsonschema.validate(instance=out, schema=FIELD_GROUP_SCHEMAS["calendar"])

    def test_existing_periods_not_overwritten(self) -> None:
        out = normalize_output("calendar", {
            "events": [{"event_type": "apply_open", "starts_at": "2026-09-01T09:00:00+09:00"}],
            "periods": [{"application_start": "2099-01-01"}],
        })
        assert out["periods"] == [{"application_start": "2099-01-01"}]

    def test_empty_events_add_no_period(self) -> None:
        out = normalize_output("calendar", {"events": []})
        assert "periods" not in out


class TestCalendarEventSynonyms:
    def test_document_submission_deadline_mapped(self) -> None:
        out = normalize_output("calendar", {"events": [
            {"event_type": "document_submission_deadline", "starts_at": "2026-10-05T00:00:00+09:00"}]})
        assert out["events"][0]["event_type"] == "documents_deadline"

    def test_result_announcement_mapped_to_final(self) -> None:
        out = normalize_output("calendar", {"events": [
            {"event_type": "result_announcement", "starts_at": "2026-11-20T00:00:00+09:00"}]})
        assert out["events"][0]["event_type"] == "final_results"

    def test_truly_unknown_still_other(self) -> None:
        out = normalize_output("calendar", {"events": [
            {"event_type": "made_up_label", "starts_at": "2026-01-01T00:00:00+09:00"}]})
        assert out["events"][0]["event_type"] == "other"
