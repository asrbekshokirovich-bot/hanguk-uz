"""Dump Job #1's full raw_output and run _FENCE_RE against it.

Goal: confirm whether the fence regex is broken or whether the raw text
itself is degenerate (e.g. truncated, double-fenced, BOM-prefixed).
"""

from __future__ import annotations

import asyncio
import json
import sys

import asyncpg

from uni_db.config import settings
from uni_db.extract.llm_anthropic import _FENCE_RE, _strip_fences

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

JOB_ID = "0f356086-72de-43fd-b51b-505f3a8297b3"


async def main() -> int:
    conn = await asyncpg.connect(settings.supabase_db_url)
    try:
        row = await conn.fetchrow(
            "select raw_output, parsed_output, error_text "
            "from public.extraction_jobs where id = $1",
            JOB_ID,
        )
        if not row:
            print(f"Job {JOB_ID} not found")
            return 1
        raw = row["raw_output"]
        print(f"raw_output type: {type(raw).__name__}")
        if raw is None:
            print("raw_output is NULL")
            return 0
        # raw_output is jsonb — could be a string or an object
        if isinstance(raw, str):
            raw_str = raw
        else:
            try:
                raw_str = json.dumps(raw, ensure_ascii=False)
            except Exception:
                raw_str = str(raw)
        print(f"raw_output length: {len(raw_str)} chars")
        print(f"raw_output[:100] repr: {raw_str[:100]!r}")
        print(f"raw_output[-200:] repr: {raw_str[-200:]!r}")
        print()
        print("--- raw_output full content ---")
        print(raw_str)
        print("--- end ---")
        print()

        # Now run the actual fence-stripper on it
        stripped = _strip_fences(raw_str)
        print(f"After _strip_fences: length={len(stripped)}, first 80 repr: {stripped[:80]!r}")
        # And try to parse
        try:
            parsed = json.loads(stripped)
            print(f"json.loads ok: type={type(parsed).__name__}")
            if isinstance(parsed, dict):
                print(f"top-level keys: {sorted(parsed.keys())}")
        except json.JSONDecodeError as exc:
            print(f"json.loads FAILED: {exc}")
            print(f"first 200 of stripped: {stripped[:200]!r}")
    finally:
        await conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
