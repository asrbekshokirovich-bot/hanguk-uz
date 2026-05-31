"""Round 4 — tackle the 4 AMBER schools with school-specific strategies.

Konkuk:   retry with wait_until="domcontentloaded" (networkidle never settled)
Hanyang:  wait for div.page-notice + dump notice rows
Kangwon:  read intro.html and find the redirect/JS-target URL
Inha:     intercept network requests to find AJAX endpoints serving the list
"""

from __future__ import annotations

import asyncio
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


async def konkuk_probe(pw):
    print("\n" + "=" * 70 + "\n[KONKUK]")
    url = "http://enter.konkuk.ac.kr/submenu.do?menuurl=vQ5Um0%2fKclp6EAegmwbvhQ%3d%3d&"
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
            await page.wait_for_timeout(3000)  # let JS finish
        except Exception as e:
            print(f"  goto fail: {e}")
            return
        html = await page.content()
        print(f"  final_url: {page.url}")
        print(f"  html_len:  {len(html)}")
        soup = BeautifulSoup(html, "lxml")

        # Hunt for rows w/ date
        date_re = re.compile(r"20\d{2}[.\-]\d{1,2}[.\-]\d{1,2}")
        candidates = {}
        for tag in ("tr", "li", "div"):
            for el in soup.find_all(tag):
                text = el.get_text(" ", strip=True)
                if date_re.search(text) and el.find("a") and len(date_re.findall(text)) <= 2:
                    parent_cls = (el.parent.get("class") or [""])[0] if el.parent else ""
                    key = f"{tag}.{parent_cls}"
                    candidates.setdefault(key, []).append(str(el)[:300])

        for key, samples in sorted(candidates.items(), key=lambda x: -len(x[1]))[:3]:
            print(f"  {key} -> {len(samples)} rows")
            print(f"    sample: {samples[0][:250]}")
    finally:
        await b.close()


async def hanyang_probe(pw):
    print("\n" + "=" * 70 + "\n[HANYANG]")
    url = "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK"
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=20_000)
            # Try wait for the actual list table that should appear inside page-notice
            try:
                await page.wait_for_selector("div.page-notice table", timeout=8_000)
            except Exception:
                # Maybe the list is in <ul> not <table>
                pass
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"  goto fail: {e}")
            return
        html = await page.content()
        print(f"  html_len: {len(html)}")
        soup = BeautifulSoup(html, "lxml")
        page_notice = soup.select_one("div.page-notice")
        if not page_notice:
            print("  div.page-notice NOT found")
            return
        print(f"  page-notice inner_len: {len(str(page_notice))}")
        # Dump first 2000 chars of page-notice contents
        print(f"  page-notice sample: {str(page_notice)[:2000]}")
    finally:
        await b.close()


async def kangwon_probe(pw):
    print("\n" + "=" * 70 + "\n[KANGWON]")
    url = "https://admission.kangwon.ac.kr/intro.html"
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"  goto fail: {e}")
            return
        html = await page.content()
        print(f"  html_len:  {len(html)}")
        print(f"  final_url: {page.url}")
        # Look for meta refresh + JS redirects + anchor links
        soup = BeautifulSoup(html, "lxml")
        meta = soup.select_one('meta[http-equiv="refresh"]')
        if meta:
            print(f"  meta refresh: {meta.get('content')}")
        # All script content
        scripts = soup.find_all("script")
        for s in scripts[:6]:
            txt = (s.string or "")[:200]
            if "location" in txt or "href" in txt:
                print(f"  script (loc/href): {txt!r}")
        # Anchors
        for a in soup.find_all("a", href=True)[:15]:
            print(f"  a href={a['href'][:80]}  text={a.get_text(strip=True)[:30]}")
    finally:
        await b.close()


async def inha_probe(pw):
    print("\n" + "=" * 70 + "\n[INHA] — intercepting network requests")
    url = "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160"
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
        captured: list[tuple[str, str, int]] = []

        async def on_response(resp):
            try:
                ct = resp.headers.get("content-type", "")
                if "json" in ct.lower() or "xml" in ct.lower():
                    captured.append((resp.request.method, resp.url, resp.status))
            except Exception:
                pass

        page = await ctx.new_page()
        page.on("response", on_response)
        try:
            await page.goto(url, wait_until="networkidle", timeout=25_000)
            await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"  goto fail: {e}")

        print(f"  captured JSON/XML responses: {len(captured)}")
        for method, u, status in captured:
            if "admission.inha" in u or "FR_BBS" in u or "BBS" in u or "list" in u.lower():
                print(f"    {method} {status} {u}")

        # Also probe the rendered DOM
        html = await page.content()
        # Find any iframe sources
        soup = BeautifulSoup(html, "lxml")
        for ifr in soup.find_all("iframe"):
            print(f"  iframe src: {ifr.get('src')}")
        # Find any <a> that looks like a notice within INHA
        for a in soup.select("a[href*='FR_CON'], a[href*='BBS']")[:5]:
            print(f"  a href={a.get('href')[:80]} text={a.get_text(strip=True)[:30]}")
    finally:
        await b.close()


async def main():
    async with async_playwright() as pw:
        await konkuk_probe(pw)
        await hanyang_probe(pw)
        await kangwon_probe(pw)
        await inha_probe(pw)


asyncio.run(main())
