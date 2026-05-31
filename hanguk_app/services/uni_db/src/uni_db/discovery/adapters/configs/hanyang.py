"""Hanyang University (한양대) — 재외국민 (overseas Korean) notice list.

Source: https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK
CMS:    Custom JSP, JS-bootstrapped list. Each row is an <li onclick=...>
        (no <a> tag — entire <li> is clickable).

Row structure (verified live 2026-05-15, 3 rows on the 재외국민 tab):
    <li onclick="js_encode_view('notice_view.do?bn=20725&m_type=JEOEGUK&nPage=1');">
      <div class="board-info-title">
        <em class="lb-foreign">재외국민</em>
        <strong>{title}<button class="btn-attachment">첨부파일</button></strong>
        <p><span class="date">2026.04.30</span><span class="readcnt">1778</span></p>
      </div>
    </li>

The post id (`bn`) is in the row's onclick handler. HtmlListAdapter now
concatenates the row's onclick with the link element's onclick for the
external_id regex, so the absence of an inner <a> is not a problem.
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..playwright_list_adapter import PlaywrightListAdapter, PlaywrightRenderOptions

HANYANG_SELECTORS = HtmlListSelectors(
    row="li[onclick*='notice_view']",
    title="div.board-info-title strong",
    # The row has no <a>; use a guaranteed descendant so select_one returns
    # something non-null. The external_id regex below sources bn=... from
    # the row's onclick attr instead of the link's href.
    link="div.board-info-title",
    posted_at="span.date",
    posted_at_regex=r"(\d{4}\.\d{2}\.\d{2})",
    posted_at_format="%Y.%m.%d",
    attachments_in_detail=True,
    external_id_regex=r"bn=(\d+)",
)

_RENDER = PlaywrightRenderOptions(
    wait_for_selector="li[onclick*='notice_view']",
    wait_until="networkidle",
    timeout_ms=30_000,
)


def make_hanyang_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=HANYANG_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )
