"""Count translations grouped by lang + entity_type."""
import asyncio
import asyncpg
from uni_db.config import settings


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    rows = await c.fetch(
        "select lang, entity_type, count(*) as n "
        "from public.translations "
        "group by lang, entity_type "
        "order by lang, entity_type"
    )
    for r in rows:
        print(f"  {r['lang']}/{r['entity_type']:15} : {r['n']}")
    total = await c.fetchval("select count(*) from public.translations")
    print(f"  TOTAL: {total}")
    await c.close()


asyncio.run(main())
