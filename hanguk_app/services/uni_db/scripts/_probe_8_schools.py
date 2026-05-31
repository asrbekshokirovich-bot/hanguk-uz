"""Reconnaissance: probe 8 candidate universities to identify their CMS.

For each URL:
  1. Goto with Playwright, wait for networkidle.
  2. Record final_url (catch JS redirects).
  3. Sniff structure (table rows, list items, date strings).
  4. Find anchors containing 외국인 / international / notice / 공지 (the real
     international-student notice URL is rarely the homepage itself).
  5. Emit a one-line bucket recommendation: JSON_API / STATIC_HTML / PLAYWRIGHT.

Output is captured by the harness and bucketed manually.
"""

from __future__ import annotations

import asyncio
import re
import sys
from dataclasses import dataclass

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


SCHOOLS = [
    ("konkuk",  "https://enter.konkuk.ac.kr/"),
    ("inha",    "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160"),
    ("cbnu",    "https://ipsi.chungbuk.ac.kr/"),
    ("jbnu",    "https://enter.jbnu.ac.kr/"),
    ("kangwon", "https://admission.kangwon.ac.kr/"),
    ("jeju",    "https://ipsi.jejunu.ac.kr/"),
    ("skku",    "https://admission.skku.edu/"),
    ("hanyang", "https://go.hanyang.ac.kr/web/mojib/mojib.do?m_type=JEOEGUK"),
]

INTL_KEYWORDS = ("외국인", "재외국민", "글로벌", "international", "intl", "foreign")
NOTICE_KEYWORDS = ("notice", "공지", "공지사항", "bbs", "board", "bulletin")


@dataclass
class ProbeResult:
    name: str
    url_in: str
    final_url: str
    title: str
    html_len: int
    table_rows: int
    li_rows: int
    has_date: bool
    intl_anchors: list[tuple[str, str]]
    notice_anchors: list[tuple[str, str]]
    bucket_hint: str


async def probe_one(pw, name: str, url_in: str) -> ProbeResult:
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(
            user_agent="HangukUniDBBot/0.1 (+contact: ops@hanguk.example)",
            locale="ko-KR",
            viewport={"width": 1280, "height": 900},
        )
        page = await ctx.new_page()
        try:
            await page.goto(url_in, wait_until="networkidle", timeout=25_000)
        except Exception:
            # If networkidle never settles, fall back to domcontentloaded.
            try:
                await page.goto(url_in, wait_until="domcontentloaded", timeout=15_000)
            except Exception as e:
                return ProbeResult(
                    name, url_in, "FAILED", str(e)[:80], 0, 0, 0, False, [], [], "ERROR"
                )

        final_url = page.url
        title = (await page.title())[:80]
        html = await page.content()
        soup = BeautifulSoup(html, "lxml")

        table_rows = len(soup.select("table tbody tr"))
        li_rows = len(soup.select("ul li")) + len(soup.select("ol li"))
        has_date = bool(re.search(r"20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}", html))

        intl_anchors: list[tuple[str, str]] = []
        notice_anchors: list[tuple[str, str]] = []
        seen = set()
        for a in soup.select("a[href]"):
            href = (a.get("href") or "").strip()
            text = a.get_text(strip=True)[:50]
            combined = (href + " " + text).lower()
            if href in seen or not href or href.startswith("#") or "javascript:" in href:
                continue
            seen.add(href)
            if any(k in combined for k in INTL_KEYWORDS):
                intl_anchors.append((href, text))
            if any(k in combined for k in NOTICE_KEYWORDS):
                notice_anchors.append((href, text))

        # Bucket hint
        if "FR_CON" in final_url or "ajaxf" in html or "/wz/api/board/" in html:
            bucket = "JSON_API"
        elif table_rows >= 5 and has_date:
            bucket = "STATIC_HTML"
        elif "JavaScript" in html or li_rows > 50 or final_url != url_in:
            bucket = "PLAYWRIGHT"
        else:
            bucket = "PLAYWRIGHT?"

        return ProbeResult(
            name, url_in, final_url, title, len(html),
            table_rows, li_rows, has_date,
            intl_anchors[:6], notice_anchors[:6], bucket,
        )
    finally:
        await b.close()


async def main() -> None:
    async with async_playwright() as pw:
        # Probe schools in series to keep memory low (each launches a browser).
        for name, url_in in SCHOOLS:
            print(f"\n{'='*70}\n[{name}] {url_in}")
            try:
                r = await probe_one(pw, name, url_in)
            except Exception as e:  # noqa: BLE001
                print(f"  PROBE ERROR: {type(e).__name__}: {e}")
                continue
            print(f"  final_url:  {r.final_url}")
            print(f"  title:      {r.title}")
            print(f"  html_len:   {r.html_len}")
            print(f"  table tbody tr:  {r.table_rows}    ul/ol li:  {r.li_rows}    has_date:  {r.has_date}")
            print(f"  BUCKET:     {r.bucket_hint}")
            if r.intl_anchors:
                print(f"  intl anchors ({len(r.intl_anchors)}):")
                for href, text in r.intl_anchors:
                    print(f"    {href[:80]}  |  {text}")
            if r.notice_anchors:
                print(f"  notice anchors ({len(r.notice_anchors)}):")
                for href, text in r.notice_anchors[:3]:
                    print(f"    {href[:80]}  |  {text}")


asyncio.run(main())
