"""Review payload completeness + partial re-parse.

group_summary() gives every review card a per-group digest (counts + key
values) so the admin queue shows more than deadlines. `only_groups` lets
retry-failed re-extract just the failed groups. Dropped-prune keys are logged
onto the persisted job.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from uni_db.extract.llm_anthropic import ExtractionResult
from uni_db.workers.parse_worker import (
    ParseOutcome,
    group_summary,
    parse_one_document,
    persist_outcome,
)


class TestGroupSummary:
    def test_calendar_counts_and_date_range(self) -> None:
        parsed = {
            "events": [
                {"event_type": "apply_open", "starts_at": "2026-09-01T09:00:00+09:00"},
                {"event_type": "apply_close", "starts_at": "2026-09-30T17:00:00+09:00"},
            ],
            "periods": [{"application_start": "2026-09-01"}],
        }
        s = group_summary("calendar", parsed)
        assert s.startswith("[calendar]")
        assert "2 event(s), 1 period(s)" in s
        assert "2026-09-01..2026-09-30" in s

    def test_tuition_range(self) -> None:
        parsed = {"rows": [{"amount_krw": 3_500_000}, {"amount_krw": 5_200_000}]}
        s = group_summary("tuition", parsed)
        assert "2 tuition row(s)" in s
        assert "₩3,500,000–₩5,200,000" in s

    def test_requirements_topik_hours_and_majors(self) -> None:
        parsed = {"rows": [
            {"topik_min_level": 3, "korean_hours_min": 800,
             "majors": ["경영학과", "컴퓨터공학과"]},
            {"topik_min_level": 4},
        ]}
        s = group_summary("requirements", parsed)
        assert "2 track(s)" in s
        assert "TOPIK min 3" in s
        assert "Korean hours min 800" in s
        assert "2 major(s)" in s

    def test_scholarships_names(self) -> None:
        parsed = {"rows": [{"name_ko": "성적우수장학"}, {"name_ko": "TOPIK장학"}]}
        s = group_summary("scholarships", parsed)
        assert "2 scholarship(s)" in s and "성적우수장학" in s

    def test_documents_names(self) -> None:
        parsed = {"rows": [{"document_type": "여권"}, {"label_ko": "졸업증명서"}]}
        s = group_summary("documents_required", parsed)
        assert "2 document(s)" in s and "여권" in s and "졸업증명서" in s

    def test_non_dict_is_empty(self) -> None:
        assert group_summary("tuition", None) == ""


class TestReviewEntryCarriesSummary:
    def test_rationale_includes_group_summary(self) -> None:
        # Mock LLM path (live_apis=false): the calendar mock has 2 events, and
        # the review entry rationale must carry the [calendar] digest.
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages="2027학년도 외국인 특별전형 모집요강",
            pdf_text_full="원서접수 2026.09.01 ~ 2026.09.30",
            verify_level="off",
        )
        cal = [e for e in outcome.review_queue_entries
               if e.get("field_group") == "calendar"]
        assert cal, "calendar mock produces a content-bearing entry"
        assert "[calendar]" in str(cal[0]["rationale"])
        assert "event(s)" in str(cal[0]["rationale"])


class TestOnlyGroups:
    def test_only_groups_restricts_extraction(self) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages="모집요강",
            pdf_text_full="본문",
            verify_level="off",
            only_groups=["tuition", "documents_required"],
        )
        groups = [r.field_group for r in outcome.extraction_results]
        assert groups == ["tuition", "documents_required"]


class _FakeConn:
    def __init__(self) -> None:
        self.executes: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *args: object) -> str:
        self.executes.append((" ".join(sql.split()), args))
        return "OK"


async def test_dropped_keys_logged_on_persisted_job() -> None:
    result = ExtractionResult(
        field_group="requirements",
        parsed_output={"rows": [{"source_text_ko": "x"}]},
        raw_output="{}",
        llm_provider="anthropic", llm_model="m",
        input_tokens=0, output_tokens=0, cost_usd=0.0, latency_ms=0,
        accuracy_self_score=0.8,
        dropped_keys=("$.rows[0].document_type",),
    )
    outcome = ParseOutcome(
        guideline_document_id=uuid4(),
        archetype=SimpleNamespace(label="A"),
        degree=SimpleNamespace(is_combined=False),
        extraction_results=[result],
        review_queue_entries=[],
    )
    conn = _FakeConn()
    await persist_outcome(conn, outcome)
    job_insert = next(
        args for sql, args in conn.executes
        if "insert into public.extraction_jobs" in sql
    )
    assert any(
        isinstance(a, str) and "pruned unknown keys: $.rows[0].document_type" in a
        for a in job_insert
    )
