"""`todo`'s cooldown args and the `flag-blocked` command.

`flag-blocked` lets the Routine agent record "this site couldn't be reached/
verified this run" so tomorrow's `todo` doesn't hand the same dead-end site
back out immediately. DB-facing behavior (the actual SQL) is covered at the
worker level in test_guideline_finder_worker.py; here we cover arg parsing
and the config-refusal path, matching the existing CLI test convention.
"""

from __future__ import annotations

import pytest

from uni_db import cli


def test_todo_arg_defaults() -> None:
    args = cli._build_parser().parse_args(["todo"])
    assert args.cmd == "todo"
    assert args.limit == 20
    assert args.cooldown_days == 3
    assert args.include_flagged is False


def test_todo_arg_overrides() -> None:
    args = cli._build_parser().parse_args(
        ["todo", "--limit", "50", "--cooldown-days", "7", "--include-flagged"]
    )
    assert args.limit == 50
    assert args.cooldown_days == 7
    assert args.include_flagged is True


def test_flag_blocked_arg_parsing() -> None:
    args = cli._build_parser().parse_args(
        ["flag-blocked", "--institution", "abc-123", "--reason", "HTTP 503"]
    )
    assert args.cmd == "flag-blocked"
    assert args.institution == "abc-123"
    assert args.reason == "HTTP 503"
    assert args.url is None


async def test_flag_blocked_refuses_without_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "")
    assert await cli._flag_blocked(
        institution_id="00000000-0000-0000-0000-000000000000",
        reason="HTTP 503", url=None,
    ) == 2


async def test_flag_blocked_rejects_non_uuid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    assert await cli._flag_blocked(
        institution_id="not-a-uuid", reason="HTTP 503", url=None,
    ) == 2
