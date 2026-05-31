"""Kangwon National University (강원대) — admission notice list.

Source: https://admission.kangwon.ac.kr/admission/selectBbsNttList.do?bbsNo=373
CMS:    eGovFramework BBS — static HTML, served fast via httpx.

Note: Kangwon mixes all categories (공통/수시/정시/편입학/시간제/대학원)
in one board. There is no separate 재외국민 category at the URL level —
filter by title keywords post-fetch via matches_admission_signal().
"""

from __future__ import annotations

from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListAdapter, HtmlListSelectors

KANGWON_SELECTORS = HtmlListSelectors(
    row="table tbody tr",
    title="td.subject a",
    link="td.subject a",
    posted_at="td.date",
    posted_at_regex=r"(\d{4}\.\d{2}\.\d{2})",
    posted_at_format="%Y.%m.%d",
    attachments_in_detail=True,
    external_id_regex=r"nttNo=(\d+)",
)


def make_kangwon_adapter(
    source_id: UUID,
    institution_id: UUID | None,
    source_url_ko: str,
    http_client: httpx.AsyncClient,
):
    return HtmlListAdapter(
        source_id=source_id,
        source_url_ko=source_url_ko,
        selectors=KANGWON_SELECTORS,
        institution_id=institution_id,
        http_client=http_client,
    )
