"""Supabase Storage backend for blob persistence (ADR-009).

The bucket `guideline-blobs` is private and service-role-only. Callers
upload via service-role auth; readers receive 15-minute signed URLs via
`create_signed_url()`. Bucket creation lives in
`supabase/migrations/20260606000000_uni_db_v2_storage_bucket.sql`.

Path convention:
    guideline-blobs/sha256/<aa>/<sha256>.<ext>

Two-level fan-out (`<aa>` = first two hex chars of the sha256) keeps
listing fast at scale.

Phase 2 status:
  * Live upload path is gated by `settings.live_apis`. Off → falls
    back to the local-cache shim used in Phase 0/1.
  * Supabase Python client (`supabase-py` >= 2.7) is already in the
    dependency tree (`supabase>=2.7` in pyproject.toml).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..config import settings
from .common import StoredBlob, _store_locally

log = logging.getLogger(__name__)

BUCKET = "guideline-blobs"
DEFAULT_SIGNED_URL_TTL_SEC = 900   # 15 minutes per ADR-009


@lru_cache(maxsize=1)
def _client() -> Any:
    """Return a Supabase client authenticated with the service-role key.

    Cached so the same TCP/TLS connection pool is reused for the worker
    lifetime. Lazy-imported so unit tests can run without supabase-py
    being installed.
    """
    if not (settings.supabase_url and settings.supabase_service_role_key):
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for "
            "supabase_storage backend (ADR-009). Set them in services/"
            "uni_db/.env or set UNI_DB_BLOB_STORAGE=local-cache for "
            "tests."
        )

    from supabase import create_client  # type: ignore[import-not-found]

    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


def _path_for(sha256: str, mime: str | None) -> str:
    ext = _ext_for(mime)
    return f"sha256/{sha256[:2]}/{sha256}{ext}"


def _ext_for(mime: str | None) -> str:
    return {
        "application/pdf": ".pdf",
        "application/x-hwp": ".hwp",
        "application/x-hwpx": ".hwpx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "text/html": ".html",
    }.get((mime or "").lower(), ".bin")


def store_blob(
    payload: bytes,
    *,
    sha256: str,
    mime: str | None = None,
) -> StoredBlob:
    """Upload to Supabase Storage. Idempotent on `sha256`.

    Returns the bucket-internal path. Caller persists path in
    `guideline_documents.storage_path` — NEVER a URL (per ADR-009).
    """
    if not settings.live_apis:
        log.info(
            "supabase_storage: UNI_DB_LIVE_APIS=false; falling back to "
            "local-cache (sha=%s)",
            sha256,
        )
        return _store_locally(payload, sha256=sha256)

    path = _path_for(sha256, mime)
    client = _client()
    storage = client.storage.from_(BUCKET)

    # Upload with `upsert=true` so re-running on the same sha256 is a
    # no-op. content-type is set so signed URLs serve with the right MIME.
    storage.upload(
        path=path,
        file=payload,
        file_options={
            "content-type": mime or "application/octet-stream",
            "upsert": "true",
            "cache-control": "max-age=2592000",   # 30 days; sha256 is immutable
        },
    )
    log.info(
        "supabase_storage: uploaded sha=%s bytes=%d path=%s",
        sha256,
        len(payload),
        path,
    )

    return StoredBlob(
        storage_path=path,
        backend="supabase_storage",
        bytes_written=len(payload),
    )


def create_signed_url(
    storage_path: str,
    *,
    expires_in_sec: int = DEFAULT_SIGNED_URL_TTL_SEC,
) -> str:
    """Mint a 15-minute signed URL pointing to the blob (ADR-009)."""
    if not settings.live_apis:
        # Local-cache shim — return a file:// URL pointing at the
        # filesystem copy, useful for dev / fixtures.
        return f"file://{Path(storage_path).resolve()}"

    client = _client()
    storage = client.storage.from_(BUCKET)
    response = storage.create_signed_url(
        path=storage_path,
        expires_in=expires_in_sec,
    )
    # supabase-py returns dict with 'signedURL' (camelCase per JS sdk).
    signed = response.get("signedURL") or response.get("signed_url") or ""
    if not signed:
        raise RuntimeError(
            f"Supabase signed_url response missing URL: {response!r}"
        )
    return signed


def fetch_blob(storage_path: str) -> bytes:
    """Download a stored blob's bytes by its bucket-internal path.

    Used by the re-parse worker to re-extract an already-downloaded PDF
    without re-fetching it from the (possibly unreachable) source site. In
    local-cache mode it reads the filesystem copy.
    """
    if not settings.live_apis:
        return Path(storage_path).read_bytes()
    client = _client()
    return client.storage.from_(BUCKET).download(storage_path)

