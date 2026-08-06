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
    assert args.name is None


def test_flag_blocked_arg_parsing_with_name() -> None:
    args = cli._build_parser().parse_args(
        ["flag-blocked", "--institution", "abc-123", "--reason", "HTTP 503",
         "--name", "한경대학교"]
    )
    assert args.name == "한경대학교"


def test_ingest_url_arg_parsing_with_name() -> None:
    args = cli._build_parser().parse_args(
        ["ingest-url", "--institution", "abc-123", "--url", "https://x.ac.kr/g.pdf",
         "--name", "한경대학교"]
    )
    assert args.cmd == "ingest-url"
    assert args.name == "한경대학교"


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


# --- --name: a safety net against a copy-pasted-wrong-UUID mistake ----------
# (this bit for real once: a --institution UUID that resolved to a
# DIFFERENT school than the one intended, silently mis-flagging it).


class _FakeConn:
    def __init__(self, row: dict | None) -> None:
        self._row = row
        self.executed: list[tuple] = []
        self.closed = False

    async def fetchrow(self, sql: str, *args: object) -> dict | None:
        return self._row

    async def execute(self, sql: str, *args: object) -> str:
        self.executed.append((sql, args))
        return "OK"

    async def close(self) -> None:
        self.closed = True


def test_institution_name_mismatch_helper() -> None:
    assert cli._institution_name_mismatch(
        provided=None, name_ko="한경대학교", name_en=None,
    ) is None
    assert cli._institution_name_mismatch(
        provided="한경대학교", name_ko="한경대학교", name_en=None,
    ) is None
    err = cli._institution_name_mismatch(
        provided="순천향대학교", name_ko="한경대학교", name_en=None,
    )
    assert err is not None and "does not match" in err


async def test_flag_blocked_aborts_on_name_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    fake_conn = _FakeConn({
        "name_ko": "한경대학교", "name_en": None,
        "primary_admissions_url_ko": None, "primary_domain": "hknu.ac.kr",
    })

    async def _fake_connect():
        return fake_conn

    monkeypatch.setattr(cli.db, "connect", _fake_connect)

    rc = await cli._flag_blocked(
        institution_id="00000000-0000-0000-0000-000000000000",
        reason="HTTP 503", url=None, name="순천향대학교",  # wrong school on purpose
    )
    assert rc == 2
    assert fake_conn.executed == []  # nothing written — the mismatch aborted it


async def test_flag_blocked_proceeds_on_name_match(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "postgres://x")
    fake_conn = _FakeConn({
        "name_ko": "한경대학교", "name_en": None,
        "primary_admissions_url_ko": None, "primary_domain": "hknu.ac.kr",
    })

    async def _fake_connect():
        return fake_conn

    monkeypatch.setattr(cli.db, "connect", _fake_connect)

    rc = await cli._flag_blocked(
        institution_id="00000000-0000-0000-0000-000000000000",
        reason="HTTP 503", url=None, name="한경대학교",
    )
    assert rc == 0
    assert len(fake_conn.executed) == 1  # the note was written
    assert fake_conn.closed is True


def test_backfill_review_queue_arg_defaults() -> None:
    args = cli._build_parser().parse_args(["backfill-review-queue"])
    assert args.cmd == "backfill-review-queue"
    assert args.limit == 500


async def test_backfill_review_queue_refuses_without_db_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cli.settings, "supabase_db_url", "")
    assert await cli._backfill_review_queue(limit=500) == 2
