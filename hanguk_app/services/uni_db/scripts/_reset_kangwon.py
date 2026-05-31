"""Reset Kangwon next_poll_at to now() so it shows up in due_sources."""
import asyncio
import asyncpg
from uni_db.config import settings


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    n = await c.execute(
        "update public.announcement_sources "
        "set next_poll_at = now(), status = 'live' "
        "where url_ko like '%kangwon%'"
    )
    print(f"  rows: {n}")
    rows = await c.fetch(
        "select url_ko, status, next_poll_at from public.announcement_sources "
        "where url_ko like '%kangwon%'"
    )
    for r in rows:
        print(f"  {r['url_ko']}  status={r['status']}  next_poll_at={r['next_poll_at']}")
    await c.close()


asyncio.run(main())
