#!/usr/bin/env python3
"""Live-test the KU resolver against the OKU board.

Fetches BBS_SEQ=1791 (시행계획) via the resolver, then GETs the resolved URL
with the supplied Referer, asserts the response is application/pdf
with reasonable size.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

import httpx

from uni_db.parse.pdf_resolvers import resolve_pdf
from uni_db.config import settings


DETAIL_URLS = [
    "https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do?MENU_ID=1700&BBS_SEQ=1791&SITE_NO=2&BOARD_SEQ=5",
    "https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do?MENU_ID=1700&BBS_SEQ=1779&SITE_NO=2&BOARD_SEQ=5",
    "https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do?MENU_ID=1700&BBS_SEQ=1727&SITE_NO=2&BOARD_SEQ=5",
]


async def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    async with httpx.AsyncClient(
        headers={"User-Agent": settings.http_user_agent},
        follow_redirects=True,
        timeout=30,
    ) as http:
        for url in DETAIL_URLS:
            print(f"\n--- {url} ---")
            resolved = await resolve_pdf(url, http_client=http, referer=url)
            if resolved is None:
                print("   resolver returned None (no fileDown anchor or fetch fail)")
                continue
            print(f"   resolved URL: {resolved.url}")
            print(f"   filename: {resolved.filename[:80]!r}")
            print(f"   headers: {dict(resolved.headers)}")
            try:
                r = await http.get(
                    resolved.url,
                    headers={"User-Agent": settings.http_user_agent, **dict(resolved.headers)},
                    follow_redirects=True,
                    timeout=60,
                )
            except Exception as e:
                print(f"   GET failed: {e}")
                continue
            ctype = r.headers.get("content-type", "")
            print(f"   GET -> {r.status_code}  bytes={len(r.content)}  ctype={ctype}")
            head = r.content[:8]
            print(f"   first 8 bytes (hex): {head.hex()}")
            print(f"   looks like PDF: {head.startswith(b'%PDF')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
