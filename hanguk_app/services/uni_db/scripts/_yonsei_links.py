"""Find the Int'l student notice URL on the Yonsei admissions site."""
import asyncio

from playwright.async_api import async_playwright


async def main() -> None:
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        try:
            ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
            page = await ctx.new_page()
            await page.goto(
                "https://admission.yonsei.ac.kr/",
                wait_until="networkidle",
                timeout=30_000,
            )

            anchors = await page.evaluate(
                """() => Array.from(document.querySelectorAll('a')).map(a => ({
                    href: a.href,
                    text: (a.textContent || '').trim().slice(0, 50)
                })).filter(x =>
                    x.href.includes('intl') ||
                    x.href.includes('notice') ||
                    x.text.includes('Notice') ||
                    x.text.includes('공지'))"""
            )

            seen = set()
            for a in anchors:
                key = a["href"]
                if key in seen:
                    continue
                seen.add(key)
                print(f"{a['href']}  |  {a['text']}")
        finally:
            await b.close()


asyncio.run(main())
