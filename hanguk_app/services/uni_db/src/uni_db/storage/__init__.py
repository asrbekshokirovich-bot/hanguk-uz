"""Blob storage facade.

Per ADR-009, the canonical backend is **Supabase Storage** (private
bucket `guideline-blobs`, accessed only via signed URLs from the
backend). The Phase 0 R2 stub is preserved as a config knob in case
ADR-009 is reversed, but R2 is not the default.

Public API:

    store_blob(payload, *, sha256, mime=None) -> StoredBlob
        Persist a blob. Idempotent: re-uploading the same sha256 is a
        no-op that returns the existing path.

    create_signed_url(storage_path, *, expires_in_sec=900) -> str
        Mint a 15-minute signed URL for a blob (default — ADR-009).

    backend_name() -> str
        Returns the active backend name for telemetry.
"""

from .common import StoredBlob, backend_name, create_signed_url, store_blob

__all__ = ["StoredBlob", "backend_name", "create_signed_url", "store_blob"]
