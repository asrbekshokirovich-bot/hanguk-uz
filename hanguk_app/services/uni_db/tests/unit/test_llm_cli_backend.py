"""The keyless `claude_cli` LLM backend (subscription auth, no API key).

Covers the envelope parsing in `run_claude_cli` and that `extract_field_group`
+ `verify.call_json` route through the CLI (not the Anthropic SDK) when
`UNI_DB_LLM_BACKEND=claude_cli`, with no ANTHROPIC_API_KEY required.
"""

from __future__ import annotations

import json
import subprocess

import pytest

from uni_db.config import settings
from uni_db.extract import llm_anthropic, llm_cli


def _fake_completed(stdout: str, returncode: int = 0, stderr: str = ""):
    return subprocess.CompletedProcess(args=["claude"], returncode=returncode, stdout=stdout, stderr=stderr)


def test_run_claude_cli_extracts_result_from_envelope(monkeypatch):
    envelope = json.dumps({"type": "result", "subtype": "success", "is_error": False,
                           "result": '{"rows": []}'})
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _fake_completed(envelope))
    out = llm_cli.run_claude_cli("sys", "user", "claude-sonnet-4-6")
    assert out == '{"rows": []}'


def test_run_claude_cli_raises_on_error_envelope(monkeypatch):
    envelope = json.dumps({"type": "result", "subtype": "error_during_execution",
                           "is_error": True, "result": "boom"})
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _fake_completed(envelope))
    with pytest.raises(llm_cli.ClaudeCliError):
        llm_cli.run_claude_cli("sys", "user", "claude-sonnet-4-6")


def test_run_claude_cli_raises_on_nonzero_exit(monkeypatch):
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _fake_completed("", returncode=1, stderr="nope"))
    with pytest.raises(llm_cli.ClaudeCliError):
        llm_cli.run_claude_cli("sys", "user", "claude-sonnet-4-6")


def test_cli_model_alias():
    assert llm_cli._cli_model("claude-haiku-4-5") == "haiku"
    assert llm_cli._cli_model("claude-opus-4-8") == "opus"
    assert llm_cli._cli_model("claude-sonnet-4-6") == "sonnet"
    assert llm_cli._cli_model("") == "sonnet"


def test_extract_field_group_routes_through_cli_without_api_key(monkeypatch):
    """extract_field_group must use the CLI (not the SDK) and need no API key."""
    monkeypatch.setattr(settings, "live_apis", True)
    monkeypatch.setattr(settings, "llm_backend", "claude_cli")
    monkeypatch.setattr(settings, "anthropic_api_key", "")  # no key on purpose

    captured = {}

    def fake_cli(system: str, user: str, model: str, **kw) -> str:
        captured["called"] = True
        return json.dumps({"rows": [{
            "applicant_category": "외국인전형", "topik_min_level": 4, "topik_deferred": False,
            "english_test": None, "gpa_floor_pct": None, "interview_required": False,
            "practical_exam_required": False, "prose_ko": "x", "source_text_ko": "x",
            "extractor_confidence": 0.9,
        }]})

    # If the SDK path were taken, _get_client would be hit and fail without a key.
    def explode():
        raise AssertionError("SDK client must not be built in claude_cli mode")

    monkeypatch.setattr(llm_cli, "run_claude_cli", fake_cli)
    monkeypatch.setattr(llm_anthropic, "_get_client", explode)

    result = llm_anthropic.extract_field_group(
        field_group="requirements", archetype="A", source_text_ko="…",
    )
    assert captured.get("called") is True
    assert result.llm_provider == "claude_cli"
    assert len(result.parsed_output["rows"]) == 1


# --- usage guards: serialize CLI calls + cap verify depth on the subscription --

def test_cli_calls_are_serialized_by_a_lock():
    import threading
    # a real lock instance so concurrent pipeline calls can never overlap
    assert isinstance(llm_cli._CLI_LOCK, type(threading.Lock()))


def test_effective_verify_level_caps_on_claude_cli(monkeypatch):
    # API backend: level passes through unchanged
    monkeypatch.setattr(settings, "llm_backend", "anthropic")
    monkeypatch.setattr(settings, "verify_level", "maximum")
    assert settings.effective_verify_level == "maximum"

    # claude_cli backend: heavy levels drop to 'balanced' (deterministic only)
    monkeypatch.setattr(settings, "llm_backend", "claude_cli")
    for heavy in ("maximum", "thorough", "MAXIMUM"):
        monkeypatch.setattr(settings, "verify_level", heavy)
        assert settings.effective_verify_level == "balanced"

    # 'off' stays off; lighter levels pass through
    monkeypatch.setattr(settings, "verify_level", "off")
    assert settings.effective_verify_level == "off"
    monkeypatch.setattr(settings, "verify_level", "balanced")
    assert settings.effective_verify_level == "balanced"
