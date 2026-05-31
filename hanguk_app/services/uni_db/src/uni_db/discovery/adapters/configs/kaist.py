"""KAIST — International undergraduate admissions notice board.

Source: https://admission.kaist.ac.kr/intl-undergraduate/notice
Board:  Wizdom CMS, board_no=38

Uses the Wizdom JSON API: GET /wz/api/board/38?pageIndex=1&pageSize=N
Returns JSON with records containing pstTtl, regDt, pstNo, boardAtchList.
Verified 2026-05-14 against live API.
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..json_api_adapter import JsonApiAdapter, WzBoardConfig

_CONFIG = WzBoardConfig(
    board_no=38,
    page_size=20,
    base_url="https://admission.kaist.ac.kr",
    detail_path_template="/intl-undergraduate/notice/notice#{pst_no}",
)


def make_kaist_adapter(
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
