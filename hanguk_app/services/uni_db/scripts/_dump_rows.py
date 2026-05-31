"""Dump first 3 full rows from CBNU + JBNU notice lists."""

from __future__ import annotations

import asyncio

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


SHOTS = [
    ("cbnu", "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do",
     "div.board ul li"),
    ("jbnu", "https://enter.jbnu.ac.kr/submenu.do?menuurl=rOjsbGuR5i0fqsax24xcPQ%3D%3D&",
     "div.bbs_list div.tr"),
]


async def main():
    async with async_playwright() as pw:
        for name, url, sel in SHOTS:
            print(f"\n{'='*70}\n[{name}] {url}\n  selector: {sel}")
            b = await pw.chromium.launch(headless=True)
            try:
                ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
                page = await ctx.new_page()
                try:
                    await page.goto(url, wait_until="networkidle", timeout=20_000)
                except Exception:
                    await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                html = await page.content()
                soup = BeautifulSoup(html, "lxml")
                rows = soup.select(sel)
                # Skip header row(s) without any <a>
                data_rows = [r for r in rows if r.find("a")]
                print(f"  total {sel}: {len(rows)}, with <a>: {len(data_rows)}")
                for i, r in enumerate(data_rows[:3]):
                    print(f"  --- row {i} (full {len(str(r))} chars) ---")
                    print(str(r)[:1500])
            finally:
                await b.close()


asyncio.run(main())
