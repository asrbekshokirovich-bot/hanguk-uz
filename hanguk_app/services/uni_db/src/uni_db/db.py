"""Postgres connection helpers.

Phase 0: not exercised against a live DB. Tests use asyncpg.Connection
mocks; the live workers will use the real pool.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg

from .config import settings

log = logging.getLogger(__name__)

_POOL: asyncpg.Pool | None = None


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
