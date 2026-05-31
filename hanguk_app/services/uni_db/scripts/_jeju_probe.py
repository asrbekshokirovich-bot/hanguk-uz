"""Find Jeju National University's notice list URL.

The /10000048 path was labeled 공지사항 on the homepage. Probe it.
"""

import asyncio
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


CANDIDATES = [
    "https://ibsi.jejunu.ac.kr/10000048",  # 공지사항
    "https://ibsi.jejunu.ac.kr/10000026",  # 재외국민 모집요강
]


async def main():
    async with async_playwright() as pw:
        for url in CANDIDATES:
            b = await pw.chromium.launch(headless=True)
            try:
                page = await (await b.new_context(locale="ko-KR")).new_page()
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                    await page.wait_for_timeout(3000)
                except Exception as e:
                    print(f"  {url} goto: {e}")
                    continue
                html = await page.content()
                soup = BeautifulSoup(html, "lxml")
                print(f"\n=== {url} ===")
                print(f"  final: {page.url}")
                print(f"  bytes: {len(html)}")

                # Hunt for rows w/ date AND title text
                date_re = re.compile(r"20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}")
                # Find candidate rows
                clusters = {}
                for el in soup.find_all(["li", "tr", "div"]):
                    text = el.get_text(" ", strip=True)
                    if date_re.search(text) and el.find("a") and len(date_re.findall(text)) <= 2 and len(text) < 400:
                        parent_cls = (el.parent.get("class") or [""])[0] if el.parent else ""
                        key = f"{el.name}.{(el.get('class') or [''])[0]} in {el.parent.name if el.parent else '?'}.{parent_cls}"
                        clusters.setdefault(key, []).append(str(el)[:400])

                for key, samples in sorted(clusters.items(), key=lambda x: -len(x[1]))[:3]:
                    print(f"  {key} -> {len(samples)} rows")
                    print(f"    sample: {samples[0][:300]}")
            finally:
                await b.close()


asyncio.run(main())
