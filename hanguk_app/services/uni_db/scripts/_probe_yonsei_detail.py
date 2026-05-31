#!/usr/bin/env python3
"""Fetch a Yonsei announcement detail page and look for PDF download links.

Usage:
    python scripts/_probe_yonsei_detail.py
"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

import httpx
from bs4 import BeautifulSoup


# Known Yonsei detail URL from probe (BBS_NO=3417, 3389, 3488).
DETAIL_URLS = [
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/noticeView.asp?BBS_NO=3488",
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/noticeView.asp?BBS_NO=3417",
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/noticeView.asp?BBS_NO=3389",
]

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HangukUniDBBot/0.1"


async def probe(client: httpx.AsyncClient, url: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"\n--- {url} ---")
    try:
        r = await client.get(url, headers={"User-Agent": UA, "Referer": url}, follow_redirects=True, timeout=30)
    except Exception as e:
        print(f"   HTTP fail: {e}")
        return
    print(f"   HTTP {r.status_code}  bytes={len(r.content)}  ctype={r.headers.get('content-type')}")
    if r.status_code != 200:
        return
    soup = BeautifulSoup(r.text, "lxml")

    # Strategy 1: any <a href="*.pdf">
    pdfs = []
    for a in soup.find_all("a"):
        href = a.get("href") or ""
        if ".pdf" in href.lower() or "fileDown" in href or "download" in href.lower():
            pdfs.append((a.get_text(strip=True)[:60], href[:200]))
    print(f"   anchors with pdf/Download href: {len(pdfs)}")
    for txt, href in pdfs[:6]:
        print(f"      - text={txt!r} href={href!r}")

    # Strategy 2: anchors with onclick=fileDownload/fileDown/...
    onclicks = []
    for a in soup.find_all("a"):
        onc = a.get("onclick") or ""
        if any(k in onc for k in ("fileDown", "download", "fileView", "fnDownload")):
            onclicks.append((a.get_text(strip=True)[:60], onc[:200]))
    print(f"   anchors with download onclick: {len(onclicks)}")
    for txt, onc in onclicks[:6]:
        print(f"      - text={txt!r} onclick={onc!r}")

    # Strategy 3: find file paths in raw HTML
    raw_pdfs = re.findall(r"[a-zA-Z0-9_/.\-]+\.(?:pdf|hwp|zip)", r.text, flags=re.IGNORECASE)
    print(f"   raw text *.pdf/*.hwp/*.zip mentions: {len(raw_pdfs)} (first 6)")
    for p in raw_pdfs[:6]:
        print(f"      - {p}")

    # Strategy 4: find download endpoints (asp/jsp/php with file params)
    dl_links = re.findall(r"[a-zA-Z0-9_/.\-]*(?:fileDown|download|fileView)[a-zA-Z0-9_/?.\-=&]*", r.text, flags=re.IGNORECASE)
    print(f"   raw text download-endpoint mentions: {len(dl_links)} (first 6)")
    for p in dl_links[:6]:
        print(f"      - {p[:150]}")

    # Strategy 5: look for typical Korean egov 첨부파일 (attachment) sections
    if "첨부파일" in r.text:
        idx = r.text.find("첨부파일")
        print(f"   '첨부파일' found at index {idx}")
        print(f"   ... context: {r.text[max(0,idx-100):idx+500]!r}")
    else:
        print("   '첨부파일' NOT found in HTML")


async def main() -> int:
    async with httpx.AsyncClient() as client:
        for url in DETAIL_URLS:
            await probe(client, url)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
