"""Cloudflare R2 backend — DEPRECATED in favour of Supabase Storage.

Per ADR-009, R2 is no longer the default. This module is preserved
behind `UNI_DB_BLOB_STORAGE=r2` so the code path can be revived if
ADR-009 is reversed (e.g. if Supabase Storage egress costs become
prohibitive at v3 scale). Do NOT extend this file with new features
— land them in `supabase_storage.py` and let R2 catch up only on a
formal reversal.
"""

from __future__ import annotations

from pathlib import Path

from ..config import settings
from .common import StoredBlob, _store_locally


def store_blob(
    payload: bytes,
    *,
    sha256: str,
    mime: str | None = None,
) -> StoredBlob:
    if not settings.live_apis:
        return _store_locally(payload, sha256=sha256)
    raise NotImplementedError(
        "R2 backend is deprecated per ADR-009. Set "
        "UNI_DB_BLOB_STORAGE=supabase_storage. If you need R2 back, "
        "first land an ADR superseding ADR-009 with the cost rationale."
    )


def create_signed_url(
    storage_path: str,
    *,
    expires_in_sec: int = 900,
) -> str:
    if not settings.live_apis:
        return f"file://{Path(storage_path).resolve()}"
    raise NotImplementedError(
        "R2 signed-URL minting is deprecated per ADR-009."
    )
