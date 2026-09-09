"""`pipeline_watchdog_log` -> a real notification.

2026-09-01 audit finding: the table is written hourly by DB-side functions
and had 50 `alert_claude_routine_stale` entries in 30 days, but nothing ever
read it — both August outages were found by a human noticing stale data
days later, not by this table. `check-watchdog-alerts` fails the scheduled
CI run (GitHub's existing failure-email path) when a fatal alert is fresh.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from uni_db import cli
from uni_db.hitl.watchdog_alerts import (
    WatchdogAlert,
    classify,
    format_github_annotations,
    since_cutoff,
)


def _alert(action: str, minutes_ago: int = 5, **details) -> WatchdogAlert:
    now = datetime(2026, 9, 1, 15, 0, tzinfo=timezone.utc)
    return WatchdogAlert(action=action, details=details, created_at=now - timedelta(minutes=minutes_ago))


class TestClassify:
    def test_known_fatal_codes(self) -> None:
        fatal, advisory = classify([
            _alert("alert_claude_routine_stale"),
            _alert("api_credit_balance"),
            _alert("api_auth_failure"),
            _alert("cli_failure_streak"),
        ])
        assert len(fatal) == 4
        assert advisory == []

    def test_known_advisory_codes(self) -> None:
        fatal, advisory = classify([
            _alert("alert_sources_overdue"),
            _alert("alert_review_backlog"),
            _alert("alert_extraction_failures"),
        ])
        assert fatal == []
        assert len(advisory) == 3

    def test_unrecognised_code_defaults_to_fatal(self) -> None:
        """A new alert code the classifier has never seen must not be
        silently treated as safe — the exact gap 0e3c157 found (a real
        failure code missing from watchdog.py's fatal set let 382 jobs fail
        silently before anyone noticed)."""
        fatal, advisory = classify([_alert("some_future_alert_code")])
        assert len(fatal) == 1
        assert advisory == []


class TestAnnotations:
    def test_fatal_renders_as_error_advisory_as_warning(self) -> None:
        lines = format_github_annotations([
            _alert("api_credit_balance", reason="balance too low"),
            _alert("alert_sources_overdue", count=36),
        ])
        assert any(l.startswith("::error::") and "api_credit_balance" in l for l in lines)
        assert any(l.startswith("::warning::") and "alert_sources_overdue" in l for l in lines)

    def test_detail_dict_is_summarized_not_dumped_raw(self) -> None:
        lines = format_github_annotations([_alert("api_auth_failure", status=401, host="anthropic")])
        assert "status=401" in lines[0]


class TestSinceCutoff:
    def test_subtracts_the_window(self) -> None:
        now = datetime(2026, 9, 1, 15, 0, tzinfo=timezone.utc)
        assert since_cutoff(90, now=now) == datetime(2026, 9, 1, 13, 30, tzinfo=timezone.utc)


def test_arg_parsing_defaults() -> None:
    args = cli._build_parser().parse_args(["check-watchdog-alerts"])
    assert args.cmd == "check-watchdog-alerts"
    assert args.window_minutes == 90


def test_arg_parsing_override() -> None:
    args = cli._build_parser().parse_args(["check-watchdog-alerts", "--window-minutes", "30"])
    assert args.window_minutes == 30


class _FakeAlertConn:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    async def fetch(self, sql: str, *args: object) -> list[dict]:
        return self._rows


class _FakeAcquire:
    def __init__(self, conn: _FakeAlertConn) -> None:
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


async def test_check_watchdog_alerts_exits_zero_when_clean(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    monkeypatch.setattr(cli.db, "acquire", lambda: _FakeAcquire(_FakeAlertConn([])))
    rc = await cli._check_watchdog_alerts(window_minutes=90)
    assert rc == 0


async def test_check_watchdog_alerts_decodes_jsonb_string_details(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pins the json.loads fix directly, independent of the exit-code
    assertions above: a string-encoded details column must not be treated
    as an empty/opaque blob."""
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    rows = [{
        "action": "cli_failure_streak",
        "details": json.dumps({"streak": 3, "exit_code": 1}),
        "created_at": datetime.now(timezone.utc),
    }]
    monkeypatch.setattr(cli.db, "acquire", lambda: _FakeAcquire(_FakeAlertConn(rows)))
    rc = await cli._check_watchdog_alerts(window_minutes=90)
    assert rc == 1


async def test_check_watchdog_alerts_tolerates_malformed_details(monkeypatch: pytest.MonkeyPatch) -> None:
    """A malformed/non-JSON details value must not crash the check — the
    alert itself (action + timestamp) is still the signal that matters."""
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    rows = [{
        "action": "api_auth_failure",
        "details": "not valid json {{{",
        "created_at": datetime.now(timezone.utc),
    }]
    monkeypatch.setattr(cli.db, "acquire", lambda: _FakeAcquire(_FakeAlertConn(rows)))
    rc = await cli._check_watchdog_alerts(window_minutes=90)
    assert rc == 1


async def test_check_watchdog_alerts_exits_nonzero_on_fatal(monkeypatch: pytest.MonkeyPatch) -> None:
    """The exact scenario this feature exists for: a fresh credit-exhaustion
    alert must fail the run, not sit unread in the table.

    `details` is passed as a JSON STRING, matching real asyncpg behaviour on
    this pool (no jsonb codec is registered — see fetch_worker.py's own
    json.loads for the same reason) — a dict here would silently mask a real
    decoding bug this exact test caught before it ever ran against prod."""
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    rows = [{
        "action": "api_credit_balance",
        "details": json.dumps({"reason": "balance too low"}),
        "created_at": datetime.now(timezone.utc),
    }]
    monkeypatch.setattr(cli.db, "acquire", lambda: _FakeAcquire(_FakeAlertConn(rows)))
    rc = await cli._check_watchdog_alerts(window_minutes=90)
    assert rc == 1


async def test_check_watchdog_alerts_exits_zero_on_advisory_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    rows = [{
        "action": "alert_sources_overdue",
        "details": json.dumps({"count": 36}),
        "created_at": datetime.now(timezone.utc),
    }]
    monkeypatch.setattr(cli.db, "acquire", lambda: _FakeAcquire(_FakeAlertConn(rows)))
    rc = await cli._check_watchdog_alerts(window_minutes=90)
    assert rc == 0


async def test_check_watchdog_alerts_noops_without_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", None)
    rc = await cli._check_watchdog_alerts(window_minutes=90)
    assert rc == 0
