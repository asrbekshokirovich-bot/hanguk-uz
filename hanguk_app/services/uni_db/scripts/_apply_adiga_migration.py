"""One-off: apply 20260615000000_uni_db_v3_adiga_calendar_events.sql to
the configured SUPABASE_DB_URL and verify the table exists.

Idempotent — the migration uses `create table if not exists` etc., so
re-runs are safe.
"""

from __future__ import annotations

import asyncio
import pathlib
import sys

import asyncpg

from uni_db.config import settings

MIG = pathlib.Path(__file__).resolve().parents[3] / "supabase" / "migrations" / (
    "20260615000000_uni_db_v3_adiga_calendar_events.sql"
)


async def main() -> int:
    sql = MIG.read_text(encoding="utf-8")
    print(f"Migration: {MIG.name} ({len(sql)} bytes)")
    if not settings.supabase_db_url:
        print("FATAL: SUPABASE_DB_URL not set")
        return 1
    host = settings.supabase_db_url.split("@")[1].split("/")[0]
    print(f"Connecting to: {host}")
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        async with conn.transaction():
            await conn.execute(sql)
        print("Migration committed.")
        exists = await conn.fetchval(
            "select to_regclass('public.adiga_calendar_events') is not null"
        )
        print(f"Table exists post-migration: {exists}")
        cols = await conn.fetch(
            "select column_name, data_type from information_schema.columns "
            "where table_schema='public' and table_name='adiga_calendar_events' "
            "order by ordinal_position"
        )
        print(f"Columns ({len(cols)}):")
        for r in cols:
            print(f"  - {r['column_name']:30s} {r['data_type']}")
        idx = await conn.fetch(
            "select indexname from pg_indexes "
            "where schemaname='public' and tablename='adiga_calendar_events' "
            "order by indexname"
        )
        print(f"Indexes ({len(idx)}):")
        for r in idx:
            print(f"  - {r['indexname']}")
        pol = await conn.fetch(
            "select policyname from pg_policies "
            "where schemaname='public' and tablename='adiga_calendar_events'"
        )
        print(f"RLS policies ({len(pol)}):")
        for r in pol:
            print(f"  - {r['policyname']}")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
