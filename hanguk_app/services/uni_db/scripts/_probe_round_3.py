"""Round 3: tighter probe — for each school, find table/list selectors that
contain DATA (have a date pattern in the row content), not navigation.
"""

from __future__ import annotations

import asyncio
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


SCHOOLS = [
    # Hanyang JEOEGUK notice list
    ("hanyang", "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK"),
    # CBNU 재외국민 board (egov BBSMSTR)
    ("cbnu", "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do"),
    # JBNU — the "submenu" for 공지사항 we saw on homepage anchors
    ("jbnu_notice", "https://enter.jbnu.ac.kr/submenu.do?menuurl=rOjsbGuR5i0fqsax24xcPQ%3D%3D&"),
    # Inha 재외국민 — try AJAX endpoints
    ("inha", "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160"),
]

DATE_RE = re.compile(r"20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}")


async def main():
    async with async_playwright() as pw:
        for name, url in SCHOOLS:
            print(f"\n{'='*70}\n[{name}] {url}")
            b = await pw.chromium.launch(headless=True)
            try:
                ctx = await b.new_context(
                    user_agent="HangukUniDBBot/0.1",
                    locale="ko-KR",
                    viewport={"width": 1280, "height": 900},
                )
                page = await ctx.new_page()
                try:
                    await page.goto(url, wait_until="networkidle", timeout=20_000)
                except Exception:
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                    except Exception as e:
                        print(f"  goto fail: {e}")
                        continue

                final_url = page.url
                html = await page.content()
                print(f"  final_url: {final_url}")
                print(f"  html_len:  {len(html)}")

                soup = BeautifulSoup(html, "lxml")

                # Find any table/li/div whose inner text contains a date AND has an <a>.
                candidates = []
                for tag_name in ("tr", "li", "div"):
                    for el in soup.find_all(tag_name):
                        text = el.get_text(" ", strip=True)
                        if not DATE_RE.search(text):
                            continue
                        if not el.find("a"):
                            continue
                        # Skip if it contains too many other rows (parent containers)
                        sub_dates = len(DATE_RE.findall(text))
                        if sub_dates > 3:
                            continue
                        # Find a parent path
                        path = []
                        cur = el
                        while cur and cur.name and len(path) < 6:
                            cls = (cur.get("class") or [""])[0]
                            path.append(f"{cur.name}.{cls}" if cls else cur.name)
                            cur = cur.parent
                        candidates.append((tag_name, ".".join(reversed(path)), str(el)[:300]))

                # Group by tag_name + classes (parent path)
                by_parent = {}
                for tag, path, sample in candidates:
                    key = (tag, path.rsplit(">", 1)[0] if ">" in path else path)
                    by_parent.setdefault(key, []).append(sample)

                print(f"  candidate row clusters: {len(by_parent)}")
                for (tag, parent), samples in sorted(by_parent.items(), key=lambda x: -len(x[1]))[:5]:
                    print(f"    {tag}  in  {parent}  -> {len(samples)} rows")
                    print(f"      sample: {samples[0][:200]}")

            finally:
                await b.close()


asyncio.run(main())
