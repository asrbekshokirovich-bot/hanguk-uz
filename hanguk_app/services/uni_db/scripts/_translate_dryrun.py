"""Dry-run the expanded translation worker SQL — count jobs per lang."""
import asyncio
import asyncpg
from uni_db.config import settings
from uni_db.workers.translate_worker import fetch_pending_jobs


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    for lang in ["en", "vi", "mn"]:
        jobs = await fetch_pending_jobs(c, target_lang=lang, limit=200)
        ent_types = {}
        for j in jobs:
            ent_types[j.entity_type] = ent_types.get(j.entity_type, 0) + 1
        print(f"  {lang}: {len(jobs)} pending jobs  {ent_types}")
    await c.close()


asyncio.run(main())
