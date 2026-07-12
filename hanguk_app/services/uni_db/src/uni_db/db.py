"""Postgres connection helpers.

Phase 0: not exercised against a live DB. Tests use asyncpg.Connection
mocks; the live workers will use the real pool.
"""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Any, AsyncIterator
from uuid import UUID

import asyncpg

from .config import settings

log = logging.getLogger(__name__)

_POOL: asyncpg.Pool | None = None


# --- HTTPS transport --------------------------------------------------------
# When the crawl runs in a Claude Routine sandbox, only HTTP(S) is allowed out;
# raw Postgres (5432/6543) is blocked. `HttpConnection` speaks the small subset
# of the asyncpg.Connection API the crawl uses (fetch/fetchrow/fetchval/execute
# — no transactions) by POSTing one parameterized statement to the `db-exec`
# edge function, which runs it against the DB from inside Supabase's network.


class _Row(dict):
    """A result row. dict access `row["col"]` like asyncpg.Record; also allows
    positional `row[0]` (column order == JSON key order == SQL select order)."""

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def _encode_param(v: Any) -> Any:
    """Map a Python query arg to a JSON-safe value the DB can cast back.

    asyncpg encodes these natively; over JSON we send text/objects and let
    Postgres's implicit casts (text→uuid/timestamptz, text→jsonb) recover them.
    """
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v  # str / int / float / bool / None pass straight through


class HttpConnection:
    """asyncpg-compatible connection that runs SQL over HTTPS via `db-exec`."""

    def __init__(self, base_url: str, service_key: str, client: Any) -> None:
        self._url = base_url.rstrip("/") + "/functions/v1/db-exec"
        self._key = service_key
        self._http = client

    async def _post(self, sql: str, args: tuple[Any, ...]) -> list[_Row]:
        resp = await self._http.post(
            self._url,
            headers={
                "Authorization": f"Bearer {self._key}",
                "apikey": self._key,
                "Content-Type": "application/json",
            },
            json={"sql": sql, "params": [_encode_param(a) for a in args]},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"db-exec HTTP {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(f"db-exec error: {str(data['error'])[:300]}")
        return [_Row(row) for row in data.get("rows", [])]

    async def fetch(self, sql: str, *args: Any) -> list[_Row]:
        return await self._post(sql, args)

    async def fetchrow(self, sql: str, *args: Any) -> _Row | None:
        rows = await self._post(sql, args)
        return rows[0] if rows else None

    async def fetchval(self, sql: str, *args: Any, column: int = 0) -> Any:
        rows = await self._post(sql, args)
        if not rows:
            return None
        vals = list(rows[0].values())
        return vals[column] if column < len(vals) else None

    async def execute(self, sql: str, *args: Any) -> str:
        await self._post(sql, args)
        return "OK"

    async def close(self) -> None:
        await self._http.aclose()


async def connect() -> Any:
    """Open a DB connection honoring `settings.db_transport`.

    postgres (default) → asyncpg direct connection.
    http               → HTTPS shim via the db-exec edge function (sandbox-safe).

    Call sites use it exactly like `await asyncpg.connect(...)` and
    `await conn.close()`.
    """
    if settings.db_transport == "http":
        import httpx

        if not (settings.supabase_url and settings.supabase_service_role_key):
            raise RuntimeError(
                "UNI_DB_DB_TRANSPORT=http needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
            )
        client = httpx.AsyncClient(timeout=120.0)
        return HttpConnection(settings.supabase_url, settings.supabase_service_role_key, client)
    return await asyncpg.connect(settings.supabase_db_url)


async def get_pool() -> asyncpg.Pool:
    global _POOL
    if _POOL is None:
        if not settings.supabase_db_url:
            raise RuntimeError(
                "SUPABASE_DB_URL is empty; refusing to open a Postgres pool. "
                "Phase 0 keeps live DB access off — set the env in .env first."
            )
        _POOL = await asyncpg.create_pool(
            dsn=settings.supabase_db_url,
            min_size=1,
            max_size=4,
            command_timeout=30,
        )
        log.info("postgres pool opened")
    return _POOL


@asynccontextmanager
async def acquire() -> AsyncIterator[asyncpg.Connection]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
