"""Compare what httpx vs Playwright see for CBNU."""

import asyncio
import re

import httpx
from bs4 import BeautifulSoup


URL = "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do"


async def main():
    async with httpx.AsyncClient(
        headers={"User-Agent": "HangukUniDBBot/0.1 (+contact: ops@hanguk.example)"},
        follow_redirects=True,
        timeout=20.0,
    ) as http:
        resp = await http.get(URL)
        print(f"  status:    {resp.status_code}")
        print(f"  final url: {resp.url}")
        print(f"  bytes:     {len(resp.content)}")
        print(f"  enc:       {resp.encoding}")

        html = resp.text
        soup = BeautifulSoup(html, "lxml")
        for sel in [
            "div.board ul li",
            "ul li",
            "table tbody tr",
            "li",
        ]:
            n = len(soup.select(sel))
            print(f"  {sel:25} -> {n} hits")

        # Search for the title pattern
        if "bbsMstrView" in html:
            print("  YES: 'bbsMstrView' present in raw HTML")
        else:
            print("  NO: 'bbsMstrView' NOT in raw HTML (page is JS-rendered)")

        # Print first 500 chars of body for sanity
        body_text = soup.get_text(" ", strip=True)
        print(f"\n  body sample: {body_text[:400]!r}")


asyncio.run(main())
