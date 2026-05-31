"""Capture the POST body Inha uses for its FR_BBS_SVC list call (MENU_ID=170)
+ probe Hanyang full + Jeju navigation + Konkuk title hunt."""

from __future__ import annotations

import asyncio
import json
import re

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


async def inha_post(pw):
    print("\n" + "=" * 70 + "\n[INHA POST body]")
    url = "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=170"
    b = await pw.chromium.launch(headless=True)
    try:
        ctx = await b.new_context(locale="ko-KR")
        captured: list[dict] = []

        async def on_request(req):
            if "BBSViewList" in req.url:
                try:
                    body = req.post_data or ""
                    captured.append({"url": req.url, "method": req.method, "body": body})
                except Exception as e:
                    captured.append({"url": req.url, "method": req.method, "error": str(e)})

        async def on_response(resp):
            if "BBSViewList" in resp.url:
                try:
                    txt = await resp.text()
                    captured.append({"resp_url": resp.url, "status": resp.status,
                                     "body_preview": txt[:800]})
                except Exception:
                    pass

        page = await ctx.new_page()
        page.on("request", on_request)
        page.on("response", on_response)
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
            await page.wait_for_timeout(4000)
        except Exception as e:
            print(f"  goto: {e}")

        for c in captured:
            print(f"  CAPTURED: {c}")
    finally:
        await b.close()


async def hanyang_rerun(pw):
    print("\n" + "=" * 70 + "\n[HANYANG re-dump rows only]")
    url = "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK"
    b = await pw.chromium.launch(headless=True)
    try:
        page = await (await b.new_context(locale="ko-KR")).new_page()
        await page.goto(url, wait_until="networkidle", timeout=20_000)
        await page.wait_for_timeout(2000)
        html = await page.content()
        soup = BeautifulSoup(html, "lxml")
        # Look for the actual list table inside page-notice
        for sel in ["div.page-notice table", "div.page-notice ul.board-list",
                    "div.tab-hiddencontents table", "div.tab-article table",
                    "div.tab-article ul.list", "div.bbs-list-wrap div", "table.notice-list"]:
            hits = soup.select(sel)
            if hits:
                print(f"  {sel}: {len(hits)} -> first {len(str(hits[0]))} chars")
        # Look for any element whose text starts with "총 3 개" or contains "2026"
        for el in soup.find_all(["table", "ul", "ol"]):
            t = el.get_text(" ", strip=True)
            if "2026" in t and "총" not in t and len(t) < 500:
                print(f"  candidate {el.name}.{(el.get('class') or [''])[0]} text={t[:200]!r}")
        # Also dump 2nd half of page-notice
        pn = soup.select_one("div.page-notice")
        if pn:
            s = str(pn)
            print(f"  page-notice END section (chars 2500-end):")
            print(s[2500:5000])
    finally:
        await b.close()


async def jeju_nav(pw):
    print("\n" + "=" * 70 + "\n[JEJU navigation from /intro]")
    url = "https://ibsi.jejunu.ac.kr/intro"
    b = await pw.chromium.launch(headless=True)
    try:
        page = await (await b.new_context(locale="ko-KR")).new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
            await page.wait_for_timeout(2500)
        except Exception as e:
            print(f"  goto: {e}")
            return
        html = await page.content()
        print(f"  html_len: {len(html)}")
        soup = BeautifulSoup(html, "lxml")
        # Dump first 2000 chars of body
        body_text = soup.get_text(" ", strip=True)
        print(f"  body sample: {body_text[:800]!r}")
        # Anchors
        for a in soup.find_all("a", href=True)[:30]:
            print(f"  a {a['href'][:80]} | {a.get_text(strip=True)[:30]}")
    finally:
        await b.close()


async def konkuk_titles(pw):
    print("\n" + "=" * 70 + "\n[KONKUK title dump for 3 menus]")
    menus = [
        ("M1_RnNf", "RnNfVbLHUGrJz9kJgEyRDQ%3d%3d"),
        ("M2_miPM", "miPMzZuRMGxzpDoeA1nFTg%3d%3d"),
        ("M3_k8b",  "k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d"),
    ]
    b = await pw.chromium.launch(headless=True)
    try:
        for label, menu in menus:
            url = f"http://enter.konkuk.ac.kr/submenu.do?menuurl={menu}&"
            page = await (await b.new_context(locale="ko-KR")).new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15_000)
                await page.wait_for_timeout(3000)
            except Exception as e:
                print(f"  {label} goto: {e}")
                continue
            html = await page.content()
            soup = BeautifulSoup(html, "lxml")
            print(f"\n  {label} -> {len(html)} bytes")
            # Dump anchor texts to identify the board topic
            anchors = soup.select("td a, li a")
            relevant = [a.get_text(strip=True)[:50] for a in anchors
                        if a.get_text(strip=True) and not a.get_text(strip=True).isdigit()
                        and "메뉴" not in a.get_text(strip=True)
                        and "바로가기" not in a.get_text(strip=True)][:8]
            for t in relevant:
                print(f"    {t}")
    finally:
        await b.close()


async def main():
    async with async_playwright() as pw:
        await inha_post(pw)
        await hanyang_rerun(pw)
        await jeju_nav(pw)
        await konkuk_titles(pw)


asyncio.run(main())
