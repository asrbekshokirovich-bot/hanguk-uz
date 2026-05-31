"""Jeonbuk National University (전북대) — 재외국민 notice board.

Source: https://enter.jbnu.ac.kr/submenu.do?menuurl=rOjsbGuR5i0fqsax24xcPQ%3D%3D&
CMS:    Custom div-table layout (not <table>). Renders JS but completes
        before networkidle, so Playwright is required for the bootstrap.

Row structure (verified live 2026-05-15, 10 rows after networkidle):
    <div class="tr">
      <div class="td"><span class="noti">공지</span></div>
      <div class="td">
        <a class="bbs_title" href="javascript:"
           onclick="pop_pass_open('43576','N');">{title}</a>
      </div>
      <div class="td"><img alt="첨부파일" .../></div>
      <div class="td">2026.04.30</div>
      <div class="td">136</div>
    </div>

The "date" cell is the 4th div.td child (after icon, title, attachment).
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..playwright_list_adapter import PlaywrightListAdapter, PlaywrightRenderOptions

JBNU_SELECTORS = HtmlListSelectors(
    row="div.bbs_list div.tr",
    title="a.bbs_title",
    link="a.bbs_title",
    posted_at="div.td:nth-child(4)",
    posted_at_regex=r"(\d{4}\.\d{2}\.\d{2})",
    posted_at_format="%Y.%m.%d",
    attachments_in_detail=True,
    external_id_regex=r"pop_pass_open\(['\"](\d+)['\"]",
)

_RENDER = PlaywrightRenderOptions(
    wait_for_selector="div.bbs_list div.tr",
    wait_until="networkidle",
    timeout_ms=30_000,
)


def make_jbnu_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=JBNU_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )
