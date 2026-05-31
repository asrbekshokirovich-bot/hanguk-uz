"""Generic attachment resolver for direct-download notice boards.

Many Korean admission boards render the post detail page with the guideline
PDF as an ordinary download anchor — a direct ``.pdf`` href, or a
``download.php`` / ``fileDown.do`` / ``download.File.asp`` style endpoint.
This resolver fetches the detail page (the announcement's ``url_ko``), finds
the best such attachment, and returns it. It is registered for hosts whose
detail pages follow that pattern (CAU, Kookmin, …); boards that hide the file
behind a JS ``onclick`` handler need a site-specific resolver instead.

Mirror of the KAIST resolver's generic core; kept separate so the per-host
registry can point unrelated universities at one shared implementation.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Final
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from . import ResolvedPdf

log = logging.getLogger(__name__)

_HTTP_TIMEOUT_SEC: Final[float] = 30.0
_DOWNLOAD_HINTS: Final[tuple[str, ...]] = (
    "download", "filedown", "file_down", "file/down", "filedownload",
    "attach", "fileid", "/file", "down.asp", "down.do", "readfile",
    "resourcedown", "bbsfiledown", "nttfiledownload",
)
_GUIDE_HINTS: Final[tuple[str, ...]] = (
    "guide", "admission", "모집요강", "요강", "전형", "모집", "안내",
)
# Strong markers that an anchor IS the guideline doc (used to accept a
# download-endpoint link even when the anchor text has no file extension —
# Korean boards link the guide as "…모집요강" / "…전형 안내" with no ".pdf").
_STRONG_GUIDE_HINTS: Final[tuple[str, ...]] = (
    "모집요강", "요강", "전형", "모집", "admission", "guide",
)
# Guideline file types (audit §5.1: 95% PDF, some HWP/HWPX/DOCX).
_GUIDELINE_EXTS: Final[tuple[str, ...]] = (".pdf", ".hwp", ".hwpx", ".docx")

# A 4-digit cycle year in a filename / anchor text (2020–2039), used to prefer
# the newest guideline when a board lists several cycles side by side.
_CYCLE_YEAR_RE: Final = re.compile(r"(?<!\d)(20[2-3][0-9])(?!\d)")


def _detect_year(text: str, href: str) -> int | None:
    matches = _CYCLE_YEAR_RE.findall(f"{text} {href}")
    return max(int(m) for m in matches) if matches else None


def _is_pdf_href(href: str) -> bool:
    return urlsplit(href).path.lower().endswith(".pdf")


def _href_ext(href: str) -> str | None:
    path = urlsplit(href).path.lower()
    return next((e for e in _GUIDELINE_EXTS if path.endswith(e)), None)


def _looks_like_download(href: str) -> bool:
    low = href.lower()
    return any(hint in low for hint in _DOWNLOAD_HINTS)


def _score(text: str, href: str) -> int:
    blob = f"{text} {href}".lower()
    return sum(1 for hint in _GUIDE_HINTS if hint in blob)


def _extract_pdf_link(html: str, base_url: str) -> tuple[str, str] | None:
    soup = BeautifulSoup(html, "lxml")
    candidates: list[tuple[int, str, str]] = []
    for anchor in soup.find_all("a"):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith("#") or href.lower().startswith("javascript:"):
            continue
        text = anchor.get_text(strip=True)
        blob = f"{text} {href}".lower()
        href_ext = _href_ext(href)
        text_ext = next((e for e in _GUIDELINE_EXTS if e in text.lower()), None)
        guideish = any(h in blob for h in _STRONG_GUIDE_HINTS)
        # Accept a direct guideline-file href, OR a download-endpoint link that
        # either names a guideline file or carries a strong guideline keyword.
        if not (href_ext or (_looks_like_download(href) and (text_ext or guideish))):
            continue
        absolute = urljoin(base_url, href)
        filename = text if text_ext else (urlsplit(absolute).path.rsplit("/", 1)[-1] or text)
        # Prefer the newest *recent* cycle when a board lists several side by
        # side (e.g. 2025 vs 2026 모집요강); only boost plausibly-current years so
        # an old dated file never outranks an undated current one — downstream
        # publish still holds anything past-cycle. Then prefer a PDF (parseable
        # today) over HWP/other, then more guide hints.
        current = date.today().year
        year = _detect_year(text, href)
        year_boost = year * 1000 if (year is not None and current - 1 <= year <= current + 2) else 0
        is_pdf = href_ext == ".pdf" or ".pdf" in text.lower()
        score = year_boost + (10 if is_pdf else 0) + _score(filename, absolute)
        candidates.append((score, absolute, filename or "attachment"))
    if not candidates:
        return None
    candidates.sort(key=lambda c: c[0], reverse=True)
    _, absolute, filename = candidates[0]
    return absolute, filename


async def resolve(
    attachment_url: str,
    http_client: httpx.AsyncClient,
    referer: str | None = None,
) -> ResolvedPdf | None:
    """Resolve a detail-page URL to its best attached PDF/download link."""
    del referer
    log.info("generic_attachment: resolving %s", attachment_url[:140])
    try:
        resp = await http_client.get(attachment_url, timeout=_HTTP_TIMEOUT_SEC)
    except httpx.HTTPError as exc:
        log.warning("generic_attachment: detail fetch failed: %s", exc)
        return None
    if resp.status_code != 200:
        log.warning("generic_attachment: HTTP %s for %s", resp.status_code, attachment_url[:120])
        return None
    found = _extract_pdf_link(resp.text, attachment_url)
    if found is None:
        log.info("generic_attachment: no attachment link on detail page")
        return None
    download_url, filename = found
    return ResolvedPdf(url=download_url, filename=filename, headers={"Referer": attachment_url})
