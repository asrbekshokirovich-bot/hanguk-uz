"""Reset the in-flight guideline_document so we can retry parse on the same announcement."""
import asyncio

import asyncpg

from uni_db.config import settings


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)
    # Find pending gd rows with no archetype (= aborted before parse_outcome wrote)
    rows = await c.fetch(
        "select id from public.guideline_documents "
        "where parse_status='pending' and archetype is null"
    )
    ids = [r["id"] for r in rows]
    print(f"Pending unfinished gd rows: {len(ids)}")

    for gid in ids:
        await c.execute(
            "delete from public.extraction_jobs where guideline_document_id = $1", gid
        )
        await c.execute(
            "update public.announcements set guideline_document_id = null where guideline_document_id = $1", gid
        )
        await c.execute(
            "delete from public.guideline_documents where id = $1", gid
        )
        print(f"  deleted {str(gid)[:8]}")

    await c.close()


asyncio.run(main())
