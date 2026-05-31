"""Show parsed_output quality across the latest parse run."""
import asyncio
import json

import asyncpg

from uni_db.config import settings


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    rows = await c.fetch(
        "select field_group, accuracy_self_score, cost_usd, "
        "       length(parsed_output::text) as pl, "
        "       parsed_output::text as po "
        "from public.extraction_jobs "
        "order by field_group"
    )
    for r in rows:
        po = r['po']
        try:
            parsed = json.loads(po)
        except Exception:
            parsed = None
        is_failed = isinstance(parsed, dict) and '_extraction_failed' in parsed
        status = "FAIL " if is_failed else "OK   "
        print(f"  [{status}] {r['field_group']:20} conf={float(r['accuracy_self_score']):.2f}  ${r['cost_usd']:.4f}  {r['pl']} chars")
        if is_failed:
            print(f"           reason: {parsed['_extraction_failed'][:120]}")
        else:
            # Print first 200 chars of parsed_output
            print(f"           preview: {po[:200]}")
    await c.close()


asyncio.run(main())
