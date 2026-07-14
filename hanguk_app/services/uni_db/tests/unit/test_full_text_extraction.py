"""Phase 2 — kill slice starvation.

Covers: full-document extraction when the text fits the token budget; the
TOC-aware / prefer-last-match anchor slicer for over-budget documents; the
appendix tail fallback; the single-call (all groups in one prompt) mode with
per-group fallback; real llm_provider on failed jobs; and the single-call
response pipeline (fence stripping + schema pruning + per-group validation).
"""

from __future__ import annotations

import copy
import json
from uuid import uuid4

import pytest

from uni_db.config import settings
from uni_db.extract import llm_anthropic, llm_cli
from uni_db.extract.llm_anthropic import _MOCK_OUTPUTS, ExtractionResult
from uni_db.extract.prompt_assembler import assemble_combined_prompt
from uni_db.workers import parse_worker
from uni_db.workers.parse_worker import (
    _anchor_slice,
    _failed_result,
    _fits_full_doc,
    _section_texts,
    _toc_boundary,
)

# ---------------------------------------------------------------------------
# Synthetic over-budget document: 2 TOC-ish pages, then body sections whose
# real detail tables sit late in the document (like the audited PDFs).
# ---------------------------------------------------------------------------


def _synthetic_doc() -> str:
    toc_page = (
        "2027학년도 외국인 특별전형 모집요강\n"
        "목차\n"
        "전형일정 ·········· 3\n"
        "지원자격 ·········· 5\n"
        "제출서류 ·········· 12\n"
    )
    notice_page = "유의사항 안내\n" + "안내 문구 " * 50
    calendar_summary = "전형일정 요약: 아래 참조\n" + "요약 내용 " * 400
    calendar_detail = "전형일정 상세표 시작\n" + "일정 상세 " * 1200
    requirements = "지원자격 안내\n" + "자격 상세 " * 1200
    documents = "제출서류 안내 목록\n" + "서류 상세 " * 1200
    tuition = "등록금 납부 안내\n" + "등록금 상세 " * 1200
    scholarships = "장학금 제도 안내\n" + "장학 상세 " * 1200
    return (
        toc_page + "\f" + notice_page + "\f"
        + calendar_summary + calendar_detail + requirements
        + documents + tuition + scholarships
    )


class TestFullDocMode:
    def test_small_doc_gets_full_text_for_every_group(self) -> None:
        text = "2027학년도 모집요강\n전형일정\n등록금\n" + "본문 " * 200
        assert _fits_full_doc(text)
        sections = _section_texts(text, parse_worker.FIELD_GROUPS)
        assert all(sections[g] == text for g in parse_worker.FIELD_GROUPS)

    def test_over_budget_doc_gets_anchor_slices(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "extract_fulldoc_token_budget", 10)
        text = _synthetic_doc()
        assert not _fits_full_doc(text)
        sections = _section_texts(text, parse_worker.FIELD_GROUPS)
        for g in parse_worker.FIELD_GROUPS:
            assert sections[g] != text
            assert len(sections[g]) < len(text)


class TestAnchorSlice:
    def test_toc_boundary_uses_page_breaks(self) -> None:
        text = "page1\fpage2\fpage3"
        assert _toc_boundary(text) == text.rfind("\f")

    def test_prefers_last_match_over_early_summary(self) -> None:
        # 전형일정 appears on the TOC page (dropped), in an early body summary,
        # and at the late detail table — the LAST match must win.
        out = _anchor_slice(_synthetic_doc(), "calendar")
        assert out.startswith("전형일정 상세표 시작")
        assert "요약 내용" not in out

    def test_dot_leader_line_after_body_is_still_dropped(self) -> None:
        # An index line deep in the document (dot leaders → page number) must
        # not beat the real section even though it comes later.
        text = (
            "page1\fpage2\f" + "본문 " * 2000
            + "등록금 납부 안내\n" + "등록금 상세 " * 1200
            + "\n찾아보기\n등록금 ·········· 44\n" + "끝 " * 50
        )
        out = _anchor_slice(text, "tuition")
        assert out.startswith("등록금 납부 안내")

    def test_window_runs_to_next_anchor(self) -> None:
        out = _anchor_slice(_synthetic_doc(), "documents_required")
        assert out.startswith("제출서류 안내 목록")
        # The next section (tuition detail body) is not swallowed.
        assert "등록금 상세" not in out

    def test_appendix_group_without_anchor_scans_from_document_end(self) -> None:
        text = "서문 안내문 " * 4000 + "말미의 부록 표 끝999"
        out = _anchor_slice(text, "tuition")
        assert out.endswith("끝999")
        assert not text.startswith(out)  # tail window, not the head fallback

    def test_non_appendix_group_without_anchor_keeps_head_fallback(self) -> None:
        text = "서문 안내문 " * 4000 + "말미 내용"
        out = _anchor_slice(text, "calendar")
        assert text.startswith(out)
        assert len(out) < len(text)

    def test_anchor_recurring_in_own_body_starts_at_section_heading(self) -> None:
        # 등록금 appears on every row of the tuition table; the window must
        # start at the section heading (first match of the last cluster),
        # not at the table's final row.
        out = _anchor_slice(_synthetic_doc(), "tuition")
        assert out.startswith("등록금 납부 안내")


