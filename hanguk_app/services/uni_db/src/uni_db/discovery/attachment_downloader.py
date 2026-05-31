"""Attachment downloader handling the 첨부파일 indirection layer.

Audit §6.5: many egov boards expose attachments via a redirect endpoint
like `/cms/board/download.do?atchFileId=...&fileSn=...` that requires the
parent post's session cookie. The downloader follows redirects, captures
ETag / Last-Modified, hashes the body, and returns a versioned blob.

Phase 0 returns fixture bytes when `settings.live_crawl=False`.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import httpx

from ..config import settings
from .models import Attachment, AttachmentBlob


async def download_attachment(
    attachment: Attachment,
    *,
    http_client: httpx.AsyncClient | None = None,
    fixture_path: Path | None = None,
) -> AttachmentBlob:
    if not settings.live_crawl:
        fixture_root = fixture_path or Path("tests/fixtures")
        candidate = fixture_root / attachment.filename
        if not candidate.exists():
            raise FileNotFoundError(
                f"fixture {candidate} missing — cannot satisfy attachment download "
                "while UNI_DB_LIVE_CRAWL=false."
            )
        data = candidate.read_bytes()
        return AttachmentBlob(
            attachment=attachment,
            bytes_=data,
            sha256=hashlib.sha256(data).hexdigest(),
        )

    if http_client is None:  # pragma: no cover
        raise RuntimeError("live_crawl=True but no http_client provided")

    resp = await http_client.get(
        attachment.url,
        timeout=settings.http_request_timeout_sec,
        headers={"User-Agent": settings.http_user_agent},
        follow_redirects=True,
    )
    resp.raise_for_status()
    data = resp.content
    return AttachmentBlob(
        attachment=Attachment(
            filename=_resolved_filename(attachment, resp),
            url=str(resp.request.url),
            size_bytes=len(data),
            mime=resp.headers.get("content-type"),
        ),
        bytes_=data,
        sha256=hashlib.sha256(data).hexdigest(),
        http_etag=resp.headers.get("etag"),
        http_last_modified=resp.headers.get("last-modified"),
    )


def _resolved_filename(att: Attachment, resp: httpx.Response) -> str:
    cd = resp.headers.get("content-disposition", "")
    if "filename=" in cd:
        return cd.split("filename=", 1)[1].strip('"; ')
    return att.filename
