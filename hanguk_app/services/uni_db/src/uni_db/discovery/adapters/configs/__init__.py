"""Per-university adapter configuration registry.

``ADAPTER_REGISTRY`` maps a canonical ``announcement_sources.url_ko`` value
to a factory callable with signature::

    factory(source_id, institution_id, source_url_ko, http_client) -> SourceAdapter

Sources marked ``# JS-only`` need Playwright; their factories return an
``HtmlListAdapter`` with placeholder selectors that will yield 0 rows on a
live fetch (graceful no-op rather than a crash).

Sources marked ``# JSON API`` call a REST endpoint instead of scraping HTML.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import httpx

from ..html_list_adapter import HtmlListAdapter, HtmlListSelectors
from .cau import CAU_SELECTORS
from .cbnu import CBNU_SELECTORS, make_cbnu_adapter
from .hanyang import make_hanyang_adapter
from .inha import INHA_SELECTORS, make_inha_adapter
from .jbnu import JBNU_SELECTORS, make_jbnu_adapter
from .jeju import JEJU_SELECTORS, make_jeju_adapter
from .kaist import make_kaist_adapter
from .kangwon import KANGWON_SELECTORS, make_kangwon_adapter
from .konkuk import KONKUK_SELECTORS, make_konkuk_adapter
from .kookmin import KOOKMIN_SELECTORS
from .korea_univ import make_korea_univ_adapter
from .skku import make_skku_adapter
from .snu import SNU_SELECTORS
from .yonsei import (
    YONSEI_MIRAE_SELECTORS,
    YONSEI_SELECTORS,
    make_yonsei_adapter,
    make_yonsei_mirae_adapter,
)

if TYPE_CHECKING:
    from .._adapter_base import SourceAdapter


def _html(selectors: HtmlListSelectors):
    def factory(
        source_id: UUID,
        institution_id: UUID | None,
        source_url_ko: str,
        http_client: httpx.AsyncClient,
    ) -> SourceAdapter:
        return HtmlListAdapter(
            source_id=source_id,
            source_url_ko=source_url_ko,
            selectors=selectors,
            institution_id=institution_id,
            http_client=http_client,
        )
    return factory


# ── Static HTML ──────────────────────────────────────────────────────────────
# ── JSON API ─────────────────────────────────────────────────────────────────
# ── JS-only (placeholder selectors, yields 0 rows until Playwright adapter) ─

ADAPTER_REGISTRY: dict[str, object] = {
    # Static HTML — fully working
    "https://admission.snu.ac.kr/international/notice": _html(SNU_SELECTORS),

    # JSON API — fully working
    "https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=700": make_korea_univ_adapter,
    "https://admission.kaist.ac.kr/intl-undergraduate/notice":      make_kaist_adapter,

    # Playwright-rendered (JS-only sites)
    "https://admission.yonsei.ac.kr/seoul/admission/html/international/notice.asp": make_yonsei_adapter,
    "https://admission.yonsei.ac.kr/wonju/admission/html/international/notice.asp": make_yonsei_mirae_adapter,
    "https://admission.skku.edu/admission/html/abroad/notice.html":                 make_skku_adapter,
    "https://enter.jbnu.ac.kr/submenu.do?menuurl=rOjsbGuR5i0fqsax24xcPQ%3D%3D&":    make_jbnu_adapter,
    "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK":             make_hanyang_adapter,
    "https://ibsi.jejunu.ac.kr/10000048":                                            make_jeju_adapter,
    "http://enter.konkuk.ac.kr/submenu.do?menuurl=k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d&": make_konkuk_adapter,

    # JSON API (FR_BBS_SVC) — Inha shares the KU pattern with custom paths
    "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=170":                  make_inha_adapter,

    # Static HTML — gnuboard / php boards (real GET detail links; generic
    # attachment resolver fetches the PDF from the detail page)
    "https://oia.cau.ac.kr/bbs/board.php?tbl=bbs61":                 _html(CAU_SELECTORS),
    "https://admission.kookmin.ac.kr/foreigner/notice.php":          _html(KOOKMIN_SELECTORS),

    # Static HTML — egovframework boards
    "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do":               make_cbnu_adapter,
    "https://admission.kangwon.ac.kr/admission/selectBbsNttList.do?bbsNo=373":       make_kangwon_adapter,

    # JS-only — placeholder until Playwright config is written
    "https://admission.yonsei.ac.kr/":                   _html(YONSEI_SELECTORS),
    "https://admission.yonsei.ac.kr/mirae":               _html(YONSEI_MIRAE_SELECTORS),
    "https://enter.konkuk.ac.kr/":                        _html(KONKUK_SELECTORS),
    "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160": _html(INHA_SELECTORS),
    "https://ipsi.chungbuk.ac.kr/":                       _html(CBNU_SELECTORS),
    "https://enter.jbnu.ac.kr/":                          _html(JBNU_SELECTORS),
    "https://admission.kangwon.ac.kr/":                   _html(KANGWON_SELECTORS),
    "https://ipsi.jejunu.ac.kr/":                         _html(JEJU_SELECTORS),
}
