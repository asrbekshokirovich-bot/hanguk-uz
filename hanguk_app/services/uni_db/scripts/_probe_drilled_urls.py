"""Second-pass probe: hit the REAL international-notice URLs identified in
Phase 1. Dumps first 3 rows of the most-likely list container so we can
write CSS selectors.
"""

from __future__ import annotations

import asyncio
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


# (name, url, candidate_row_selectors_to_try)
DRILLED = [
    ("cbnu",
     "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do",
     ["table tbody tr", "div.board_list tbody tr", "ul.board-list li"]),

    ("hanyang",
     "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK",
     ["table tbody tr", "ul.board_list li", "div.board-list tbody tr"]),

    ("skku",
     "https://admission.skku.edu/admission/html/abroad/notice.html",
     ["table tbody tr", "ul.list li", "div.board-list tbody tr"]),

    ("jbnu_main",
     "https://enter.jbnu.ac.kr/main.do",
     ["table tbody tr"]),

    ("konkuk_intl",
     "http://enter.konkuk.ac.kr/submenu.do?menuurl=vQ5Um0%2fKclp6EAegmwbvhQ%3d%3d&",
     ["table tbody tr", "ul.board-list li"]),

    ("inha_again",
     "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160",
     ["table tbody tr", "ul.bbs_list li", "div.board-list tr"]),

    ("kangwon_post_intro",
     "https://admission.kangwon.ac.kr/sub01/sub01_05_01.html",
     ["table tbody tr", "ul.board-list li"]),
]


async def probe(pw, name: str, url: str, sels: list[str]) -> None:
    print(f"\n{'='*70}\n[{name}] {url}")
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(
            user_agent="HangukUniDBBot/0.1 (+contact: ops@hanguk.example)",
            locale="ko-KR",
            viewport={"width": 1280, "height": 900},
        )
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=25_000)
        except Exception as e:
            print(f"  goto FAIL: {e}")
            return
        final_url = page.url
        html = await page.content()
        print(f"  final_url: {final_url}")
        print(f"  html_len:  {len(html)}")
        soup = BeautifulSoup(html, "lxml")

        # Try each selector candidate; first one with > 2 hits wins.
        winner = None
        for sel in sels:
            rows = soup.select(sel)
            if len(rows) > 2:
                winner = (sel, rows)
                break

        if not winner:
            # Try generic "rows that look like notice rows"
            for sel in ["tr", "li"]:
                rows = [r for r in soup.select(sel) if r.find("a")]
                if len(rows) >= 5:
                    winner = (sel, rows[:20])
                    print(f"  (fallback to generic {sel}: {len(rows)} candidates)")
                    break

        if not winner:
            print("  NO row selector matched. Body sample:")
            print(soup.get_text(" ", strip=True)[:600])
            return

        sel, rows = winner
        print(f"  WINNING SELECTOR: {sel}  ({len(rows)} rows)")
        # Dump first 3 rows' HTML for selector authoring
        for i, r in enumerate(rows[:3]):
            print(f"  --- row {i} ({len(str(r))} chars) ---")
            print("  " + str(r)[:600].replace("\n", "\n  "))

        # Sample dates
        date_re = re.compile(r"20\d{2}[.\-/ ]\d{1,2}[.\-/ ]\d{1,2}")
        dates = date_re.findall(html)
        print(f"  dates sampled: {dates[:5]}")

    finally:
        await b.close()


async def main():
    async with async_playwright() as pw:
        for name, url, sels in DRILLED:
            try:
                await probe(pw, name, url, sels)
            except Exception as e:
                print(f"  outer error: {e}")


asyncio.run(main())
