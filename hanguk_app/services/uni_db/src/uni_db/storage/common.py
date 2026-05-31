"""Shared storage facade — dispatches to the configured backend."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from ..config import settings

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class StoredBlob:
    """Result of a successful blob upload.

    `storage_path` is the *backend-internal* identifier:
      * supabase_storage: bucket-relative path, e.g.
        "guideline-blobs/sha256/ab/abcd...ef.pdf"
      * local-cache: filesystem path, e.g. ".cache/blobs/ab/abcd...ef"
      * r2: object key, e.g. "guideline-blobs/sha256/ab/abcd...ef"

    Callers persist `storage_path` in `guideline_documents.storage_path`,
    NOT a public URL. Signed URLs are minted on demand via
    `create_signed_url(storage_path)` (per ADR-009).
    """

    storage_path: str
    backend: str
    bytes_written: int


def backend_name() -> str:
    """Resolve the active backend per `settings.blob_storage_backend`."""
    return settings.blob_storage_backend or "local-cache"


def store_blob(
    payload: bytes,
    *,
    sha256: str,
    mime: str | None = None,
) -> StoredBlob:
    """Upload a blob via the configured backend."""
    backend = backend_name()

    if backend == "supabase_storage":
        from . import supabase_storage as supa
        return supa.store_blob(payload, sha256=sha256, mime=mime)

    if backend == "r2":
        from . import r2 as r2_backend
        return r2_backend.store_blob(payload, sha256=sha256, mime=mime)

    return _store_locally(payload, sha256=sha256)


def create_signed_url(
    storage_path: str,
    *,
    expires_in_sec: int = 900,
) -> str:
    """Mint a time-limited signed URL for blob retrieval.

    Default 900 s = 15 min, per ADR-009.
    """
    backend = backend_name()

    if backend == "supabase_storage":
        from . import supabase_storage as supa
        return supa.create_signed_url(storage_path, expires_in_sec=expires_in_sec)

    if backend == "r2":
        from . import r2 as r2_backend
        return r2_backend.create_signed_url(storage_path, expires_in_sec=expires_in_sec)

    return f"file://{Path(storage_path).resolve()}"


# ---------------------------------------------------------------------------
# Local-cache fallback (kept from Phase 0 — used when no backend is
# configured, e.g. running unit tests in the venv).
# ---------------------------------------------------------------------------


def _store_locally(payload: bytes, *, sha256: str) -> StoredBlob:
    cache_dir = Path(".cache/blobs") / sha256[:2]
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / sha256
    out.write_bytes(payload)
    log.info("blob cached locally sha=%s bytes=%d", sha256, len(payload))
    return StoredBlob(
        storage_path=str(out),
        backend="local-cache",
        bytes_written=len(payload),
    )