class TestFailedResultProvider:
    def test_records_configured_backend(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "live_apis", True)
        monkeypatch.setattr(settings, "llm_backend", "claude_cli")
        failed = _failed_result("tuition", violation="boom")
        assert failed.llm_provider == "claude_cli"
        assert failed.llm_model == settings.anthropic_model_extract

        monkeypatch.setattr(settings, "llm_backend", "anthropic")
        assert _failed_result("tuition", violation="x").llm_provider == "anthropic"

        monkeypatch.setattr(settings, "live_apis", False)
        assert _failed_result("tuition", violation="x").llm_provider == "mock"


# ---------------------------------------------------------------------------
# Single-call (all groups, one prompt) mode
# ---------------------------------------------------------------------------


def _ok_result(group: str) -> ExtractionResult:
    parsed = _MOCK_OUTPUTS[group]
    return ExtractionResult(
        field_group=group,
        parsed_output=parsed,
        raw_output=json.dumps(parsed, ensure_ascii=False),
        llm_provider="claude_cli",
        llm_model="claude-sonnet-4-6",
        input_tokens=10,
        output_tokens=5,
        cost_usd=0.0,
        latency_ms=1,
        accuracy_self_score=0.9,
    )


class TestSingleCallMode:
    def test_combined_results_skip_per_group_calls(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "extract_single_call", True)
        called: dict[str, object] = {}

        def fake_all(**kw):
            called["groups"] = kw["groups"]
            return {g: _ok_result(g) for g in kw["groups"]}

        def explode(**kw):
            raise AssertionError("per-group path must not run when the "
                                 "combined call covered every group")

        monkeypatch.setattr(parse_worker, "extract_all_groups", fake_all)
        monkeypatch.setattr(parse_worker, "extract_field_group", explode)

        outcome = parse_worker.parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages="2027학년도 모집요강",
            pdf_text_full="본문 " * 200,
            verify_level="off",
        )
        assert called["groups"] == parse_worker.FIELD_GROUPS
        assert len(outcome.extraction_results) == len(parse_worker.FIELD_GROUPS)

    def test_missing_group_falls_back_to_per_group_call(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "extract_single_call", True)
        fallback_groups: list[str] = []

        def fake_all(**kw):
            return {g: _ok_result(g) for g in kw["groups"] if g != "tuition"}

        def fake_group(*, field_group, archetype, source_text_ko):
            fallback_groups.append(field_group)
            return _ok_result(field_group)

        monkeypatch.setattr(parse_worker, "extract_all_groups", fake_all)
        monkeypatch.setattr(parse_worker, "extract_field_group", fake_group)

        parse_worker.parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages="2027학년도 모집요강",
            pdf_text_full="본문 " * 200,
            verify_level="off",
        )
        assert fallback_groups == ["tuition"]

    def test_combined_call_failure_falls_back_entirely(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "extract_single_call", True)
        fallback_groups: list[str] = []

        def fake_all(**kw):
            raise RuntimeError("boom")

        def fake_group(*, field_group, archetype, source_text_ko):
            fallback_groups.append(field_group)
            return _ok_result(field_group)

        monkeypatch.setattr(parse_worker, "extract_all_groups", fake_all)
        monkeypatch.setattr(parse_worker, "extract_field_group", fake_group)

        parse_worker.parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages="모집요강",
            pdf_text_full="본문 " * 200,
            verify_level="off",
        )
        assert fallback_groups == list(parse_worker.FIELD_GROUPS)

    def test_single_call_skipped_for_over_budget_docs(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "extract_single_call", True)
        monkeypatch.setattr(settings, "extract_fulldoc_token_budget", 10)

        def explode(**kw):
            raise AssertionError("single-call must not run over budget")

        seen: list[str] = []

        def fake_group(*, field_group, archetype, source_text_ko):
            seen.append(field_group)
            return _ok_result(field_group)

        monkeypatch.setattr(parse_worker, "extract_all_groups", explode)
        monkeypatch.setattr(parse_worker, "extract_field_group", fake_group)

        parse_worker.parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages="모집요강",
            pdf_text_full=_synthetic_doc(),
            verify_level="off",
        )
        assert seen == list(parse_worker.FIELD_GROUPS)


