"""Force-reset the KAIST guideline_document so we can re-parse with relaxed schemas."""
import asyncio
import asyncpg
from uni_db.config import settings


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)

    # Find the KAIST guideline_document(s)
    rows = await c.fetch(
        "select gd.id, gd.source_url_ko, count(ej.id) as job_count "
        "from public.guideline_documents gd "
        "left join public.extraction_jobs ej on ej.guideline_document_id = gd.id "
        "where gd.source_url_ko like '%admission.kaist.ac.kr%' "
        "group by gd.id, gd.source_url_ko"
    )
    print(f"Found {len(rows)} KAIST guideline_documents:")
    for r in rows:
        print(f"  {str(r['id'])[:8]} | {r['job_count']} jobs | {r['source_url_ko']}")

    for r in rows:
        gid = r['id']
        # Delete dependent rows
        n = await c.execute("delete from public.review_queue where entity_type='extraction_jobs' and entity_id in (select id from public.extraction_jobs where guideline_document_id = $1)", gid)
        print(f"  deleted review_queue: {n}")
        n = await c.execute("delete from public.extraction_jobs where guideline_document_id = $1", gid)
        print(f"  deleted extraction_jobs: {n}")
        n = await c.execute("update public.announcements set guideline_document_id = null where guideline_document_id = $1", gid)
        print(f"  unlinked announcements: {n}")
        n = await c.execute("delete from public.guideline_documents where id = $1", gid)
        print(f"  deleted gd: {n}")

    await c.close()


asyncio.run(main())
