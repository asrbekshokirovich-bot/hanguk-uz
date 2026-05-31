"""The `run-pipeline` command must refuse to fire unless explicitly enabled.

It performs real ac.kr fetches + paid LLM extraction, so a misconfigured
scheduler must not be able to trigger it by accident.
"""

from __future__ import annotations

import pytest

from uni_db import cli


def test_arg_parsing_default_limit() -> None:
    args = cli._build_parser().parse_args(["run-pipeline"])
    assert args.cmd == "run-pipeline"
    assert args.limit == 25


async def test_refuses_when_live_flags_off() -> None:
    # conftest sets UNI_DB_LIVE_* = false; the command must exit 2 and not
    # attempt any DB/HTTP work. (Awaited directly to avoid a nested
    # asyncio.run interfering with the suite's event loop.)
    assert await cli._run_pipeline(limit=25) == 2


async def test_refuses_when_live_but_no_db_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cli.settings, "live_crawl", True)
    monkeypatch.setattr(cli.settings, "live_apis", True)
    monkeypatch.setattr(cli.settings, "supabase_db_url", "")
    assert await cli._run_pipeline(limit=25) == 2


def test_reparse_arg_parsing() -> None:
    args = cli._build_parser().parse_args(["reparse", "--institution", "inha.ac.kr"])
    assert args.cmd == "reparse"
    assert args.limit == 25
    assert args.institution == "inha.ac.kr"


async def test_reparse_refuses_when_live_apis_off() -> None:
    # conftest sets UNI_DB_LIVE_APIS=false → paid re-extraction must refuse.
    assert await cli._reparse(limit=10, institution=None) == 2