class TestExtractAllGroups:
    def test_strips_fences_prunes_and_splits_usage(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "live_apis", True)
        monkeypatch.setattr(settings, "llm_backend", "claude_cli")
        combined = {g: copy.deepcopy(_MOCK_OUTPUTS[g]) for g in parse_worker.FIELD_GROUPS}
        combined["requirements"]["rows"][0]["hallucinated_key"] = "x"
        fenced = "```json\n" + json.dumps(combined, ensure_ascii=False) + "\n```"
        monkeypatch.setattr(
            llm_cli, "run_claude_cli_result",
            lambda *a, **k: llm_cli.CliCallResult(
                text=fenced, input_tokens=1000, output_tokens=500,
            ),
        )
        out = llm_anthropic.extract_all_groups(
            archetype="A", source_text_ko="x", groups=parse_worker.FIELD_GROUPS,
        )
        assert set(out) == set(parse_worker.FIELD_GROUPS)
        req = out["requirements"]
        assert "hallucinated_key" not in req.parsed_output["rows"][0]
        assert req.dropped_keys == ("$.rows[0].hallucinated_key",)
        # One call's usage split evenly across the five job rows.
        assert out["calendar"].input_tokens == 1000 // 5
        assert out["calendar"].output_tokens == 500 // 5
        assert out["calendar"].llm_provider == "claude_cli"

    def test_invalid_group_payload_is_absent(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(settings, "live_apis", True)
        monkeypatch.setattr(settings, "llm_backend", "claude_cli")
        combined = {g: copy.deepcopy(_MOCK_OUTPUTS[g]) for g in parse_worker.FIELD_GROUPS}
        combined["tuition"] = {"rows": "not-a-list"}
        monkeypatch.setattr(
            llm_cli, "run_claude_cli_result",
            lambda *a, **k: llm_cli.CliCallResult(
                text=json.dumps(combined, ensure_ascii=False),
            ),
        )
        out = llm_anthropic.extract_all_groups(
            archetype="A", source_text_ko="x", groups=parse_worker.FIELD_GROUPS,
        )
        assert "tuition" not in out
        assert set(out) == set(parse_worker.FIELD_GROUPS) - {"tuition"}

    def test_non_json_response_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "live_apis", True)
        monkeypatch.setattr(settings, "llm_backend", "claude_cli")
        monkeypatch.setattr(
            llm_cli, "run_claude_cli_result",
            lambda *a, **k: llm_cli.CliCallResult(text="I could not comply."),
        )
        with pytest.raises(llm_anthropic.AnthropicResponseError):
            llm_anthropic.extract_all_groups(
                archetype="A", source_text_ko="x", groups=parse_worker.FIELD_GROUPS,
            )

    def test_mock_mode_returns_every_group(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "live_apis", False)
        out = llm_anthropic.extract_all_groups(
            archetype="A", source_text_ko="x", groups=parse_worker.FIELD_GROUPS,
        )
        assert set(out) == set(parse_worker.FIELD_GROUPS)
        assert all(r.llm_provider == "mock" for r in out.values())


class TestCombinedPrompt:
    def test_output_contract_lists_every_group(self) -> None:
        prompt = assemble_combined_prompt(
            archetype="A", source_text_ko="원문", groups=parse_worker.FIELD_GROUPS,
        )
        for g in parse_worker.FIELD_GROUPS:
            assert f"`{g}`" in prompt.system
        assert "ONE JSON object" in prompt.system
        assert "원문" in prompt.user

    def test_unknown_group_rejected(self) -> None:
        with pytest.raises(ValueError):
            assemble_combined_prompt(
                archetype="A", source_text_ko="x", groups=("nope",),
            )
