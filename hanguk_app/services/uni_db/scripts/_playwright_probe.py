"""Probe a JS-rendered admissions page with Playwright.

Prints page metadata + a snippet of the rendered HTML so we can hand-roll
CSS selectors for the HtmlListSelectors config without watching the
browser by hand.

Usage:
    .venv/bin/python scripts/_playwright_probe.py URL [--wait-for SELECTOR]
"""

import argparse
import asyncio
import re
import sys


async def main(url: str, wait_for: str | None) -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            ctx = await browser.new_context(
                user_agent="HangukUniDBBot/0.1 (+contact: ops@hanguk.example)",
                locale="ko-KR",
                viewport={"width": 1280, "height": 900},
            )
            page = await ctx.new_page()
            print(f"-> goto {url}")
            await page.goto(url, wait_until="networkidle", timeout=30_000)
            if wait_for:
                try:
                    await page.wait_for_selector(wait_for, timeout=10_000)
                    print(f"-> wait_for_selector({wait_for!r}) ok")
                except Exception as e:  # noqa: BLE001
                    print(f"-> wait_for_selector({wait_for!r}) failed: {e}")

            final_url = page.url
            title = await page.title()
            html = await page.content()
            print(f"final_url: {final_url}")
            print(f"title:     {title}")
            print(f"html_len:  {len(html)}")
            print()

            # Print a structural summary — count table rows, links, etc.
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")
            print("Structural sniff:")
            for sel in [
                "table tbody tr",
                "ul.board-list li",
                "div.board-list table tr",
                "div.notice-list li",
                "div.list-wrap li",
                "div.bbs-list tr",
                "article",
            ]:
                hits = soup.select(sel)
                if hits:
                    print(f"  {sel:35} -> {len(hits)} hits")

            # Look for date-like text in any rows.
            date_re = re.compile(r"20\d{2}[.\-]\d{1,2}[.\-]\d{1,2}")
            date_hits = date_re.findall(html)
            print(f"  date-like strings:               {len(date_hits)} (sample: {date_hits[:3]})")

            # First 4000 chars of body text for human eyes.
            print()
            print("--- body text (first 1500 chars) ---")
            text = soup.get_text("\n", strip=True)
            print(text[:1500])

            return 0
        finally:
            await browser.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("url")
    p.add_argument("--wait-for", default=None, help="CSS selector to wait for")
    args = p.parse_args()
    sys.exit(asyncio.run(main(args.url, args.wait_for)))
