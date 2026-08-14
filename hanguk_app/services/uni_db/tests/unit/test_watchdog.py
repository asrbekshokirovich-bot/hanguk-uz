"""Phase 3 run-level watchdog: empty-payload spike, stale ingest,
credit-balance detection, CLI failure streak — each fired once, loudly."""

from __future__ import annotations

import json
import subprocess

import pytest

from uni_db.config import settings
from uni_db.extract import llm_cli
from uni_db.watchdog import RunWatchdog, watchdog


def _codes(wd: RunWatchdog) -> set[str]:
    return {a.code for a in wd.alerts()}


class TestEmptyPayloadSpike:
    def test_fires_above_30_percent_on_a_meaningful_sample(self) -> None:
        wd = RunWatchdog()
        for i in range(10):
            wd.record_payload(empty=i < 4)  # 4/10 = 40%
        assert _codes(wd) == {"empty_payload_spike"}

    def test_quiet_at_or_below_threshold(self) -> None:
        wd = RunWatchdog()
        for i in range(10):
            wd.record_payload(empty=i < 3)  # 3/10 = 30%, not >30%
        assert _codes(wd) == set()

    def test_quiet_on_a_small_sample(self) -> None:
        wd = RunWatchdog()
        for _ in range(5):
            wd.record_payload(empty=True)  # 100% but only 5 payloads
        assert _codes(wd) == set()

    def test_fires_once(self) -> None:
        wd = RunWatchdog()
        for _ in range(20):
            wd.record_payload(empty=True)
        assert len(wd.alerts()) == 1


class TestStaleIngest:
    def test_fires_when_ingested_year_below_target(self) -> None:
        wd = RunWatchdog()
        wd.record_ingested_document(academic_year=2026, target_year=2027)
        assert _codes(wd) == {"stale_document_ingested"}

    def test_quiet_on_target_or_newer_or_unknown(self) -> None:
        wd = RunWatchdog()
        wd.record_ingested_document(academic_year=2027, target_year=2027)
        wd.record_ingested_document(academic_year=2028, target_year=2027)
        wd.record_ingested_document(academic_year=None, target_year=2027)
        wd.record_ingested_document(academic_year=2020, target_year=None)
        assert _codes(wd) == set()


class TestCreditBalance:
    def test_detects_anthropic_credit_message(self) -> None:
        wd = RunWatchdog()
        wd.record_llm_error(
            "BadRequestError: Your credit balance is too low to access the "
            "Anthropic API. Please go to Plans & Billing."
        )
        assert _codes(wd) == {"api_credit_balance"}

    def test_ordinary_errors_do_not_fire(self) -> None:
        wd = RunWatchdog()
        wd.record_llm_error("APITimeoutError: request timed out")
        wd.record_llm_error("rate_limit_error: too many requests")
        assert _codes(wd) == set()


class TestAuthFailure:
    def test_detects_the_sdk_401_shape(self) -> None:
        wd = RunWatchdog()
        wd.record_llm_error(
            "AuthenticationError: Error code: 401 - {'type': 'error', 'error': "
            "{'type': 'authentication_error', 'message': 'invalid x-api-key'}}"
        )
        assert _codes(wd) == {"api_auth_failure"}

    def test_a_bare_401_in_a_message_does_not_fire(self) -> None:
        # '401' shows up in amounts, ids and byte counts. Only the shapes the
        # SDK actually raises may trip this, or a run drains itself on noise.
        wd = RunWatchdog()
        wd.record_llm_error("APITimeoutError: read timed out after 401 seconds")
        wd.record_llm_error("ValueError: tuition amount_krw=5401000 out of range")
        assert _codes(wd) == set()

    def test_fires_once_across_many_rejections(self) -> None:
        wd = RunWatchdog()
        for _ in range(50):
            wd.record_llm_error("AuthenticationError: Error code: 401")
        assert len(wd.alerts()) == 1


