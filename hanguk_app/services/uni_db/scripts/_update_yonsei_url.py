"""Update Yonsei announcement_sources.url_ko to the actual notice list URL."""
import asyncio

import asyncpg

from uni_db.config import settings


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)

    pairs = [
        ("https://admission.yonsei.ac.kr/",
         "https://admission.yonsei.ac.kr/seoul/admission/html/international/notice.asp"),
        ("https://admission.yonsei.ac.kr/mirae",
         "https://admission.yonsei.ac.kr/wonju/admission/html/international/notice.asp"),
    ]
    for old, new in pairs:
        r = await c.fetchrow(
            "select id, status from public.announcement_sources where url_ko = $1", old
        )
        if r:
            await c.execute(
                "update public.announcement_sources "
                "  set url_ko = $1, next_poll_at = now() "
                "where id = $2",
                new, r["id"],
            )
            print(f"  {old}  ->  {new}")
        else:
            print(f"  not found: {old}")

    await c.close()


asyncio.run(main())
