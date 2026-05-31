"""Dump the rendered HTML of Yonsei's Int'l Student notice table rows."""
import asyncio

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


URL = "https://admission.yonsei.ac.kr/seoul/admission/html/international/notice.asp"


async def main() -> None:
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        try:
            ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
            page = await ctx.new_page()
            await page.goto(URL, wait_until="networkidle", timeout=30_000)
            html = await page.content()
        finally:
            await b.close()

    soup = BeautifulSoup(html, "lxml")
    rows = soup.select("table tbody tr")
    print(f"Found {len(rows)} <tbody> rows. First 3:")
    for i, r in enumerate(rows[:3]):
        print(f"--- row {i} ---")
        print(str(r)[:1500])


asyncio.run(main())
