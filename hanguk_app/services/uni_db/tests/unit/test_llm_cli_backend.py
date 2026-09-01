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


def test_run_claude_cli_result_captures_envelope_usage(monkeypatch):
    envelope = json.dumps({
        "type": "result", "subtype": "success", "is_error": False,
        "result": '{"rows": []}',
        "usage": {
            "input_tokens": 111, "output_tokens": 22,
            "cache_read_input_tokens": 3333, "cache_creation_input_tokens": 44,
        },
    })
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _fake_completed(envelope))
    res = llm_cli.run_claude_cli_result("sys", "user", "claude-sonnet-4-6")
    assert res.text == '{"rows": []}'
    assert (res.input_tokens, res.output_tokens) == (111, 22)
    assert (res.cached_input_tokens, res.cache_write_tokens) == (3333, 44)


def test_run_claude_cli_result_zero_usage_when_envelope_has_none(monkeypatch):
    envelope = json.dumps({"type": "result", "subtype": "success",
                           "is_error": False, "result": "hi"})
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _fake_completed(envelope))
    res = llm_cli.run_claude_cli_result("sys", "user", "claude-sonnet-4-6")
    assert res.text == "hi"
    assert (res.input_tokens, res.output_tokens) == (0, 0)


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

    def fake_cli(system: str, user: str, model: str, **kw) -> llm_cli.CliCallResult:
        captured["called"] = True
        return llm_cli.CliCallResult(
            text=json.dumps({"rows": [{
                "applicant_category": "외국인전형", "topik_min_level": 4, "topik_deferred": False,
                "english_test": None, "gpa_floor_pct": None, "interview_required": False,
                "practical_exam_required": False, "prose_ko": "x", "source_text_ko": "x",
                "extractor_confidence": 0.9,
            }]}),
            input_tokens=1234,
            output_tokens=321,
        )

    # If the SDK path were taken, _get_client would be hit and fail without a key.
    def explode():
        raise AssertionError("SDK client must not be built in claude_cli mode")

    monkeypatch.setattr(llm_cli, "run_claude_cli_result", fake_cli)
    monkeypatch.setattr(llm_anthropic, "_get_client", explode)

    result = llm_anthropic.extract_field_group(
        field_group="requirements", archetype="A", source_text_ko="…",
    )
    assert captured.get("called") is True
    assert result.llm_provider == "claude_cli"
    assert len(result.parsed_output["rows"]) == 1
    # Phase 2: token usage from the CLI envelope lands on the job.
    assert result.input_tokens == 1234
    assert result.output_tokens == 321
    assert result.cost_usd == 0.0  # subscription — not billed per token


# --- usage guards: serialize CLI calls + cap verify depth on the subscription --

def test_cli_calls_are_serialized_by_a_lock():
    import threading
    # a real lock instance so concurrent pipeline calls can never overlap
    assert isinstance(llm_cli._CLI_LOCK, type(threading.Lock()))


def test_cli_serialized_holds_a_cross_process_lock():
    # a lockfile path is defined so `fcntl` can serialize across processes,
    # not just threads within one process
    assert llm_cli._CLI_LOCKFILE.name.endswith(".lock")
    # the context manager acquires + releases cleanly
    with llm_cli._cli_serialized():
        pass


# --- usage-limit resilience: wait + retry instead of aborting the run --------

def test_is_usage_limit_markers():
    assert llm_cli._is_usage_limit("Claude usage limit reached. reset at 3pm")
    assert llm_cli._is_usage_limit("HTTP 429 Too Many Requests")
    assert llm_cli._is_usage_limit("overloaded_error: capacity")
    assert not llm_cli._is_usage_limit("schema validation failed")
    assert not llm_cli._is_usage_limit("")


def test_run_claude_cli_retries_on_usage_limit_then_succeeds(monkeypatch):
    limited = json.dumps({"type": "result", "subtype": "error_during_execution",
                          "is_error": True, "result": "Claude usage limit reached. reset at 3pm"})
    ok = json.dumps({"type": "result", "subtype": "success", "is_error": False,
                     "result": '{"rows": []}'})
    calls = {"n": 0}

    def fake_run(*a, **k):
        calls["n"] += 1
        return _fake_completed(limited if calls["n"] == 1 else ok)

    slept: list[float] = []
    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(llm_cli.time, "sleep", lambda s: slept.append(s))
    monkeypatch.setattr(settings, "claude_cli_retry_budget_sec", 7200)

    out = llm_cli.run_claude_cli("sys", "user", "claude-sonnet-4-6")
    assert out == '{"rows": []}'
    assert calls["n"] == 2  # retried once, then succeeded
    assert slept and slept[0] > 0  # it actually waited before retrying


