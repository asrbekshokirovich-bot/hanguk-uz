"""Korea University — OKU international admissions notice board.

Source: https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=700
Board:  MENU_ID=1700, SITE_NO=2, BOARD_SEQ=5

Uses the KU FR_BBS_SVC JSON API (not static HTML — the board tbody is
populated by $.ajax on page load).  Verified 2026-05-14 against live API.

Note: the live source URL registered in announcement_sources is MENU_ID=700
(the 외국인전형 overview page) but the actual notice board is MENU_ID=1700.
The adapter uses the correct notice board endpoint regardless of the source URL.
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..json_api_adapter import JsonApiAdapter, KuBbsConfig

_CONFIG = KuBbsConfig(
    menu_id="1700",
    site_no="2",
    board_seq="5",
    page_size=20,
    base_url="https://oku.korea.ac.kr",
)


def make_korea_univ_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return JsonApiAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        config=_CONFIG,
        institution_id=institution_id,
        http_client=http_client,
    )
