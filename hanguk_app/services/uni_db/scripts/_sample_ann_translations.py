"""Sample 5 announcement title translations across all 3 langs."""
import asyncio
import asyncpg
from uni_db.config import settings


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    # Sample 5 random recent announcements with all 3 lang translations
    sample = await c.fetch(
        "select a.id, a.title_ko from public.announcements a "
        "order by a.posted_at desc nulls last limit 5"
    )
    for a in sample:
        print(f"\nKO: {a['title_ko'][:70]}")
        for lang in ['en', 'vi', 'mn']:
            t = await c.fetchrow(
                "select text_value, provider, confidence "
                "from public.translations "
                "where entity_type='announcements' and entity_id=$1 and field_name='title_ko' and lang=$2",
                a['id'], lang,
            )
            if t:
                print(f"  {lang}: ({t['provider']:8} c={float(t['confidence']):.2f}) {t['text_value'][:75]}")
    await c.close()


asyncio.run(main())
