"""Verify parse pipeline outputs."""
import asyncio
import json

import asyncpg

from uni_db.config import settings


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)

    gd_count = await c.fetchval("select count(*) from public.guideline_documents")
    ej_count = await c.fetchval("select count(*) from public.extraction_jobs")
    rq_count = await c.fetchval("select count(*) from public.review_queue")
    print(f"guideline_documents={gd_count}  extraction_jobs={ej_count}  review_queue={rq_count}")
    print()

    print("=== guideline_documents ===")
    for r in await c.fetch(
        "select id, source_url_ko, parse_status, archetype, file_size_bytes from public.guideline_documents"
    ):
        print(f"  {str(r['id'])[:8]} | {r['parse_status']} | arch={r['archetype']} | {r['file_size_bytes']} bytes | {r['source_url_ko'][:50]}")

    print("\n=== extraction_jobs ===")
    for r in await c.fetch(
        "select field_group, status, cost_usd, accuracy_self_score, "
        " left(parsed_output::text, 80) as parsed_preview "
        "from public.extraction_jobs order by field_group"
    ):
        print(f"  {r['field_group']:20} | {r['status']:10} | conf={r['accuracy_self_score']:.2f} | ${r['cost_usd']:.4f} | {r['parsed_preview']}")

    print("\n=== review_queue ===")
    for r in await c.fetch(
        "select reason, priority, status, reviewer_notes "
        "from public.review_queue order by priority"
    ):
        print(f"  P{r['priority']} | {r['reason']:25} | {r['status']:8} | {(r['reviewer_notes'] or '')[:120]}")

    await c.close()


asyncio.run(main())
