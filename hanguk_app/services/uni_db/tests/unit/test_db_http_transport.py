"""The HTTPS DB transport (db.HttpConnection) used when the crawl runs in a
Claude Routine sandbox that blocks raw Postgres. Covers param encoding and the
fetch/fetchrow/fetchval/execute surface against a fake httpx client.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import pytest

from uni_db import db


class _FakeResp:
    def __init__(self, payload: dict, status: int = 200) -> None:
        self._payload = payload
        self.status_code = status
        self.text = json.dumps(payload)

    def json(self) -> dict:
        return self._payload


class _FakeHttp:
    """Records the last POST and returns a canned response."""

    def __init__(self, payload: dict, status: int = 200) -> None:
        self._payload = payload
        self._status = status
        self.last: dict | None = None
        self.closed = False

    async def post(self, url, headers=None, json=None):
        self.last = {"url": url, "headers": headers, "json": json}
        return _FakeResp(self._payload, self._status)

    async def aclose(self) -> None:
        self.closed = True


def _conn(payload, status=200):
    http = _FakeHttp(payload, status)
    return db.HttpConnection("https://proj.supabase.co", "svc-key", http), http


def test_encode_param_maps_types():
    assert db._encode_param(UUID("11111111-1111-1111-1111-111111111111")) == "11111111-1111-1111-1111-111111111111"
    assert db._encode_param(datetime(2027, 3, 1, tzinfo=timezone.utc)).startswith("2027-03-01")
    assert json.loads(db._encode_param({"k": [1, 2]})) == {"k": [1, 2]}
    assert db._encode_param(42) == 42
    assert db._encode_param(None) is None


async def test_fetch_returns_rows_and_sends_auth():
    conn, http = _conn({"rows": [{"id": "abc", "n": 3}]})
    rows = await conn.fetch("select $1", 7)
    assert rows == [{"id": "abc", "n": 3}]
    assert http.last["url"].endswith("/functions/v1/db-exec")
    assert http.last["headers"]["Authorization"] == "Bearer svc-key"
    assert http.last["headers"]["apikey"] == "svc-key"
    assert http.last["json"]["params"] == [7]


async def test_fetchrow_and_fetchval_and_positional():
    conn, _ = _conn({"rows": [{"a": "x", "b": 9}]})
    row = await conn.fetchrow("select 1")
    assert row["a"] == "x"
    assert row[0] == "x" and row[1] == 9  # positional like asyncpg.Record
    conn2, _ = _conn({"rows": [{"count": 334}]})
    assert await conn2.fetchval("select count(*)") == 334


async def test_fetchrow_none_when_empty():
    conn, _ = _conn({"rows": []})
    assert await conn.fetchrow("select 1") is None
    conn2, _ = _conn({"rows": []})
    assert await conn2.fetchval("select 1") is None


async def test_execute_and_error_surface():
    conn, http = _conn({"rowCount": 1})
    assert await conn.execute("update t set x=1") == "OK"
    await conn.close()
    assert http.closed is True

    bad, _ = _conn({"error": "boom"}, status=500)
    with pytest.raises(RuntimeError):
        await bad.fetch("select 1")