class TestFatalAlert:
    def test_auth_and_credit_failures_are_fatal(self) -> None:
        for message in (
            "AuthenticationError: Error code: 401 - invalid x-api-key",
            "BadRequestError: Your credit balance is too low",
        ):
            wd = RunWatchdog()
            wd.record_llm_error(message)
            alert = wd.fatal_alert()
            assert alert is not None and alert.code in {
                "api_auth_failure", "api_credit_balance",
            }

    def test_run_health_alerts_are_not_fatal(self) -> None:
        # An empty-payload spike or a CLI streak is worth shouting about, but
        # the next document may still succeed — they must not stop a drain.
        wd = RunWatchdog()
        for _ in range(20):
            wd.record_payload(empty=True)
        for _ in range(3):
            wd.record_cli_exit(1)
        assert len(wd.alerts()) == 2
        assert wd.fatal_alert() is None

    def test_quiet_run_has_none(self) -> None:
        assert RunWatchdog().fatal_alert() is None

    def test_reset_clears_it(self) -> None:
        wd = RunWatchdog()
        wd.record_llm_error("AuthenticationError: Error code: 401")
        wd.reset()
        assert wd.fatal_alert() is None


class TestCliFailureStreak:
    def test_three_genuine_failures_fire(self) -> None:
        wd = RunWatchdog()
        for _ in range(3):
            wd.record_cli_exit(1)
        assert _codes(wd) == {"cli_failure_streak"}

    def test_success_resets_the_streak(self) -> None:
        wd = RunWatchdog()
        wd.record_cli_exit(1)
        wd.record_cli_exit(1)
        wd.record_cli_exit(0)
        wd.record_cli_exit(1)
        wd.record_cli_exit(1)
        assert _codes(wd) == set()

    def test_usage_limited_exits_neither_count_nor_reset(self) -> None:
        wd = RunWatchdog()
        wd.record_cli_exit(1)
        wd.record_cli_exit(1, usage_limited=True)  # self-healing — ignored
        wd.record_cli_exit(1)
        wd.record_cli_exit(1)
        assert _codes(wd) == {"cli_failure_streak"}

    def test_reset_clears_everything(self) -> None:
        wd = RunWatchdog()
        for _ in range(3):
            wd.record_cli_exit(1)
        wd.reset()
        assert wd.alerts() == ()


class TestCliWiring:
    def test_three_failing_cli_calls_trip_the_singleton(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        watchdog.reset()
        monkeypatch.setattr(
            subprocess, "run",
            lambda *a, **k: subprocess.CompletedProcess(
                args=["claude"], returncode=1, stdout="", stderr="boom: broken install",
            ),
        )
        monkeypatch.setattr(settings, "claude_cli_retry_budget_sec", 0)
        for _ in range(3):
            with pytest.raises(llm_cli.ClaudeCliError):
                llm_cli.run_claude_cli("s", "u", "claude-sonnet-4-6")
        assert "cli_failure_streak" in {a.code for a in watchdog.alerts()}
        watchdog.reset()

    def test_successful_call_records_a_zero_exit(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        watchdog.reset()
        envelope = json.dumps({"type": "result", "subtype": "success",
                               "is_error": False, "result": "hi"})
        ok = subprocess.CompletedProcess(args=["claude"], returncode=0,
                                         stdout=envelope, stderr="")
        bad = subprocess.CompletedProcess(args=["claude"], returncode=1,
                                          stdout="", stderr="genuine failure")
        calls = {"n": 0}

        def fake_run(*a, **k):
            calls["n"] += 1
            # two genuine failures, then a success, then two more failures:
            # the success must break the streak, so no alert fires.
            return bad if calls["n"] not in (3,) else ok

        monkeypatch.setattr(subprocess, "run", fake_run)
        monkeypatch.setattr(settings, "claude_cli_retry_budget_sec", 0)
        for i in range(5):
            if i == 2:
                assert llm_cli.run_claude_cli("s", "u", "claude-sonnet-4-6") == "hi"
            else:
                with pytest.raises(llm_cli.ClaudeCliError):
                    llm_cli.run_claude_cli("s", "u", "claude-sonnet-4-6")
        assert {a.code for a in watchdog.alerts()} == set()
        watchdog.reset()
