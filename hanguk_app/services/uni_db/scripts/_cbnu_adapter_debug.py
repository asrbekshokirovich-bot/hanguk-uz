"""Run the CBNU adapter in isolation to see why it returns 0 rows."""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx

from uni_db.discovery.adapters.configs.cbnu import (
    CBNU_SELECTORS,
    make_cbnu_adapter,
)


async def main():
    async with httpx.AsyncClient(
        headers={"User-Agent": "HangukUniDBBot/0.1"},
        follow_redirects=True,
        timeout=20.0,
    ) as http:
        adapter = make_cbnu_adapter(
            source_id=uuid4(),
            institution_id=None,
            source_url_ko="https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do",
            http_client=http,
        )
        since = datetime.now(timezone.utc) - timedelta(days=365)
        anns = await adapter.list_recent_posts(since)
        print(f"list_recent_posts returned: {len(anns)} announcements")
        for a in anns[:3]:
            print(f"  - {a.posted_at} | {a.title_ko[:60]} | {a.url_ko[:60]}")

        # Direct extraction debug
        from bs4 import BeautifulSoup
        resp = await http.get(adapter.source_url_ko)
        soup = BeautifulSoup(resp.text, "lxml")
        rows = soup.select(CBNU_SELECTORS.row)
        print(f"\nRaw selector hits: {len(rows)} rows")
        for i, r in enumerate(rows[:3]):
            t = r.select_one(CBNU_SELECTORS.title)
            l = r.select_one(CBNU_SELECTORS.link)
            d = r.select_one(CBNU_SELECTORS.posted_at)
            print(f"  row {i}: title={'YES' if t else 'NO':3}  link={'YES' if l else 'NO':3}  date={'YES' if d else 'NO':3}")
            if t:
                print(f"    title text: {t.get_text(strip=True)[:60]!r}")
            if l:
                print(f"    link onclick: {(l.get('onclick') or '')[:60]!r}")
                print(f"    link href: {(l.get('href') or '')[:30]!r}")
            if d:
                print(f"    date text: {d.get_text(strip=True)[:60]!r}")


asyncio.run(main())
