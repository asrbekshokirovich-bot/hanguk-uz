"""Chungbuk National University (충북대) — 재외국민 notice board.

Source: https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do
CMS:    egovframework BBS, rendered as static HTML (no JS required).

Row structure (verified live 2026-05-15, 20 rows):
    <li>
      <p class="ntt_no">98</p>
      <div class="ntt_sj left">
        <a class="no_secret" href="#"
           onclick="bbsMstrView('20300'); return false;">
          <strong>{title}</strong>
        </a>
      </div>
      <p class="ntcr_nm">작성자 : 관리자</p>
      <p class="frst_register_nm">등록일 : 2024-08-21</p>
      <p class="rdcnt">조회 : 1788</p>
    </li>

External post id lives in onclick="bbsMstrView('20300')".
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListAdapter, HtmlListSelectors

CBNU_SELECTORS = HtmlListSelectors(
    row="div.board ul li",
    title="div.ntt_sj a strong",
    link="div.ntt_sj a",
    posted_at="p.frst_register_nm",
    posted_at_regex=r"(\d{4}-\d{2}-\d{2})",
    posted_at_format="%Y-%m-%d",
    attachments_in_detail=True,
    external_id_regex=r"bbsMstrView\(['\"](\d+)['\"]\)",
)


def make_cbnu_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return HtmlListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=CBNU_SELECTORS,
        institution_id=institution_id,
        http_client=http_client,
    )
