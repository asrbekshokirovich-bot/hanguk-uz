"""Shared test fixtures."""

from __future__ import annotations

import pytest

from uzum_scraper.config import Config


@pytest.fixture
def config(tmp_path):
    """A fully-specified Config with no rate-limit delays and a dummy token."""
    return Config(
        auth_token="test-token",
        iid="test-iid",
        language="uz-UZ",
        min_delay=0.0,
        jitter=0.0,
        max_retries=1,
        timeout=5.0,
        output_dir=str(tmp_path / "out"),
    )
