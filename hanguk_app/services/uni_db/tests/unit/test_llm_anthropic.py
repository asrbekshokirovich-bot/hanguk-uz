"""Tests for the Anthropic extraction call site.

No live network: every test that exercises the live path patches
`_get_client` to return a fake whose `messages.create` returns a
canned response object. This is the same pattern as
`test_extract_orchestrator.py` — module-level monkeypatch.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import jsonschema
import pytest

from uni_db.extract import llm_anthropic

# ---------------------------------------------------------------------------
# Fake Anthropic SDK shapes
# ---------------------------------------------------------------------------


@dataclass
class _FakeUsage:
    input_tokens: int = 0
    output_tokens: int = 0
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


class _FakeMessages:
    """Captures the last create() call so tests can assert on the request."""

    def __init__(self, response: _FakeResponse | Exception) -> None:
        self._response = response
        self.last_kwargs: dict[str, Any] | None = None
        self.call_count: int = 0

    def create(self, **kwargs: Any) -> _FakeResponse:
        self.call_count += 1
        self.last_kwargs = kwargs
        if isinstance(self._response, Exception):
            raise self._response
        return self._response


class _FakeClient:
    def __init__(self, response: _FakeResponse | Exception) -> None:
        self.messages = _FakeMessages(response)


_VALID_CALENDAR_PAYLOAD = {
    "events": [
        {
            "event_type": "apply_open",
            "starts_at": "2026-09-01T09:00:00+09:00",
            "ends_at": None,
            "is_tentative": False,
            "notes_ko": "원서접수 시작",
            "source_text_ko": "2026.09.01(월) 09:00 원서접수 시작",
            "extractor_confidence": 0.93,
        }
    ]
}


def _ok_response(
    *,
    payload: dict[str, Any] | None = None,
    raw_text: str | None = None,
    input_tokens: int = 1500,
    output_tokens: int = 300,
    cache_read_input_tokens: int = 0,
    cache_creation_input_tokens: int = 0,
    model: str = "claude-sonnet-4-6",
) -> _FakeResponse:
    text = raw_text if raw_text is not None else json.dumps(
        payload if payload is not None else _VALID_CALENDAR_PAYLOAD,
        ensure_ascii=False,
    )
    return _FakeResponse(
        content=[_FakeContentBlock(text=text)],
        usage=_FakeUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_input_tokens=cache_read_input_tokens,
            cache_creation_input_tokens=cache_creation_input_tokens,
        ),
        model=model,
    )


@pytest.fixture
def live_settings(monkeypatch: pytest.MonkeyPatch):
    """Flip the live-API gate ON and supply a dummy API key.

    Returns a recorder dict that some tests use to assert side effects.
    """
    monkeypatch.setattr(llm_anthropic.settings, "live_apis", True)
    monkeypatch.setattr(llm_anthropic.settings, "anthropic_api_key", "sk-ant-test")
    monkeypatch.setattr(
        llm_anthropic.settings, "anthropic_model_extract", "claude-sonnet-4-6"
    )
    monkeypatch.setattr(llm_anthropic.settings, "http_request_timeout_sec", 30)
    return {}


# ---------------------------------------------------------------------------
# 1. Mock path (live_apis=False) — default test environment
# ---------------------------------------------------------------------------


class TestMockPath:
    def test_returns_mock_when_live_apis_false(self) -> None:
        # conftest sets UNI_DB_LIVE_APIS=false, and settings is cached.
        # The mock path runs without ever importing anthropic.
        result = llm_anthropic.extract_field_group(
            field_group="calendar",
            archetype="A",
            source_text_ko="…",
        )
        assert result.llm_provider == "mock"
        assert result.llm_model == "mock"
        assert result.cost_usd == 0.0
        assert result.input_tokens == 0
        assert result.output_tokens == 0
        # The mock payload is schema-valid for the calendar group
        assert "events" in result.parsed_output
        assert len(result.parsed_output["events"]) >= 1

    def test_unknown_field_group_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="unknown field_group"):
            llm_anthropic.extract_field_group(
                field_group="not_a_real_group",
                archetype="A",
                source_text_ko="…",
            )


# ---------------------------------------------------------------------------
# 2. Live path — defensive checks
# ---------------------------------------------------------------------------


class TestLivePathDefenses:
    def test_raises_when_api_key_missing_even_if_live_apis_true(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(llm_anthropic.settings, "live_apis", True)
        monkeypatch.setattr(llm_anthropic.settings, "anthropic_api_key", "")

        # _get_client should never be called; the API-key guard fires first.
        def fail_get_client():  # pragma: no cover — assert path
            raise AssertionError("_get_client must not be called without a key")

        monkeypatch.setattr(llm_anthropic, "_get_client", fail_get_client)

        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
            llm_anthropic.extract_field_group(
                field_group="calendar",
                archetype="A",
                source_text_ko="2026.09.01 원서접수",
            )


# ---------------------------------------------------------------------------
# 3. Live path — happy path with a fake client
# ---------------------------------------------------------------------------


class TestLivePathHappy:
    def test_calls_anthropic_and_parses_response(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        client = _FakeClient(_ok_response(input_tokens=1234, output_tokens=222))
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="calendar",
            archetype="A",
            source_text_ko="2026.09.01(월) 09:00 원서접수",
        )

        assert client.messages.call_count == 1
        assert result.llm_provider == "anthropic"
        assert result.llm_model == "claude-sonnet-4-6"
        assert result.input_tokens == 1234
        assert result.output_tokens == 222
        # events pass through unchanged; normalize now also derives periods
        # from the events (Phase 3), so compare the events and check periods.
        assert result.parsed_output["events"] == _VALID_CALENDAR_PAYLOAD["events"]
        assert result.parsed_output["periods"][0]["application_start"].startswith("2026-09-01")

    def test_system_message_has_cache_control(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Prompt-caching is non-optional — verify the cache_control header
        ships on the system block. Without it we pay full input rate on
        every call and ADR-001's $1.30/guideline budget breaks."""
        client = _FakeClient(_ok_response())
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        llm_anthropic.extract_field_group(
            field_group="calendar",
            archetype="A",
            source_text_ko="2026.09.01 원서접수",
        )

        kwargs = client.messages.last_kwargs
        assert kwargs is not None
        assert isinstance(kwargs["system"], list)
        assert len(kwargs["system"]) == 1
        assert kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
        assert kwargs["model"] == "claude-sonnet-4-6"
        assert kwargs["messages"][0]["role"] == "user"


