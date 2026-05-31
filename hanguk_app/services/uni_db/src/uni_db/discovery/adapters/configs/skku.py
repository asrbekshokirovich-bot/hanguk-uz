"""SungKyunKwan University (성균관대) — 재외국민 (overseas Korean) notice board.

Source:  https://admission.skku.edu/admission/html/abroad/notice.html
CMS:     Static HTML rendered via JS bootstrap; reliably parseable with
         PlaywrightListAdapter after networkidle.

Row structure (verified live 2026-05-15):
    <tr>
      <td>
        <a href="#" onclick="viewData('59462');">
          <div class="subject">
            <span class="noti">공지</span>
            <p><span>{title}</span></p>
          </div>
          <div class="reg">
            <span class="bar">작성일 : 2026-03-27</span>
            <span>조회수 : 2097</span>
          </div>
          <span class="file">…attachment icon…</span>
        </a>
      </td>
    </tr>

External ID lives in the onclick handler (`viewData('59462')`).
Posted-at is embedded as "작성일 : 2026-03-27" inside <div class="reg">.
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..playwright_list_adapter import PlaywrightListAdapter, PlaywrightRenderOptions

SKKU_SELECTORS = HtmlListSelectors(
    row="table tbody tr",
    title="div.subject p",
    link="td a",
    posted_at="div.reg",
    posted_at_regex=r"(\d{4}-\d{2}-\d{2})",
    posted_at_format="%Y-%m-%d",
    attachments_in_detail=True,
    # SKKU encodes the post id in onclick="viewData('59462')". The adapter
    # falls back to URL+onclick matching; this pattern covers both.
    external_id_regex=r"viewData\(['\"](\d+)['\"]\)",
)

_RENDER = PlaywrightRenderOptions(
    wait_for_selector="table tbody tr",
    wait_until="networkidle",
    timeout_ms=30_000,
)


def make_skku_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return PlaywrightListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=SKKU_SELECTORS,
        render_options=_RENDER,
        institution_id=institution_id,
        http_client=http_client,
    )
