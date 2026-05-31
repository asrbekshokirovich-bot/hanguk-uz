#!/usr/bin/env python3
"""Live-test the Yonsei resolver."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

import httpx

from uni_db.config import settings
from uni_db.parse.pdf_resolvers import resolve_pdf


DETAIL_URLS = [
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/noticeView.asp?BBS_NO=3488",
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/noticeView.asp?BBS_NO=3417",
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/noticeView.asp?BBS_NO=3389",
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
                print("   resolver returned None")
                continue
            print(f"   resolved URL: {resolved.url}")
            print(f"   filename: {resolved.filename[:120]!r}")
            print(f"   headers: {dict(resolved.headers)}")
            try:
                r = await http.get(
                    resolved.url,
                    headers={
                        "User-Agent": settings.http_user_agent,
                        **dict(resolved.headers),
                    },
                    follow_redirects=True,
                    timeout=60,
                )
            except Exception as e:
                print(f"   GET failed: {e}")
                continue
            ctype = r.headers.get("content-type", "")
            print(
                f"   GET -> {r.status_code}  bytes={len(r.content)}  ctype={ctype}"
            )
            print(f"   first 8 bytes hex: {r.content[:8].hex()}")
            print(f"   looks like PDF: {r.content[:4] == b'%PDF'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
