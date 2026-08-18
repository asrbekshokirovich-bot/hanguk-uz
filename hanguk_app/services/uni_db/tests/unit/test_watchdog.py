"""Phase 3 run-level watchdog: empty-payload spike, stale ingest,
credit-balance detection, CLI failure streak — each fired once, loudly."""

from __future__ import annotations

import json
import subprocess

import pytest

from uni_db.config import settings
from uni_db.extract import llm_cli
from uni_db.watchdog import CLI_FAILURE_STREAK_LIMIT, RunWatchdog, watchdog


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

    def test_empty_payload_spike_is_not_fatal(self) -> None:
        # A spike of empty payloads is worth shouting about, but the next
        # document may genuinely succeed — a bad slice on one PDF says nothing
        # about the next one. This must not stop a drain.
        wd = RunWatchdog()
        for _ in range(20):
            wd.record_payload(empty=True)
        assert len(wd.alerts()) == 1
        assert wd.fatal_alert() is None

    def test_cli_failure_streak_is_fatal(self) -> None:
        # This assertion used to be the opposite, on the same reasoning as the
        # empty-payload case — and that reasoning does not hold here.
        # `record_cli_exit`'s own docstring says a genuine nonzero streak means
        # "the CLI itself is broken — auth, binary, sandbox", which is a
        # property of the process, not of the document. The next call fails
        # identically.
        #
        # The 2026-08-18 drain proved it: a CLI exiting 1 on every call wrote
        # 380 failed jobs in fourteen minutes before a human cancelled it,
        # because this returned None.
        wd = RunWatchdog()
        for _ in range(3):
            wd.record_cli_exit(1)
        alert = wd.fatal_alert()
        assert alert is not None
        assert alert.code == "cli_failure_streak"

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


class TestCliFailureStreakIsFatal:
    """A broken CLI must stop the run, not fill the table with failures.

    The guard was written after the 2026-08 dead-key incident and only knew
    the API backend's signatures. On 2026-08-18 the first drain on the
    `claude_cli` backend met a CLI that exited 1 on every call.
    `record_cli_exit` fired its alert correctly — but `cli_failure_streak` was
    not in `_FATAL_CODES`, so `fatal_alert()` returned None, no worker broke,
    and the loop wrote 380 failed jobs in fourteen minutes before a human
    cancelled it. Exactly the self-feeding backlog the guard exists to stop,
    reproduced on the other backend.
    """

    def test_streak_becomes_a_fatal_alert(self) -> None:
        w = RunWatchdog()
        for _ in range(CLI_FAILURE_STREAK_LIMIT):
            w.record_cli_exit(1)
        alert = w.fatal_alert()
        assert alert is not None, "a broken CLI must stop the run"
        assert alert.code == "cli_failure_streak"

    def test_below_the_limit_is_not_fatal(self) -> None:
        # One bad call is a bad call; the streak is what means "broken".
        w = RunWatchdog()
        for _ in range(CLI_FAILURE_STREAK_LIMIT - 1):
            w.record_cli_exit(1)
        assert w.fatal_alert() is None

    def test_a_success_resets_the_streak(self) -> None:
        w = RunWatchdog()
        for _ in range(CLI_FAILURE_STREAK_LIMIT - 1):
            w.record_cli_exit(1)
        w.record_cli_exit(0)
        for _ in range(CLI_FAILURE_STREAK_LIMIT - 1):
            w.record_cli_exit(1)
        assert w.fatal_alert() is None

    def test_usage_limits_never_become_fatal(self) -> None:
        # A usage limit self-heals: the backend waits out the window and
        # resumes. Stopping the run on it would throw away a drain that was
        # about to continue.
        w = RunWatchdog()
        for _ in range(CLI_FAILURE_STREAK_LIMIT * 3):
            w.record_cli_exit(1, usage_limited=True)
        assert w.fatal_alert() is None
