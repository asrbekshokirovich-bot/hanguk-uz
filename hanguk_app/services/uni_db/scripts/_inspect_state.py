"""Quick DB state inspector — what's in announcements/guideline_documents."""
import asyncio
import json

import asyncpg

from uni_db.config import settings


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)

    print("=== Recent announcements + attachments ===")
    rows = await c.fetch(
        "select s.url_ko as src, a.id, a.title_ko, a.attachments::text as att "
        "from public.announcements a "
        "join public.announcement_sources s on s.id = a.source_id "
        "order by a.posted_at desc limit 8"
    )
    for r in rows:
        atch = json.loads(r["att"] or "[]")
        src = r["src"].replace("https://", "")[:35]
        print(f"[{src}] {r['title_ko'][:50]} | {len(atch)} attachments")
        for a in atch[:2]:
            url = (a.get("url") or "")[:90]
            print(f"     -> {a.get('filename')} :: {url}")

    print()
    gd_count = await c.fetchval("select count(*) from public.guideline_documents")
    print(f"guideline_documents rows: {gd_count}")

    cols = await c.fetch(
        "select column_name, data_type from information_schema.columns "
        "where table_name='guideline_documents' order by ordinal_position"
    )
    print("guideline_documents columns:")
    for r in cols:
        print(f"  {r['column_name']} - {r['data_type']}")

    await c.close()


asyncio.run(main())
