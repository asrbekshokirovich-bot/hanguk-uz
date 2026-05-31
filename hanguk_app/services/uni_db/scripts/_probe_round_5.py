"""Round 5 — drill into Hanyang/Kangwon/Inha/Jeju/Konkuk with sharper strategies."""

from __future__ import annotations

import asyncio
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


async def hanyang_full(pw):
    """Dump the COMPLETE page-notice contents to find the actual list rows."""
    print("\n" + "=" * 70 + "\n[HANYANG full dump]")
    url = "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK"
    b = await pw.chromium.launch(headless=True)
    try:
        page = await (await b.new_context(locale="ko-KR")).new_page()
        await page.goto(url, wait_until="networkidle", timeout=20_000)
        await page.wait_for_timeout(2000)
        html = await page.content()
        soup = BeautifulSoup(html, "lxml")
        pn = soup.select_one("div.page-notice")
        print(f"  total length: {len(str(pn))}")
        # Dump from char 1500 to 6000 (skip header tabs)
        full = str(pn)
        print(f"  --- chars 1500-6000 ---")
        print(full[1500:6000])
    finally:
        await b.close()


async def kangwon_list(pw):
    """Find Kangwon's 재외국민/외국인 notice list URL."""
    print("\n" + "=" * 70 + "\n[KANGWON list hunt]")
    candidates = [
        "https://admission.kangwon.ac.kr/admission/main.do",
        "https://admission.kangwon.ac.kr/admission/selectBbsNttList.do?bbsNo=373",
    ]
    b = await pw.chromium.launch(headless=True)
    try:
        for url in candidates:
            page = await (await b.new_context(locale="ko-KR")).new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=20_000)
            except Exception as e:
                print(f"  goto {url}: {e}")
                continue
            html = await page.content()
            print(f"\n  url={url}")
            print(f"    final={page.url}")
            print(f"    html_len={len(html)}")
            soup = BeautifulSoup(html, "lxml")
            # Anchors with 재외국민/외국인
            for a in soup.find_all("a", href=True):
                text = a.get_text(strip=True)
                href = a["href"]
                if any(k in (text + href) for k in ("재외국민", "외국인", "BbsNttList", "selectBbs")):
                    print(f"    a {href[:90]} | {text[:40]}")
    finally:
        await b.close()


async def inha_notice(pw):
    """Try the actual 공지사항 menus (90, 130, 170) instead of 모집요강 (160)."""
    print("\n" + "=" * 70 + "\n[INHA notice menus]")
    for menu_id in [90, 130, 170, 30]:
        url = f"https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID={menu_id}"
        b = await pw.chromium.launch(headless=True)
        try:
            page = await (await b.new_context(locale="ko-KR")).new_page()
            captured = []

            async def on_response(resp):
                try:
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct.lower() and "FR_BBS" not in resp.url and "BBS" not in resp.url:
                        return
                    if "BBS" in resp.url.upper() or "ajaxf" in resp.url.lower() or "list.do" in resp.url.lower():
                        captured.append((resp.request.method, resp.url, resp.status))
                except Exception:
                    pass

            page.on("response", on_response)
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"  MENU_ID={menu_id} goto: {e}")
                await b.close()
                continue
            html = await page.content()
            print(f"\n  MENU_ID={menu_id}  final={page.url}  bytes={len(html)}")
            for method, u, status in captured[:5]:
                print(f"    {method} {status} {u}")
            soup = BeautifulSoup(html, "lxml")
            tbody_rows = soup.select("table tbody tr")
            print(f"    table tbody tr: {len(tbody_rows)} rows")
            if tbody_rows and len(tbody_rows) >= 3:
                print(f"    FIRST ROW: {str(tbody_rows[0])[:400]}")
        finally:
            await b.close()


async def jeju_probe(pw):
    """Probe ibsi.jejunu.ac.kr (correct domain, was ipsi which is the typo)."""
    print("\n" + "=" * 70 + "\n[JEJU correct domain]")
    candidates = [
        "https://ibsi.jejunu.ac.kr/",
        "http://ibsi.jejunu.ac.kr/",
    ]
    b = await pw.chromium.launch(headless=True)
    try:
        for url in candidates:
            page = await (await b.new_context(locale="ko-KR")).new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                await page.wait_for_timeout(2000)
            except Exception as e:
                print(f"  {url} goto: {e}")
                continue
            html = await page.content()
            print(f"\n  url={url}")
            print(f"    final={page.url}")
            print(f"    html_len={len(html)}")
            soup = BeautifulSoup(html, "lxml")
            # 재외국민/외국인 anchors
            for a in soup.find_all("a", href=True)[:200]:
                text = a.get_text(strip=True)
                href = a["href"]
                if any(k in (text + href) for k in ("재외국민", "외국인", "공지")):
                    if href and not href.startswith("#") and "javascript" not in href:
                        print(f"    a {href[:90]} | {text[:40]}")
            break  # one works
    finally:
        await b.close()


async def konkuk_3_notices(pw):
    """Visit Konkuk's 3 notice menus to find which is the 재외국민 list."""
    print("\n" + "=" * 70 + "\n[KONKUK three notice menus]")
    menus = [
        "RnNfVbLHUGrJz9kJgEyRDQ%3d%3d",
        "miPMzZuRMGxzpDoeA1nFTg%3d%3d",
        "k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d",
    ]
    b = await pw.chromium.launch(headless=True)
    try:
        for menu in menus:
            url = f"http://enter.konkuk.ac.kr/submenu.do?menuurl={menu}&"
            page = await (await b.new_context(locale="ko-KR")).new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                await page.wait_for_timeout(2500)
            except Exception as e:
                print(f"  {menu[:30]} goto: {e}")
                continue
            html = await page.content()
            print(f"\n  menu={menu[:30]}...")
            print(f"    final={page.url}")
            # The page title tells us which board
            soup = BeautifulSoup(html, "lxml")
            title_el = soup.select_one("h2, h3, h4")
            print(f"    title: {title_el.get_text(strip=True) if title_el else '?'}")
            # Count rows with dates
            date_re = re.compile(r"20\d{2}[.\-]\d{1,2}[.\-]\d{1,2}")
            dates = date_re.findall(html)
            print(f"    dates found: {len(dates)} (first 3: {dates[:3]})")
    finally:
        await b.close()


async def main():
    async with async_playwright() as pw:
        await hanyang_full(pw)
        await kangwon_list(pw)
        await inha_notice(pw)
        await jeju_probe(pw)
        await konkuk_3_notices(pw)


asyncio.run(main())
