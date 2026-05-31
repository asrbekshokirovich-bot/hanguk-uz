"""Generic JSON API adapter for Korean universities that expose a board REST API.

Two CMS patterns supported:

* ``ku`` — Korea University OKU CMS (FR_BBS_SVC).
  POST to ``/oku/ajaxf/FR_BBS_SVC/BBSViewList.do`` with form params;
  returns ``{"data": {"list": [...]}}`` where each record has
  SUBJECT, WRITE_DATE, BBS_SEQ, FILE_CNT.

* ``wz`` — Wizdom CMS used by KAIST.
  GET ``/wz/api/board/{board_no}?pageIndex=1&pageSize=N``;
  returns ``{"data": [...]}`` where each record has
  pstTtl, regDt, pstNo, atchFileCnt, boardAtchList.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

import httpx

from ...config import settings
from ..models import Announcement, Attachment, AttachmentBlob, PostDetail

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class KuBbsConfig:
    """FR_BBS_SVC configuration (Korea University + Inha + clones).

    The same egovframework BBS service is reused by several Korean
    university admissions sites. KU exposes it at /oku/ajaxf/...;
    Inha exposes the same service at /ajaxf/... (no /oku/ prefix).
    The `list_path` field overrides the default KU path.
    """

    cms: Literal["ku"] = field(default="ku", init=False)
    menu_id: str = "1700"
    site_no: str = "2"
    board_seq: str = "5"
    page_size: int = 20
    base_url: str = "https://oku.korea.ac.kr"
    list_path: str = "/oku/ajaxf/FR_BBS_SVC/BBSViewList.do"
    detail_path_template: str = (
        "/oku/cms/FR_BBS_CON/BoardView.do"
        "?MENU_ID={menu_id}&BBS_SEQ={bbs_seq}"
        "&SITE_NO={site_no}&BOARD_SEQ={board_seq}"
    )


@dataclass(frozen=True, slots=True)
class WzBoardConfig:
    """Wizdom CMS board configuration (KAIST)."""

    cms: Literal["wz"] = field(default="wz", init=False)
    board_no: int = 38
    page_size: int = 20
    base_url: str = "https://admission.kaist.ac.kr"
    detail_path_template: str = "/intl-undergraduate/notice/notice#{pst_no}"


JsonApiConfig = KuBbsConfig | WzBoardConfig


class JsonApiAdapter:
    """SourceAdapter for JSON-API board CMS systems."""

    institution_id: UUID | None
    source_id: UUID
    source_url_ko: str

    def __init__(
        self,
        *,
        source_id: UUID,
        source_url_ko: str,
        config: JsonApiConfig,
        institution_id: UUID | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.source_id = source_id
        self.source_url_ko = source_url_ko
        self.institution_id = institution_id
        self._config = config
        self._http = http_client

    async def list_recent_posts(self, since: datetime) -> list[Announcement]:
        if not settings.live_crawl:
            return []
        if self._http is None:
            raise RuntimeError("live_crawl=True but no http_client provided")

        cfg = self._config
        if isinstance(cfg, KuBbsConfig):
            return await self._ku_list(since)
        else:
            return await self._wz_list(since)

    async def fetch_post_detail(self, external_post_id: str) -> PostDetail:
        cfg = self._config
        if isinstance(cfg, KuBbsConfig):
            detail_url = cfg.base_url + cfg.detail_path_template.format(
                menu_id=cfg.menu_id,
                bbs_seq=external_post_id,
                site_no=cfg.site_no,
                board_seq=cfg.board_seq,
            )
        else:
            detail_url = (
                cfg.base_url
                + cfg.detail_path_template.format(pst_no=external_post_id)
            )
        return PostDetail(
            announcement=Announcement(
                external_post_id=external_post_id,
                title_ko="",
                url_ko=detail_url,
                posted_at=None,
            ),
            body_html=None,
            body_text=None,
        )

    async def fetch_attachment(self, attachment_url: str) -> AttachmentBlob:
        if self._http is None:
            raise RuntimeError("live_crawl=True but no http_client provided")
        resp = await self._http.get(attachment_url, timeout=settings.http_request_timeout_sec)
        resp.raise_for_status()
        data = resp.content
        return AttachmentBlob(
            attachment=Attachment(
                filename=attachment_url.rsplit("/", 1)[-1],
                url=attachment_url,
                size_bytes=len(data),
                mime=resp.headers.get("content-type"),
            ),
            bytes_=data,
            sha256=hashlib.sha256(data).hexdigest(),
            http_etag=resp.headers.get("etag"),
        )

    # ------------------------------------------------------------------ KU BBS

    async def _ku_list(self, since: datetime) -> list[Announcement]:
        assert isinstance(self._config, KuBbsConfig)
        cfg = self._config
        resp = await self._http.post(  # type: ignore[union-attr]
            f"{cfg.base_url}{cfg.list_path}",
            data={
                "pageNo": "1",
                "pagePerCnt": str(cfg.page_size),
                "MENU_ID": cfg.menu_id,
                "SITE_NO": cfg.site_no,
                "BOARD_SEQ": cfg.board_seq,
                "SEARCH_FLD": "",
                "SEARCH": "",
                "BBS_SEQ": "",
                "PWD": "",
            },
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Referer": self.source_url_ko,
                "User-Agent": settings.http_user_agent,
            },
            timeout=settings.http_request_timeout_sec,
        )
        resp.raise_for_status()
        payload = resp.json()
        records: list[Any] = payload.get("data", {}).get("list", [])

        announcements: list[Announcement] = []
        for rec in records:
            posted_at = _parse_ku_date(rec.get("WRITE_DATE") or rec.get("WRITE_DT", ""))
            if posted_at and posted_at < since:
                continue
            bbs_seq = str(rec["BBS_SEQ"])
            detail_url = cfg.base_url + cfg.detail_path_template.format(
                menu_id=cfg.menu_id,
                bbs_seq=bbs_seq,
                site_no=cfg.site_no,
                board_seq=cfg.board_seq,
            )
            attachments = []
            if int(rec.get("FILE_CNT", 0)) > 0:
                # Attachment URLs require fetching the detail page; mark present
                attachments = [
                    Attachment(
                        filename=f"attachment_{bbs_seq}.pdf",
                        url=detail_url,
                        size_bytes=None,
                    )
                ]
            announcements.append(
                Announcement(
                    external_post_id=bbs_seq,
                    title_ko=rec.get("SUBJECT", ""),
                    url_ko=detail_url,
                    posted_at=posted_at,
                    attachments=attachments,
                )
            )
        return announcements

    # ------------------------------------------------------------------ WZ BBS

    async def _wz_list(self, since: datetime) -> list[Announcement]:
        assert isinstance(self._config, WzBoardConfig)
        cfg = self._config
        resp = await self._http.get(  # type: ignore[union-attr]
            f"{cfg.base_url}/wz/api/board/{cfg.board_no}",
            params={"pageIndex": "1", "pageSize": str(cfg.page_size)},
            headers={"Accept": "application/json", "User-Agent": settings.http_user_agent},
            timeout=settings.http_request_timeout_sec,
        )
        resp.raise_for_status()
        records: list[Any] = resp.json().get("data", [])

        announcements: list[Announcement] = []
        for rec in records:
            posted_at = _parse_wz_date(rec.get("regDt", ""))
            if posted_at and posted_at < since:
                continue
            pst_no = str(rec["pstNo"])
            detail_url = (
                cfg.base_url
                + cfg.detail_path_template.format(pst_no=pst_no)
            )
            attachments = []
            atch_list = rec.get("boardAtchList") or []
            for atch in atch_list:
                atch_no = atch.get("atchFileNo", 0)
                atch_name = atch.get("atchFileNm", f"attachment_{atch_no}")
                atch_url = f"{cfg.base_url}/wz/api/board/{cfg.board_no}/{pst_no}/download/{atch_no}"
                attachments.append(
                    Attachment(filename=atch_name, url=atch_url, size_bytes=None)
                )
            announcements.append(
                Announcement(
                    external_post_id=pst_no,
                    title_ko=rec.get("pstTtl", ""),
                    url_ko=detail_url,
                    posted_at=posted_at,
                    attachments=attachments,
                )
            )
        return announcements


def _parse_ku_date(text: str) -> datetime | None:
    for fmt in ("%Y.%m.%d", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text.strip()[:19], fmt[:len(text.strip())]).replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            pass
    return None


def _parse_wz_date(text: str) -> datetime | None:
    # "2026.04.30 15:38:18"
    for fmt in ("%Y.%m.%d %H:%M:%S", "%Y.%m.%d"):
        try:
            return datetime.strptime(text.strip()[:19], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None