# ---------------------------------------------------------------------------
# 4. Live path — defensive parsing
# ---------------------------------------------------------------------------


class TestLivePathParsing:
    def test_strips_markdown_json_fences(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Sonnet sometimes wraps despite the prompt instruction.
        wrapped = "```json\n" + json.dumps(_VALID_CALENDAR_PAYLOAD) + "\n```"
        client = _FakeClient(_ok_response(raw_text=wrapped))
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="calendar",
            archetype="A",
            source_text_ko="…",
        )
        assert result.parsed_output["events"] == _VALID_CALENDAR_PAYLOAD["events"]
        # raw_output preserves the fence — useful for debugging
        assert "```json" in result.raw_output

    def test_invalid_json_raises_anthropic_response_error(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        client = _FakeClient(_ok_response(raw_text="this is not json at all"))
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        with pytest.raises(llm_anthropic.AnthropicResponseError):
            llm_anthropic.extract_field_group(
                field_group="calendar",
                archetype="A",
                source_text_ko="…",
            )

    def test_valid_json_with_invalid_schema_raises_jsonschema_error(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Calendar schema requires `events` array of typed objects.
        # Returning a dict with the wrong shape exercises the schema gate.
        bad_payload = {"events": [{"event_type": "not_an_enum_value"}]}
        client = _FakeClient(_ok_response(payload=bad_payload))
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        with pytest.raises(jsonschema.ValidationError):
            llm_anthropic.extract_field_group(
                field_group="calendar",
                archetype="A",
                source_text_ko="…",
            )

    def test_documents_required_keyed_by_field_group_name(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # The model labels the array `documents_required` instead of `rows`;
        # _normalize_wrapper remaps it so it validates instead of being dropped
        # (this was failing documents_required on ~most documents).
        payload = {"documents_required": [
            {"source_text_ko": "여권 사본 1부", "document_name_ko": "여권"}]}
        client = _FakeClient(_ok_response(payload=payload))
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="documents_required", archetype="H", source_text_ko="x",
        )
        assert result.parsed_output["rows"][0]["document_name_ko"] == "여권"


# ---------------------------------------------------------------------------
# 5. Cost computation
# ---------------------------------------------------------------------------


class TestCostComputation:
    def test_cost_includes_cache_read_and_write_tokens(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # 1000 input x $3/M = $0.003
        # 500 output x $15/M = $0.0075
        # 5000 cache-read x $0.30/M = $0.0015
        # 2000 cache-write x $3.75/M = $0.0075
        # Total: $0.0195
        client = _FakeClient(
            _ok_response(
                input_tokens=1000,
                output_tokens=500,
                cache_read_input_tokens=5000,
                cache_creation_input_tokens=2000,
            )
        )
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="calendar",
            archetype="A",
            source_text_ko="…",
        )

        assert result.cost_usd == pytest.approx(0.0195, abs=1e-6)

    def test_cost_is_zero_when_usage_is_zero(
        self,
        live_settings,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Defensive: if Anthropic ever returns zero usage (e.g. cached
        # error path), cost shouldn't blow up.
        client = _FakeClient(
            _ok_response(
                input_tokens=0,
                output_tokens=0,
                cache_read_input_tokens=0,
                cache_creation_input_tokens=0,
            )
        )
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)

        result = llm_anthropic.extract_field_group(
            field_group="calendar",
            archetype="A",
            source_text_ko="…",
        )
        assert result.cost_usd == 0.0


# ---------------------------------------------------------------------------
# 6. Direct cost-helper sanity (locks the per-token math against drift)
# ---------------------------------------------------------------------------


class TestComputeCostHelper:
    def test_pure_input_only(self) -> None:
        # 1M input tokens at $3/M = $3.00
        cost = llm_anthropic._compute_cost_usd(
            input_tokens=1_000_000,
            output_tokens=0,
            cached_input_tokens=0,
            cache_write_tokens=0,
        )
        assert cost == pytest.approx(3.0, abs=1e-6)

    def test_pure_output_only(self) -> None:
        # 1M output tokens at $15/M = $15.00
        cost = llm_anthropic._compute_cost_usd(
            input_tokens=0,
            output_tokens=1_000_000,
            cached_input_tokens=0,
            cache_write_tokens=0,
        )
        assert cost == pytest.approx(15.0, abs=1e-6)

    def test_cache_read_at_one_tenth_input_rate(self) -> None:
        # 1M cache-read tokens at $0.30/M = $0.30
        cost = llm_anthropic._compute_cost_usd(
            input_tokens=0,
            output_tokens=0,
            cached_input_tokens=1_000_000,
            cache_write_tokens=0,
        )
        assert cost == pytest.approx(0.30, abs=1e-6)


class TestSelfScore:
    """Job-level confidence is the MIN of per-row confidences."""

    def test_min_over_rows(self) -> None:
        parsed = {"rows": [
            {"extractor_confidence": 0.91},
            {"extractor_confidence": 0.68},
            {"extractor_confidence": 0.88},
        ]}
        assert llm_anthropic._self_score(parsed) == pytest.approx(0.68)

    def test_min_over_calendar_events(self) -> None:
        parsed = {"events": [
            {"extractor_confidence": 0.91},
            {"extractor_confidence": 0.92},
        ]}
        assert llm_anthropic._self_score(parsed) == pytest.approx(0.91)

    def test_rows_without_confidence_ignored(self) -> None:
        parsed = {"rows": [{"name_ko": "x"}, {"extractor_confidence": 0.7}]}
        assert llm_anthropic._self_score(parsed) == pytest.approx(0.7)

    def test_falls_back_to_root_level(self) -> None:
        assert llm_anthropic._self_score({"extractor_confidence": 0.5}) == pytest.approx(0.5)

    def test_empty_extraction_scores_zero(self) -> None:
        # Empty extraction must score 0, not the neutral default, so triage
        # can tell it apart from real content.
        assert llm_anthropic._self_score({"rows": []}) == pytest.approx(0.0)
        assert llm_anthropic._self_score({"events": []}) == pytest.approx(0.0)

    def test_default_when_no_content_key(self) -> None:
        assert llm_anthropic._self_score({"note": "x"}) == pytest.approx(0.85)

    def test_non_dict_defaults(self) -> None:
        assert llm_anthropic._self_score("garbage") == pytest.approx(0.85)


class TestSalvagePartialJson:
    def test_salvages_complete_rows_before_truncation(self) -> None:
        text = ('{"rows": [{"name_ko":"안암장학금","faculty_ko":"경영대학"},'
                '{"name_ko":"두번째"},{"name_ko":"불완전한')
        out = llm_anthropic._salvage_partial_json(text)
        assert out == {"rows": [
            {"name_ko": "안암장학금", "faculty_ko": "경영대학"},
            {"name_ko": "두번째"},
        ]}

    def test_salvages_events(self) -> None:
        text = '{"events": [{"event_type":"apply_open"},{"event_type":'
        out = llm_anthropic._salvage_partial_json(text)
        assert out == {"events": [{"event_type": "apply_open"}]}

    def test_braces_inside_strings_dont_break_it(self) -> None:
        text = '{"rows": [{"note":"a } b { c"},{"x":'
        out = llm_anthropic._salvage_partial_json(text)
        assert out == {"rows": [{"note": "a } b { c"}]}

    def test_none_when_no_array(self) -> None:
        assert llm_anthropic._salvage_partial_json("totally broken {oops") is None

    def test_salvages_field_group_keyed_array(self) -> None:
        # model keyed the array by the field-group name, then truncated
        text = ('{"documents_required": [{"document_name_ko":"졸업증명서","source_text_ko":"x"},'
                '{"document_name_ko":"불완전')
        out = llm_anthropic._salvage_partial_json(text, "documents_required")
        assert out == {"rows": [{"document_name_ko": "졸업증명서", "source_text_ko": "x"}]}


class TestNormalizeWrapper:
    def test_remaps_field_group_key_to_rows(self) -> None:
        out = llm_anthropic._normalize_wrapper(
            {"documents_required": [{"a": 1}]}, "documents_required")
        assert out == {"rows": [{"a": 1}]}

    def test_calendar_remaps_to_events(self) -> None:
        assert llm_anthropic._normalize_wrapper(
            {"calendar": [{"e": 1}]}, "calendar") == {"events": [{"e": 1}]}

    def test_correct_wrapper_unchanged(self) -> None:
        p = {"rows": [{"a": 1}], "is_correction_notice": False}
        assert llm_anthropic._normalize_wrapper(p, "tuition") == p

    def test_single_list_key_remapped(self) -> None:
        assert llm_anthropic._normalize_wrapper(
            {"items": [{"a": 1}]}, "scholarships") == {"rows": [{"a": 1}]}

    def test_no_list_unchanged(self) -> None:
        p = {"note": "nothing"}
        assert llm_anthropic._normalize_wrapper(p, "requirements") == p


class TestTruncatedResponseSalvaged:
    def test_truncated_requirements_is_salvaged_not_dropped(
        self, live_settings, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        truncated = (
            '{"rows": [{"applicant_category":"외국인전형","source_text_ko":"x",'
            '"topik_min_level":4},{"applicant_category":"재외국민","source_text_ko":'
        )
        client = _FakeClient(_ok_response(raw_text=truncated))
        monkeypatch.setattr(llm_anthropic, "_get_client", lambda: client)
        result = llm_anthropic.extract_field_group(
            field_group="requirements", archetype="A", source_text_ko="x",
        )
        # the one complete row survives instead of the whole job being discarded
        assert len(result.parsed_output["rows"]) == 1
        assert result.parsed_output["rows"][0]["applicant_category"] == "외국인전형"
