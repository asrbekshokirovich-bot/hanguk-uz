"""Dump complete row HTML for Konkuk 재외국민 list."""
import asyncio

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


URL = "http://enter.konkuk.ac.kr/submenu.do?menuurl=k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d&"


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        try:
            page = await (await b.new_context(locale="ko-KR")).new_page()
            await page.goto(URL, wait_until="domcontentloaded", timeout=20_000)
            await page.wait_for_timeout(3000)
            html = await page.content()
            soup = BeautifulSoup(html, "lxml")
            rows = soup.select("ul.list li")
            print(f"ul.list li rows: {len(rows)}")
            # Skip the first few if they're headers/templates; dump real-looking ones
            for i, r in enumerate(rows[:4]):
                print(f"\n--- row {i} (len {len(str(r))}) ---")
                print(str(r)[:2500])
        finally:
            await b.close()


asyncio.run(main())
