"""Read-only verification: are the new requirements jobs in staging clean?"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

import asyncpg

from uni_db.config import settings

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main() -> int:
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        kaist_id = await conn.fetchval(
            "select id from public.institutions where name_ko='한국과학기술원'"
        )
        rows = await conn.fetch(
            """
            select ej.id, ej.archetype, ej.status, ej.parsed_output,
                   ej.cost_usd, ej.started_at,
                   gd.id as gd_id
              from public.extraction_jobs ej
              join public.guideline_documents gd on gd.id = ej.guideline_document_id
             where gd.institution_id = $1
               and ej.field_group = 'requirements'
             order by ej.started_at
            """,
            kaist_id,
        )
        print(f"KAIST requirements jobs in DB ({len(rows)}):\n")
        for r in rows:
            parsed = r["parsed_output"]
            if isinstance(parsed, str):
                parsed = json.loads(parsed)
            if isinstance(parsed, dict) and "_extraction_failed" in parsed:
                state = "FAILED (old)"
                detail = parsed["_extraction_failed"][:80]
            elif isinstance(parsed, dict) and "rows" in parsed:
                state = f"OK rows={len(parsed['rows'])}"
                detail = ""
            else:
                state = "UNKNOWN"
                detail = str(parsed)[:80]
            print(
                f"  {str(r['id'])[:8]}  arch={r['archetype']}  gd={str(r['gd_id'])[:8]}  "
                f"{r['started_at'].strftime('%Y-%m-%d %H:%M')}  ${r['cost_usd']}  → {state}  {detail}"
            )
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
