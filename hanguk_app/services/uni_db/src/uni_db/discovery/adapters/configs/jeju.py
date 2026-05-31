"""Jeju National University (제주대) — 공지사항 (notice list).

Source:        https://ibsi.jejunu.ac.kr/10000048
Note on TLD:   The correct host is `ibsi` not `ipsi` (the 2026-05-14 seed
                had `ipsi.jejunu.ac.kr` — a typo that fails DNS resolution).
                The fix is applied to announcement_sources via the seed
                script at scripts/_seed_round_2.py.

CMS:    Custom div-table layout (same pattern as JBNU). Renders via JS
        bootstrap. Use PlaywrightListAdapter.

Row structure (verified live 2026-05-15, 10 rows):
    <div class="tr">
      <div class="td"><img class="icon_noti" .../></div>
      <div class="td">
        <div class="bbs_con">
          <div class="bbs_tit_area">
            <a class="bbs_tit"
               href="/10000048?mode=view&bbs_seq=45629&">{title}</a>
          </div>
          <ul class="reg_info">
            <li><span class="hash">공통</span></li>
            <li>2026.04.30</li>
          </ul>
        </div>
      </div>
    </div>
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..playwright_list_adapter import PlaywrightListAdapter, PlaywrightRenderOptions

JEJU_SELECTORS = HtmlListSelectors(
    row="div.bbs_list div.tr",
    title="a.bbs_tit",
    link="a.bbs_tit",
    posted_at="ul.reg_info li:last-child",
    posted_at_regex=r"(\d{4}\.\d{2}\.\d{2})",
    posted_at_format="%Y.%m.%d",
    attachments_in_detail=True,
    external_id_regex=r"bbs_seq=(\d+)",
)

_RENDER = PlaywrightRenderOptions(
    wait_for_selector="div.bbs_list div.tr",
    wait_until="networkidle",
    timeout_ms=30_000,
)


def make_jeju_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=JEJU_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )
