"""List announcements with usable PDF attachments, grouped by source."""
import asyncio
import json

import asyncpg

from uni_db.config import settings


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    rows = await c.fetch(
        "select s.url_ko as src, a.title_ko, "
        "       a.attachments::text as att, a.id as ann_id, "
        "       a.guideline_document_id as gd "
        "from public.announcements a "
        "join public.announcement_sources s on s.id = a.source_id "
        "where a.attachments is not null and jsonb_array_length(a.attachments) > 0 "
        "order by s.url_ko, a.posted_at desc"
    )
    by_src = {}
    for r in rows:
        atch = json.loads(r['att'] or '[]')
        pdfs = [a for a in atch if (a.get('url', '').lower().endswith('.pdf') or
                                     a.get('filename', '').lower().endswith('.pdf') or
                                     '/download/' in (a.get('url') or ''))]
        if pdfs:
            src_short = r['src'].replace('https://', '')[:40]
            by_src.setdefault(src_short, []).append({
                'title': r['title_ko'][:50],
                'ann': str(r['ann_id'])[:8],
                'pdf_url': pdfs[0]['url'][:80],
                'parsed': bool(r['gd']),
            })

    print(f"Total unique sources w/ PDF: {len(by_src)}")
    for src, anns in by_src.items():
        print(f"\n[{src}] ({len(anns)} anns)")
        for a in anns[:3]:
            mark = "ALREADY" if a['parsed'] else "PENDING"
            print(f"  [{mark}] {a['ann']} | {a['title']} | pdf={a['pdf_url']}")
    await c.close()


asyncio.run(main())
