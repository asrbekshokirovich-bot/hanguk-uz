"""KAIST PDF resolver (international-undergraduate notice board).

KAIST publishes admission guidelines as notice posts under
``admission.kaist.ac.kr/intl-undergraduate/notice``. Discovery records the
notice **detail page** URL; the actual guideline (e.g.
``Admissions Guide for 2027 admission.pdf``) is an attachment *on* that
page, not a direct PDF stream. Unlike Korea University's JS ``fileDown``
endpoint, KAIST renders the attachment as an ordinary anchor — either a
direct ``href`` to a ``.pdf`` or a download endpoint.

This resolver fetches the detail HTML and returns the best PDF attachment:

  1. anchors whose ``href`` resolves to a path ending in ``.pdf``, else
  2. anchors whose ``href`` looks like a file-download endpoint
     (``download`` / ``fileDown`` / ``attach`` / ``file``) whose link text
     names a ``.pdf``.

When several candidates exist, the one whose filename/link-text names the
admissions guide (``guide`` / ``admission`` / ``요강`` / ``전형``) wins so we
don't pick an unrelated attachment. Relative hrefs are resolved against the
detail-page URL. A ``Referer`` header is returned for parity with the other
resolvers (some KAIST asset hosts gate on it).

NOTE: the anchor selectors below target the KAIST notice attachment block;
verify against a fresh live capture before trusting in production (cf. the
KU resolver's "Verified live" note).
"""

from __future__ import annotations

import logging
from typing import Final
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from . import ResolvedPdf

log = logging.getLogger(__name__)

# Short connect/read timeout: admission.kaist.ac.kr frequently refuses /
# stalls connections from cloud egress IPs, and 30s × many posts blows the
# run time. Fail fast and skip when it's unreachable.
_HTTP_TIMEOUT_SEC: Final[float] = 10.0
_DOWNLOAD_HINTS: Final[tuple[str, ...]] = (
    "download", "filedown", "file/down", "attach", "fileid", "/file",
)
_GUIDE_HINTS: Final[tuple[str, ...]] = (
    "guide", "admission", "요강", "전형", "모집",
)


def _is_pdf_href(href: str) -> bool:
    path = urlsplit(href).path.lower()
    return path.endswith(".pdf")


def _looks_like_download(href: str) -> bool:
    low = href.lower()
    return any(hint in low for hint in _DOWNLOAD_HINTS)


def _score(filename: str, href: str) -> int:
    blob = f"{filename} {href}".lower()
    return sum(1 for hint in _GUIDE_HINTS if hint in blob)


def _extract_pdf_link(html: str, base_url: str) -> tuple[str, str] | None:
    """Return ``(absolute_url, filename)`` for the best PDF attachment.

    ``None`` when the detail page advertises no downloadable PDF (caller
    falls back to the legacy direct-fetch path).
    """
    soup = BeautifulSoup(html, "lxml")
    candidates: list[tuple[int, str, str]] = []
    for anchor in soup.find_all("a"):
        href = (anchor.get("href") or "").strip()
        if not href or href.startswith("#") or href.lower().startswith("javascript:"):
            continue
        text = anchor.get_text(strip=True)
        is_pdf = _is_pdf_href(href)
        names_pdf = text.lower().endswith(".pdf") or ".pdf" in text.lower()
        if not (is_pdf or (_looks_like_download(href) and names_pdf)):
            continue
        absolute = urljoin(base_url, href)
        # Prefer the link text as filename (it carries the human name);
        # fall back to the URL's last path segment.
        filename = text if names_pdf else (urlsplit(absolute).path.rsplit("/", 1)[-1] or text)
        if not filename:
            filename = "attachment.pdf"
        candidates.append((_score(filename, absolute), absolute, filename))

    if not candidates:
        return None
    # Highest guide-score first; stable order otherwise (first-on-page wins).
    candidates.sort(key=lambda c: c[0], reverse=True)
    _, absolute, filename = candidates[0]
    return absolute, filename


async def resolve(
    attachment_url: str,
    http_client: httpx.AsyncClient,
    referer: str | None = None,
) -> ResolvedPdf | None:
    """Resolve a KAIST notice detail URL to its attached guideline PDF."""
    del referer  # KAIST detail pages have no special referer requirement
    log.info("kaist: resolving %s", attachment_url[:140])
    try:
        resp = await http_client.get(attachment_url, timeout=_HTTP_TIMEOUT_SEC)
    except httpx.HTTPError as exc:
        log.warning("kaist: detail fetch failed: %s", exc)
        return None
    if resp.status_code != 200:
        log.warning(
            "kaist: detail returned HTTP %s for %s",
            resp.status_code, attachment_url[:120],
        )
        return None

    found = _extract_pdf_link(resp.text, attachment_url)
    if found is None:
        log.info("kaist: no PDF attachment in detail page")
        return None

    download_url, filename = found
    log.info("kaist: resolved -> %s (filename=%s)", download_url[:140], filename[:80])
    return ResolvedPdf(
        url=download_url,
        filename=filename,
        headers={"Referer": attachment_url},
    )
