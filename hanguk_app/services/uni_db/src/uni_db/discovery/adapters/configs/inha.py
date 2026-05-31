"""Inha University (인하대) — 재외국민 공지사항 (notice list).

Source: https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=170
CMS:    Same FR_BBS_SVC pattern as Korea University, but with a
        different base path and BOARD_SEQ:
          - URL path is `/ajaxf/FR_BBS_SVC/BBSViewList.do` (no /oku/ prefix)
          - SITE_NO=2, BOARD_SEQ=1
          - MENU_ID=170 is the 재외국민 공지사항 board

Verified live 2026-05-15: 11 records returned, JSON shape matches KU
(SUBJECT, WRITE_DATE, BBS_SEQ, FILE_CNT).

Placeholder selectors retained for adapter-loading symmetry with the
HTML-based configs; not actually used (JsonApiAdapter ignores them).
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListSelectors
from ..json_api_adapter import JsonApiAdapter, KuBbsConfig

# Placeholder for backwards-compat import in __init__.py.
INHA_SELECTORS = HtmlListSelectors(
    row="table tbody tr",
    title="td a",
    link="td a",
    posted_at=None,
)


_INHA_CONFIG = KuBbsConfig(
    menu_id="170",
    site_no="2",
    board_seq="1",
    page_size=20,
    base_url="https://admission.inha.ac.kr",
    list_path="/ajaxf/FR_BBS_SVC/BBSViewList.do",
    detail_path_template=(
        "/cms/FR_BBS_CON/BoardView.do"
        "?MENU_ID={menu_id}&BBS_SEQ={bbs_seq}"
        "&SITE_NO={site_no}&BOARD_SEQ={board_seq}"
    ),
)


def make_inha_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return JsonApiAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        config=_INHA_CONFIG,
        institution_id=institution_id,
        http_client=http_client,
    )
