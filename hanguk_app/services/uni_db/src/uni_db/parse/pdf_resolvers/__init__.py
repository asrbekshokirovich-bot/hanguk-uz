"""Per-source PDF download resolvers.

The parse pipeline starts from an `announcements` row whose `attachments`
array nominally contains a PDF URL. For most boards (KAIST, eGov HTML
boards) that URL is a direct PDF stream — the orchestrator can `httpx.get`
it and move on. For others (Korea University, Yonsei) the recorded URL
points at an HTML detail page that *contains* the real download link
(behind a JS click handler or a query-string-keyed download endpoint).

A resolver bridges that gap: given a detail-page URL + an httpx client,
it returns a `ResolvedPdf` describing the real PDF URL, the suggested
filename, and any extra request headers required (e.g. a Referer).

Adding a new resolver:
    1. Drop a new module in this package (e.g. `inha.py`) that exposes a
       `resolve(attachment_url, *, http_client, referer=None) -> ResolvedPdf | None`
       coroutine.
    2. Register it in `_REGISTRY` below keyed by the lowercase URL host
       (or a tuple of hosts) where the detail page lives.
    3. Add a unit test under `tests/unit/test_pdf_resolvers.py` covering
       happy-path, no-link fallback, and shape assertions, with a real
       detail-page fixture under `tests/fixtures/<source>_detail.html`.

Resolvers must be side-effect free beyond the single HTTP GET they make
to fetch the detail page, must never block on Playwright/headless
browsers when a static endpoint exists, and must return ``None`` when
the detail page does not contain a recognisable PDF link (the caller
falls back to the legacy direct-fetch path).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Awaitable, Callable, Mapping
from urllib.parse import urlsplit

import httpx

__all__ = [
    "ResolvedPdf",
    "ResolverFn",
    "get_resolver_for_url",
    "registered_hosts",
    "resolve_pdf",
]


@dataclass(frozen=True, slots=True)
class ResolvedPdf:
    """Outcome of a per-source PDF resolver lookup.

    Attributes
    ----------
    url:
        Absolute URL the orchestrator should GET to receive the PDF bytes.
    filename:
        Suggested filename derived from the detail page (used when the
        server's Content-Disposition is absent or mis-encoded — most
        Korean university CMSes mojibake non-ASCII filenames).
    headers:
        Extra request headers the resolver wants the caller to set on
        the download GET (typically a ``Referer`` to satisfy the
        anti-leech check on the upstream CMS).
    """

    url: str
    filename: str
    headers: Mapping[str, str] = field(default_factory=dict)


ResolverFn = Callable[
    [str, httpx.AsyncClient, str | None],
    Awaitable["ResolvedPdf | None"],
]


# --- registry --------------------------------------------------------------
# Map of lowercase URL host -> resolver coroutine. The orchestrator looks
# up the resolver by the host of the announcement's URL. Hosts not in
# the registry fall through to the legacy direct-fetch path.

def _build_registry() -> dict[str, ResolverFn]:
    from .generic_attachment import (
        resolve as resolve_generic,
        resolve_daedong,
        resolve_dongguk_wise,
        resolve_ikw,
        resolve_mokwon,
        resolve_sangji,
    )
    from .kaist import resolve as resolve_kaist
    from .korea_univ import resolve as resolve_korea_univ
    from .yonsei import resolve as resolve_yonsei

    return {
        "oku.korea.ac.kr": resolve_korea_univ,
        "admission.yonsei.ac.kr": resolve_yonsei,
        # Inha uses the same FR_BBS_SVC CMS as KU — same fileDown anchors
        # with data-boardseq/siteno/bbsseq/fileseq attrs. The KU resolver
        # reads urlsplit(detail_url) so it correctly targets
        # admission.inha.ac.kr's /ajaxfile/FR_SVC/FileDown.do endpoint.
        "admission.inha.ac.kr": resolve_korea_univ,
        # KAIST renders the guideline as an ordinary PDF anchor on the
        # intl-undergraduate notice detail page (not a JS endpoint).
        "admission.kaist.ac.kr": resolve_kaist,
        # Direct-download boards: detail page carries a plain download anchor
        # (download.php / file_download.php). Generic resolver handles them.
        "oia.cau.ac.kr": resolve_generic,
        "admission.kookmin.ac.kr": resolve_generic,
        # Phase 4 per-site resolvers — boards that were storing the board
        # page / hidden-post alert instead of the attached file. Endpoint
        # patterns captured from the live boards; see generic_attachment.py.
        "www.daedong.ac.kr": resolve_daedong,
        "daedong.ac.kr": resolve_daedong,
        "ipsi.dongguk.ac.kr": resolve_dongguk_wise,
        "www.ikw.ac.kr": resolve_ikw,
        "ikw.ac.kr": resolve_ikw,
        "www.sangji.ac.kr": resolve_sangji,
        "sangji.ac.kr": resolve_sangji,
        "enter.mokwon.ac.kr": resolve_mokwon,
        "www.mokwon.ac.kr": resolve_mokwon,
    }


_REGISTRY: dict[str, ResolverFn] | None = None


def _registry() -> dict[str, ResolverFn]:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = _build_registry()
    return _REGISTRY


def get_resolver_for_url(url: str) -> ResolverFn | None:
    """Return the resolver bound to the URL's host, or ``None``."""
    host = urlsplit(url).hostname or ""
    return _registry().get(host.lower())


def registered_hosts() -> tuple[str, ...]:
    """Hosts that have a per-source resolver.

    The fetch stage uses this to widen its candidate filter: an
    announcement whose ``url_ko`` host is in this set is fetchable even
    when discovery never captured an attachment URL (the resolver follows
    the detail page to the real PDF). Sourcing it here keeps the fetch
    filter in lockstep with the registry instead of a drifting hardcoded
    list.
    """
    return tuple(_registry().keys())


async def resolve_pdf(
    attachment_url: str,
    *,
    http_client: httpx.AsyncClient,
    referer: str | None = None,
) -> ResolvedPdf | None:
    """Top-level dispatch: pick a per-host resolver and run it.

    Returns ``None`` when no resolver is registered for the host *or*
    the registered resolver couldn't find a PDF link on the detail page.
    Either condition means the caller should fall back to its existing
    direct-fetch path.
    """
    resolver = get_resolver_for_url(attachment_url)
    if resolver is None:
        return None
    return await resolver(attachment_url, http_client, referer)
