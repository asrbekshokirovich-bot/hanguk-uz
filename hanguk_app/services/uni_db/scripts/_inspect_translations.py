"""Show translations table contents."""
import asyncio

import asyncpg

from uni_db.config import settings


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)
    rows = await c.fetch(
        "select i.name_ko, t.lang, t.text_value, t.provider, t.confidence "
        "from public.translations t "
        "join public.institutions i on i.id = t.entity_id "
        "where t.entity_type = 'institutions' and t.field_name = 'name_ko' "
        "order by i.name_ko, t.lang"
    )
    for r in rows:
        print(f"  {r['name_ko']:10} | {r['lang']:3} | {r['provider']:8} | conf={float(r['confidence']):.2f} | {r['text_value']}")
    await c.close()


asyncio.run(main())
