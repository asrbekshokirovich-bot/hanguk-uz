"""Reset next_poll_at to now() for matched source(s)."""
import asyncio
import sys
import asyncpg
from uni_db.config import settings


async def main(pattern: str):
    c = await asyncpg.connect(settings.supabase_db_url)
    n = await c.execute(
        "update public.announcement_sources "
        "set next_poll_at = now() "
        "where url_ko like $1",
        f"%{pattern}%",
    )
    print(f"reset: {n}")
    await c.close()


if __name__ == "__main__":
    pattern = sys.argv[1] if len(sys.argv) > 1 else "konkuk"
    asyncio.run(main(pattern))
