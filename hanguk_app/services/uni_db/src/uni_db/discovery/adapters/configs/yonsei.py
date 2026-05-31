"""Yonsei University — international admissions notice board.

Notice list (Int'l Student tab, Seoul campus):
    https://admission.yonsei.ac.kr/seoul/admission/html/international/notice.asp

The page renders via client-side ASP/JS — a static httpx GET returns
the loader shell, not the table. Uses PlaywrightListAdapter to render
Chromium first, then BeautifulSoup over the post-JS HTML.

Row structure (verified live 2026-05-14 via Playwright probe):
    <tr>
      <td>{number}</td>
      <td class="subject lineLeft">
        <a href="noticeView.asp?BBS_NO={id}&...">
          <span class="tit"><strong>[Int'l Student]</strong> {title}</span>
          <span class="date">작성일: 2026/03/04ㅣ 조회수 : 18969</span>
        </a>
      </td>
      <td>{attachment icon or empty}</td>
    </tr>

The Mirae (Wonju) campus uses the same Yonsei ASP CMS — its int'l notice
URL is /wonju/admission/html/international/notice.asp.
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..playwright_list_adapter import PlaywrightListAdapter, PlaywrightRenderOptions

YONSEI_SELECTORS = HtmlListSelectors(
    row="table tbody tr",
    title="td.subject span.tit",
    link="td.subject a",
    posted_at="td.subject span.date",
    posted_at_regex=r"(\d{4}/\d{2}/\d{2})",
    posted_at_format="%Y/%m/%d",
    attachments_in_detail=True,
    external_id_regex=r"BBS_NO=([0-9]+)",
)

YONSEI_MIRAE_SELECTORS = YONSEI_SELECTORS

_RENDER = PlaywrightRenderOptions(
    wait_for_selector="table tbody tr",
    wait_until="networkidle",
    timeout_ms=30_000,
)


def make_yonsei_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=YONSEI_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )


def make_yonsei_mirae_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=YONSEI_MIRAE_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )
