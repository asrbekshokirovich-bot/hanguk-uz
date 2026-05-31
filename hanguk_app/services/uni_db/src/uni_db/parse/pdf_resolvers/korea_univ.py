"""Korea University PDF resolver (OKU CMS — FR_BBS_CON board family).

Korea University's admissions board renders a detail page at
``https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do?...&BBS_SEQ=<id>...``.
Attachments are rendered as JS-handled anchors:

    <a href="#;"
       title="<filename> 다운로드"
       data-boardseq="5"
       data-siteno="2"
       data-bbsseq="1791"
       data-fileseq="2"
       onclick="fileDown(this);">
      2028학년도_고려대(서울)_입학전형시행계획(2026.04.).pdf
    </a>

The ``fileDown`` JS just navigates to a deterministic static endpoint:

    /ajaxfile/FR_SVC/FileDown.do?GBN=X01
        &BOARD_SEQ={data-boardseq}
        &SITE_NO={data-siteno}
        &BBS_SEQ={data-bbsseq}
        &FILE_SEQ={data-fileseq}

So the resolver does the trivial transform — fetch the detail HTML,
find the first ``a[onclick*=fileDown]`` with the required ``data-*``
attributes, and emit the static download URL plus the link text as
the filename. No Playwright required.

The OKU board *does* require a Referer header pointing at the detail
page; without it the FileDown endpoint sometimes serves a 200 empty
body. The resolver returns the Referer in ``ResolvedPdf.headers`` so
the caller can set it on the actual download GET.

Verified live 2026-05-17 against BBS_SEQ=1791 (282 KiB PDF).
"""

from __future__ import annotations

import logging
from typing import Final
from urllib.parse import urlsplit, urlunsplit

import httpx
from bs4 import BeautifulSoup

from . import ResolvedPdf

log = logging.getLogger(__name__)

_DOWNLOAD_PATH: Final[str] = "/ajaxfile/FR_SVC/FileDown.do"
_HTTP_TIMEOUT_SEC: Final[float] = 30.0


def _detail_referer(detail_url: str) -> str:
    """Return the canonical detail-page URL to use as ``Referer``."""
    return detail_url


def _extract_download_link(html: str) -> tuple[dict[str, str], str] | None:
    """Parse the OKU detail HTML for the first ``fileDown`` anchor.

    Returns a ``(data_attrs, filename)`` tuple, or ``None`` if no
    download anchor is present (e.g. text-only notice).
    """
    soup = BeautifulSoup(html, "lxml")
    for anchor in soup.find_all("a"):
        onclick = anchor.get("onclick") or ""
        if "fileDown" not in onclick:
            continue
        try:
            data = {
                "board_seq": anchor["data-boardseq"],
                "site_no": anchor["data-siteno"],
                "bbs_seq": anchor["data-bbsseq"],
                "file_seq": anchor["data-fileseq"],
            }
        except KeyError as exc:
            log.debug("korea_univ: fileDown anchor missing %s — skipping", exc)
            continue
        filename = anchor.get_text(strip=True) or f"attachment_{data['bbs_seq']}.pdf"
        return data, filename
    return None


def _build_download_url(detail_url: str, data: dict[str, str]) -> str:
    parts = urlsplit(detail_url)
    query = (
        "GBN=X01"
        f"&BOARD_SEQ={data['board_seq']}"
        f"&SITE_NO={data['site_no']}"
        f"&BBS_SEQ={data['bbs_seq']}"
        f"&FILE_SEQ={data['file_seq']}"
    )
    return urlunsplit((parts.scheme, parts.netloc, _DOWNLOAD_PATH, query, ""))


async def resolve(
    attachment_url: str,
    http_client: httpx.AsyncClient,
    referer: str | None = None,
) -> ResolvedPdf | None:
    """Resolve a KU board detail URL to its real PDF download URL.

    Parameters
    ----------
    attachment_url:
        The detail-page URL stored on the announcement row
        (``...BoardView.do?...&BBS_SEQ=<id>...``).
    http_client:
        Async HTTP client used to fetch the detail page. Caller owns
        the lifetime.
    referer:
        Unused for KU — the detail page itself is reachable without a
        special referer. Accepted for protocol uniformity.

    Returns
    -------
    ``ResolvedPdf`` when the detail page advertises a downloadable file,
    otherwise ``None`` (caller falls back to the legacy direct-fetch
    path).
    """
    del referer  # unused — KU detail pages have no referer requirement
    log.info("korea_univ: resolving %s", attachment_url[:140])
    try:
        resp = await http_client.get(attachment_url, timeout=_HTTP_TIMEOUT_SEC)
    except httpx.HTTPError as exc:
        log.warning("korea_univ: detail fetch failed: %s", exc)
        return None
    if resp.status_code != 200:
        log.warning(
            "korea_univ: detail returned HTTP %s for %s",
            resp.status_code, attachment_url[:120],
        )
        return None

    parsed = _extract_download_link(resp.text)
    if parsed is None:
        log.info("korea_univ: no fileDown anchor in detail page")
        return None

    data, filename = parsed
    download_url = _build_download_url(attachment_url, data)
    log.info(
        "korea_univ: resolved -> %s (filename=%s)", download_url, filename[:80]
    )
    return ResolvedPdf(
        url=download_url,
        filename=filename,
        headers={"Referer": _detail_referer(attachment_url)},
    )
