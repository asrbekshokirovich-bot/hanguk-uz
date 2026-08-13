"""Extraction repair paths: fence stripping, top-level shape normalization,
the one-shot corrective retries (parse error / validator errors fed back into
the prompt), and the longer CLI timeout for documents_required.

Same fake-client pattern as test_llm_anthropic.py; a sequenced client serves
different responses per call so the retry paths can be exercised.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import jsonschema
import pytest

from uni_db.extract import llm_anthropic, llm_cli

# ---------------------------------------------------------------------------
# fakes
# ---------------------------------------------------------------------------


@dataclass
class _FakeUsage:
    input_tokens: int = 10
    output_tokens: int = 10
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0


@dataclass
class _FakeContentBlock:
    text: str
    type: str = "text"


@dataclass
class _FakeResponse:
    content: list[_FakeContentBlock]
    usage: _FakeUsage
    model: str = "claude-sonnet-4-6"


def _resp(text: str) -> _FakeResponse:
    return _FakeResponse(content=[_FakeContentBlock(text=text)], usage=_FakeUsage())


class _SeqMessages:
    """Serves one canned response per create() call, capturing every request."""

    def __init__(self, responses: list[_FakeResponse]) -> None:
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> _FakeResponse:
        self.calls.append(kwargs)
        return self._responses.pop(0)


class _SeqClient:
    def __init__(self, responses: list[_FakeResponse]) -> None:
        self.messages = _SeqMessages(responses)


_VALID_TUITION = {"rows": [{
    # `faculty_ko` is the required identity; the bucket is an optional filter.
    "faculty_ko": "인문계", "faculty_group": "인문",
    "academic_year": 2027, "semester_number": 1,
    "amount_krw": 4_800_000, "source_text_ko": "인문계 4,800,000원",
}]}

_VALID_CALENDAR = {"events": [{
    "event_type": "apply_open", "starts_at": "2026-09-01T09:00:00+09:00",
    "source_text_ko": "원서접수 시작",
}]}


@pytest.fixture
def live_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(llm_anthropic.settings, "live_apis", True)
    monkeypatch.setattr(llm_anthropic.settings, "anthropic_api_key", "sk-ant-test")
    monkeypatch.setattr(llm_anthropic.settings, "llm_backend", "anthropic")


# ---------------------------------------------------------------------------
# fence stripping
# ---------------------------------------------------------------------------


class TestStripFences:
    def test_plain_json_untouched(self) -> None:
        raw = json.dumps(_VALID_TUITION)
        assert llm_anthropic._strip_fences(raw) == raw

    def test_anchored_fence(self) -> None:
        raw = "```json\n" + json.dumps(_VALID_TUITION) + "\n```"
        assert json.loads(llm_anthropic._strip_fences(raw)) == _VALID_TUITION

    def test_fence_after_leading_prose(self) -> None:
        # The production failure: "response was not valid JSON; raw='```json…'"
        # variants where prose precedes the fence.
        raw = ("Here is the extracted data:\n\n```json\n"
               + json.dumps(_VALID_TUITION) + "\n```\nLet me know if…")
        assert json.loads(llm_anthropic._strip_fences(raw)) == _VALID_TUITION

    def test_unclosed_fence_after_prose(self) -> None:
        raw = "Sure!\n```json\n" + json.dumps(_VALID_TUITION)
        assert json.loads(llm_anthropic._strip_fences(raw)) == _VALID_TUITION

    def test_backticks_inside_json_strings_survive(self) -> None:
        payload = {"rows": [{"source_text_ko": "코드 ``` 예시", "note": "x"}]}
        raw = json.dumps(payload, ensure_ascii=False)
        assert json.loads(llm_anthropic._strip_fences(raw)) == payload


# ---------------------------------------------------------------------------
# both top-level shapes
# ---------------------------------------------------------------------------


class TestTopLevelShapes:
    def test_rows_wrapper_accepted(self) -> None:
        out = llm_anthropic._parse_extraction_output(
            json.dumps(_VALID_TUITION), "tuition")
        assert out == _VALID_TUITION

    def test_bare_list_wrapped_into_rows(self) -> None:
        out = llm_anthropic._parse_extraction_output(
            json.dumps(_VALID_TUITION["rows"]), "tuition")
        assert out == {"rows": _VALID_TUITION["rows"]}

    def test_bare_list_wrapped_into_events_for_calendar(self) -> None:
        out = llm_anthropic._parse_extraction_output(
            json.dumps(_VALID_CALENDAR["events"]), "calendar")
        assert out == {"events": _VALID_CALENDAR["events"]}

    def test_bare_list_with_prose_recovered(self) -> None:
        raw = "Extracted rows:\n" + json.dumps(_VALID_TUITION["rows"])
        out = llm_anthropic._parse_extraction_output(raw, "tuition")
        assert out == {"rows": _VALID_TUITION["rows"]}


# ---------------------------------------------------------------------------
# corrective retries
# ---------------------------------------------------------------------------


class TestParseRetry:
    def test_unparseable_response_retried_once_with_error(
        self, live_settings, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _SeqClient([
            _resp("I could not produce JSON, sorry."),
            _resp(json.dumps(_VALID_TUITION)),
        ])
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="tuition", archetype="A", source_text_ko="등록금 표",
        )
        assert len(client.messages.calls) == 2
        retry_user = client.messages.calls[1]["messages"][0]["content"]
        assert "RETRY" in retry_user
        assert "could not be parsed as JSON" in retry_user
        assert result.parsed_output["rows"][0]["amount_krw"] == 4_800_000

    def test_still_unparseable_after_retry_raises(
        self, live_settings, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _SeqClient([_resp("nope"), _resp("still nope")])
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        with pytest.raises(llm_anthropic.AnthropicResponseError):
            llm_anthropic.extract_field_group(
                field_group="tuition", archetype="A", source_text_ko="x",
            )
        assert len(client.messages.calls) == 2


class TestValidationRetry:
    def test_validation_failure_retried_once_with_validator_errors(
        self, live_settings, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # First response misses required core fields (amount_krw…); the retry
        # prompt must carry the validator error, and the second response wins.
        bad = {"rows": [{"faculty_group": "인문"}]}
        client = _SeqClient([
            _resp(json.dumps(bad)),
            _resp(json.dumps(_VALID_TUITION)),
        ])
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="tuition", archetype="A", source_text_ko="등록금 표",
        )
        assert len(client.messages.calls) == 2
        retry_user = client.messages.calls[1]["messages"][0]["content"]
        assert "failed schema validation" in retry_user
        assert "required" in retry_user  # jsonschema's message text
        assert result.parsed_output == _VALID_TUITION

    def test_validation_failure_twice_raises(
        self, live_settings, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        bad = {"rows": [{"faculty_group": "인문"}]}
        client = _SeqClient([_resp(json.dumps(bad)), _resp(json.dumps(bad))])
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        with pytest.raises(jsonschema.ValidationError):
            llm_anthropic.extract_field_group(
                field_group="tuition", archetype="A", source_text_ko="x",
            )
        assert len(client.messages.calls) == 2


class TestPruneDontReject:
    def test_unknown_requirements_key_survives_extraction(
        self, live_settings, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # One unmodelled key on a strict row: the job must SUCCEED (pruned),
        # not fail — and the dropped key is reported on the result.
        payload = {"rows": [{
            "source_text_ko": "TOPIK 3급", "topik_min_level": 3,
            "hallucinated_key": "x",
        }]}
        client = _SeqClient([_resp(json.dumps(payload))])
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="requirements", archetype="G", source_text_ko="x",
        )
        assert len(client.messages.calls) == 1          # no retry needed
        assert result.dropped_keys == ("$.rows[0].hallucinated_key",)
        assert "hallucinated_key" not in result.parsed_output["rows"][0]
        assert result.parsed_output["rows"][0]["topik_min_level"] == 3
        # raw_output keeps the unpruned model text
        assert "hallucinated_key" in result.raw_output


# ---------------------------------------------------------------------------
# CLI timeout per field group
# ---------------------------------------------------------------------------


class TestCliTimeouts:
    def test_documents_required_gets_long_timeout(self) -> None:
        assert llm_anthropic._cli_timeout_for("documents_required") == 1800.0
        assert llm_anthropic._cli_timeout_for("document_checklist") == 1800.0
        assert llm_anthropic._cli_timeout_for("scholarships") == 900.0
        assert llm_anthropic._cli_timeout_for("requirements") == 900.0

    def test_other_groups_keep_default(self) -> None:
        assert llm_anthropic._cli_timeout_for("calendar") == 240.0
        assert llm_anthropic._cli_timeout_for("tuition") == 240.0

    def test_cli_backend_passes_timeout_through(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(llm_anthropic.settings, "live_apis", True)
        monkeypatch.setattr(llm_anthropic.settings, "llm_backend", "claude_cli")
        captured: dict[str, Any] = {}

        def fake_run(system: str, user: str, model: str, *, timeout: float):
            captured["timeout"] = timeout
            return llm_cli.CliCallResult(
                text=json.dumps({"rows": [{"source_text_ko": "여권 사본"}]})
            )

        monkeypatch.setattr(llm_cli, "run_claude_cli_result", fake_run)

        result = llm_anthropic.extract_field_group(
            field_group="documents_required", archetype="H", source_text_ko="x",
        )
        assert captured["timeout"] == 1800.0
        assert result.llm_provider == "claude_cli"