def test_run_claude_cli_retries_on_usage_limit_stderr(monkeypatch):
    """A nonzero exit whose stderr looks rate-limited is retryable too."""
    ok = json.dumps({"type": "result", "subtype": "success", "is_error": False, "result": "hi"})
    calls = {"n": 0}

    def fake_run(*a, **k):
        calls["n"] += 1
        if calls["n"] == 1:
            return _fake_completed("", returncode=1, stderr="Error: 429 Too Many Requests")
        return _fake_completed(ok)

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(llm_cli.time, "sleep", lambda s: None)
    monkeypatch.setattr(settings, "claude_cli_retry_budget_sec", 7200)

    assert llm_cli.run_claude_cli("s", "u", "claude-sonnet-4-6") == "hi"
    assert calls["n"] == 2


def test_run_claude_cli_gives_up_when_budget_exhausted(monkeypatch):
    limited = json.dumps({"type": "result", "subtype": "error",
                          "is_error": True, "result": "usage limit reached"})
    monkeypatch.setattr(subprocess, "run", lambda *a, **k: _fake_completed(limited))
    monkeypatch.setattr(llm_cli.time, "sleep", lambda s: None)
    monkeypatch.setattr(settings, "claude_cli_retry_budget_sec", 0)  # no budget → give up at once

    with pytest.raises(llm_cli.ClaudeCliError):
        llm_cli.run_claude_cli("s", "u", "claude-sonnet-4-6")


def test_run_claude_cli_does_not_retry_a_genuine_error(monkeypatch):
    """A real (non-limit) failure must fail fast, not spin for hours."""
    bad = json.dumps({"type": "result", "subtype": "error_during_execution",
                      "is_error": True, "result": "schema mismatch"})
    calls = {"n": 0}

    def fake_run(*a, **k):
        calls["n"] += 1
        return _fake_completed(bad)

    slept: list[float] = []
    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(llm_cli.time, "sleep", lambda s: slept.append(s))
    monkeypatch.setattr(settings, "claude_cli_retry_budget_sec", 7200)

    with pytest.raises(llm_cli.ClaudeCliError):
        llm_cli.run_claude_cli("s", "u", "claude-sonnet-4-6")
    assert calls["n"] == 1  # no retry
    assert not slept


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


class TestSubscriptionCredentialIsUsed:
    """The keyless backend must actually be keyless.

    Claude Code ranks ANTHROPIC_API_KEY above CLAUDE_CODE_OAUTH_TOKEN, and in
    the `-p` mode this backend uses the key is always used when present. The
    subprocess inherited the parent environment, and every CI workflow here
    sets a key at job level next to UNI_DB_LLM_BACKEND=claude_cli — so the
    OAuth token was never reached and every call was billed to the key. When
    that balance ran out, extraction stopped repo-wide.
    """

    def test_api_key_is_hidden_from_the_cli(self, monkeypatch) -> None:
        from uni_db.extract import llm_cli

        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-should-not-be-used")
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "oauth-token")
        monkeypatch.setattr(
            llm_cli.settings, "claude_cli_allow_api_key", False, raising=False
        )

        env = llm_cli._cli_env()

        assert "ANTHROPIC_API_KEY" not in env
        # The credential the backend is supposed to use must survive.
        assert env["CLAUDE_CODE_OAUTH_TOKEN"] == "oauth-token"

    def test_the_escape_hatch_still_passes_the_key(self, monkeypatch) -> None:
        from uni_db.extract import llm_cli

        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-deliberate")
        monkeypatch.setattr(
            llm_cli.settings, "claude_cli_allow_api_key", True, raising=False
        )

        assert llm_cli._cli_env()["ANTHROPIC_API_KEY"] == "sk-ant-deliberate"

    def test_no_key_set_is_not_an_error(self, monkeypatch) -> None:
        from uni_db.extract import llm_cli

        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        monkeypatch.setattr(
            llm_cli.settings, "claude_cli_allow_api_key", False, raising=False
        )

        assert "ANTHROPIC_API_KEY" not in llm_cli._cli_env()

    def test_the_subprocess_actually_gets_that_environment(self, monkeypatch) -> None:
        # The guarantee is worthless if _cli_env is correct but unused.
        from uni_db.extract import llm_cli

        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-should-not-be-used")
        monkeypatch.setattr(
            llm_cli.settings, "claude_cli_allow_api_key", False, raising=False
        )
        seen: dict = {}

        class _Proc:
            returncode = 0
            stdout = '{"result": "ok", "usage": {}}'
            stderr = ""

        def _fake_run(cmd, **kwargs):
            seen.update(kwargs)
            return _Proc()

        monkeypatch.setattr(llm_cli.subprocess, "run", _fake_run)
        llm_cli._one_call(["claude", "-p"], "hi", 10.0)

        assert "ANTHROPIC_API_KEY" not in seen["env"]
