"""Yonsei University PDF resolver (admission.yonsei.ac.kr).

Yonsei's international admissions detail pages live under
``/seoul/admission/html/international/noticeView.asp?BBS_NO=<id>`` and
``/wonju/admission/html/international/noticeView.asp?BBS_NO=<id>``.

Attachments are rendered as ordinary ``<a>`` tags pointing at a static
``/seoul/download.asp?furl=<server_path>&fname=<euc-kr-encoded-filename>``
endpoint. No JS handler, no JSON RPC — just a Referer-checked GET. Each
detail page also lists three site-wide PDF banners hosted on a
``www2.yonsei.ac.kr`` subdomain (the yearly 입학전형 시행계획 + a
'guideline' file). Those are the canonical admissions plan PDFs and
should be preferred when present.

Resolver strategy:

  1. Fetch detail HTML (EUC-KR encoded — httpx auto-detects via
     ``Content-Type``).
  2. Look for ``a[href$=".pdf"]`` on ``www2.yonsei.ac.kr`` first — those
     are the year's overall plan PDFs which carry the most extractable
     fields (calendar, requirements).
  3. If none, fall back to the first ``a[href*='/download.asp']``
     pointing at a ``.pdf`` / ``.PDF`` file in the per-notice attachment
     list. The download.asp endpoint requires a Referer header pointing
     at the detail page.
  4. Otherwise return ``None`` (caller falls back to legacy direct fetch).

Verified live 2026-05-17 against BBS_NO 3417/3389/3488 — anchor count
and download.asp URLs match the probe output.
"""

from __future__ import annotations

import logging
from typing import Final
from urllib.parse import urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from . import ResolvedPdf

log = logging.getLogger(__name__)

_HTTP_TIMEOUT_SEC: Final[float] = 30.0


def _is_yonsei_detail(url: str) -> bool:
    """Only resolve detail-page URLs; reject list URLs to avoid loops."""
    parts = urlsplit(url)
    return (
        parts.hostname
        and parts.hostname.lower().endswith("admission.yonsei.ac.kr")
        and "noticeView.asp" in parts.path
    )


def _pick_attachment_anchor(html: str) -> tuple[str, str] | None:
    """Find the best PDF anchor on a Yonsei detail page.

    Returns ``(href, filename)`` or ``None``.

    Preference order:
      1. Per-notice attachment served by ``download.asp`` (most relevant
         to that specific announcement — application instructions,
         change notices, etc.).
      2. Year-plan boilerplate hosted on ``www2.yonsei.ac.kr`` (the
         시행계획 file — useful but generic).
    """
    soup = BeautifulSoup(html, "lxml")

    download_asp_anchor: tuple[str, str] | None = None
    canonical_plan_anchor: tuple[str, str] | None = None

    for a in soup.find_all("a"):
        href = a.get("href") or ""
        if not href:
            continue
        text = a.get_text(strip=True)

        href_lower = href.lower()
        if "/download.asp" in href_lower and (
            ".pdf" in href_lower or ".PDF" in href
        ):
            # Per-notice attachment — take the first one we see.
            if download_asp_anchor is None:
                download_asp_anchor = (href, text or "yonsei_attachment.pdf")

        elif "www2.yonsei.ac.kr" in href_lower and href_lower.endswith(".pdf"):
            # Year-plan boilerplate. Prefer the most recent year by
            # filename — file names follow ``YYYY_plan.pdf``.
            if canonical_plan_anchor is None or href > canonical_plan_anchor[0]:
                canonical_plan_anchor = (href, text or href.rsplit("/", 1)[-1])

    # Per-notice attachments are more interesting; year plans are
    # boilerplate that repeats across every notice.
    return download_asp_anchor or canonical_plan_anchor


async def resolve(
    attachment_url: str,
    http_client: httpx.AsyncClient,
    referer: str | None = None,
) -> ResolvedPdf | None:
    """Resolve a Yonsei detail-page URL to its real PDF download URL.

    Parameters
    ----------
    attachment_url:
        Detail-page URL stored on the announcement
        (``/seoul/admission/html/international/noticeView.asp?BBS_NO=...``).
        On the Yonsei adapter, the discovery list page yields
        announcements with empty ``attachments`` arrays, so the caller
        passes the announcement's ``url_ko`` as the attachment URL.
    http_client:
        Async HTTP client. Caller owns the lifetime.
    referer:
        Unused for Yonsei — the detail page is reachable without a
        special referer. The download.asp endpoint requires a referer,
        which the resolver returns in ``ResolvedPdf.headers``.
    """
    del referer  # unused: download.asp referer is the detail page itself

    if not _is_yonsei_detail(attachment_url):
        log.info("yonsei: not a detail URL, skipping: %s", attachment_url[:120])
        return None

    log.info("yonsei: resolving %s", attachment_url[:140])
    try:
        resp = await http_client.get(
            attachment_url,
            headers={"Referer": attachment_url},
            timeout=_HTTP_TIMEOUT_SEC,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        log.warning("yonsei: detail fetch failed: %s", exc)
        return None
    if resp.status_code != 200:
        log.warning(
            "yonsei: detail returned HTTP %s for %s",
            resp.status_code, attachment_url[:120],
        )
        return None

    # Yonsei's detail pages declare ``Content-Type: text/html; Charset=euc-kr``.
    # ``httpx.Response.text`` honours that header. ``r.content`` would
    # mojibake the EUC-KR Korean fname query string.
    picked = _pick_attachment_anchor(resp.text)
    if picked is None:
        log.info("yonsei: no PDF anchor in detail page")
        return None

    href, filename = picked
    download_url = urljoin(attachment_url, href)
    log.info(
        "yonsei: resolved -> %s (filename=%s)", download_url[:140], filename[:80]
    )
    return ResolvedPdf(
        url=download_url,
        filename=filename,
        headers={"Referer": attachment_url},
    )
