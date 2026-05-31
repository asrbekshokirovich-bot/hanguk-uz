"""Identify which Konkuk 공지사항 menu is the 재외국민 (overseas Korean) one.

Each menu page is checked for breadcrumb / page-title clues. The probe also
dumps a few row HTML samples so we can author selectors in the same pass.
"""

import asyncio
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


MENUS = [
    ("M1_RnNf", "RnNfVbLHUGrJz9kJgEyRDQ%3d%3d"),
    ("M2_miPM", "miPMzZuRMGxzpDoeA1nFTg%3d%3d"),
    ("M3_k8b",  "k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d"),
]


async def main():
    async with async_playwright() as pw:
        for label, menu in MENUS:
            url = f"http://enter.konkuk.ac.kr/submenu.do?menuurl={menu}&"
            b = await pw.chromium.launch(headless=True)
            try:
                page = await (await b.new_context(locale="ko-KR")).new_page()
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
                    await page.wait_for_timeout(3000)
                except Exception as e:
                    print(f"\n[{label}] goto fail: {e}")
                    continue
                html = await page.content()
                soup = BeautifulSoup(html, "lxml")

                print(f"\n[{label}] {url}")
                print(f"  bytes={len(html)}")

                # Look at all h1/h2/h3 and any breadcrumb-like elements
                title_clues = []
                for el in soup.select("h1, h2, h3, .breadcrumb, .location, .path, .navi, .sub-tit"):
                    txt = el.get_text(" ", strip=True)
                    if txt and len(txt) < 80:
                        title_clues.append(f"{el.name}.{(el.get('class') or [''])[0]}: {txt}")
                # Also active menu / on-class
                for el in soup.select(".on, .active, .current"):
                    txt = el.get_text(" ", strip=True)
                    if txt and len(txt) < 80:
                        title_clues.append(f"ON {el.name}.{(el.get('class') or [''])[0]}: {txt}")
                print(f"  title clues ({len(title_clues)}):")
                for t in title_clues[:8]:
                    print(f"    {t}")

                # Dump first 2 candidate rows w/ dates
                date_re = re.compile(r"20\d{2}[.\-]\d{1,2}[.\-]\d{1,2}")
                candidates = []
                for tag in ("tr", "li"):
                    for el in soup.find_all(tag):
                        text = el.get_text(" ", strip=True)
                        if date_re.search(text) and el.find("a") and len(text) < 300:
                            parent_cls = (el.parent.get("class") or [""])[0] if el.parent else ""
                            candidates.append((el.name, parent_cls, str(el)[:400]))
                            if len(candidates) >= 2:
                                break
                    if len(candidates) >= 2:
                        break
                if candidates:
                    print(f"  candidate rows:")
                    for tag, pc, sample in candidates:
                        print(f"    in {tag} (parent.{pc}): {sample[:300]}")
            finally:
                await b.close()


asyncio.run(main())
