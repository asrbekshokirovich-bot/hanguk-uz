"""Storage facade tests (ADR-009).

Live upload paths are gated behind UNI_DB_LIVE_APIS=false (the test
default), so every test exercises the local-cache shim. Backend
selection logic is tested via monkey-patching `settings.blob_storage_backend`.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from uni_db import storage
from uni_db.storage import common as storage_common
from uni_db.storage import supabase_storage


class TestBackendName:
    def test_default_is_supabase_storage(self) -> None:
        assert storage.backend_name() == "supabase_storage"

    def test_picks_up_env_override(self, monkeypatch) -> None:
        monkeypatch.setattr(
            storage_common.settings, "blob_storage_backend", "r2", raising=False
        )
        assert storage.backend_name() == "r2"


class TestStoreBlobLocalFallback:
    def test_supabase_backend_falls_back_to_local_cache_in_test_mode(
        self, tmp_path: Path, monkeypatch
    ) -> None:
        # conftest already pins UNI_DB_LIVE_APIS=false, so the
        # supabase_storage adapter must fall back to local-cache.
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            storage_common.settings,
            "blob_storage_backend",
            "supabase_storage",
            raising=False,
        )

        payload = b"%PDF-1.7 fake fixture"
        sha = hashlib.sha256(payload).hexdigest()

        result = storage.store_blob(payload, sha256=sha, mime="application/pdf")

        assert result.backend == "local-cache"
        assert result.bytes_written == len(payload)
        assert sha in result.storage_path
        # The cached file should actually exist on disk
        assert Path(result.storage_path).read_bytes() == payload


class TestPathConvention:
    def test_two_level_fanout_keyed_on_sha256(self) -> None:
        path = supabase_storage._path_for(
            "abcdef1234567890" * 4,            # 64 hex chars
            mime="application/pdf",
        )
        # Expect: sha256/<aa>/<sha256>.pdf
        assert path.startswith("sha256/ab/")
        assert path.endswith(".pdf")

    def test_extension_inferred_from_mime(self) -> None:
        sha = "0" * 64
        assert supabase_storage._path_for(sha, mime="application/pdf").endswith(".pdf")
        assert supabase_storage._path_for(sha, mime="application/x-hwp").endswith(".hwp")
        assert supabase_storage._path_for(sha, mime=None).endswith(".bin")
        assert supabase_storage._path_for(sha, mime="text/html").endswith(".html")


class TestSignedUrlSafe:
    def test_signed_url_returns_file_uri_in_test_mode(self) -> None:
        # Live APIs off → file:// URI for the local cache; never reaches
        # Supabase. Real signed-URL minting is exercised in integration
        # tests against a live project, not in unit tests.
        url = storage.create_signed_url("foo/bar.pdf", expires_in_sec=300)
        assert url.startswith("file://")


class TestDeprecatedR2Backend:
    def test_r2_falls_back_to_local_cache_in_test_mode(
        self, tmp_path: Path, monkeypatch
    ) -> None:
        monkeypatch.chdir(tmp_path)
        monkeypatch.setattr(
            storage_common.settings, "blob_storage_backend", "r2", raising=False
        )
        result = storage.store_blob(b"x", sha256="0" * 64)
        # Local-cache backend, not r2 — because live_apis=False
        assert result.backend == "local-cache"

    def test_r2_live_path_raises_with_adr_pointer(self, monkeypatch) -> None:
        monkeypatch.setattr(
            storage_common.settings, "blob_storage_backend", "r2", raising=False
        )
        monkeypatch.setattr(
            storage_common.settings, "live_apis", True, raising=False
        )
        from uni_db.storage import r2 as r2_backend

        with pytest.raises(NotImplementedError, match="ADR-009"):
            r2_backend.store_blob(b"x", sha256="0" * 64)
