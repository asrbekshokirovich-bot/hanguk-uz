"""Canonical-source lookup (Phase 4 sub-page crawl) — KO-only guard."""

from __future__ import annotations

from uni_db.discovery import canonical_sources as cs


def test_unknown_domain_returns_none() -> None:
    assert cs.canonical_source_for("nowhere.ac.kr", "scholarships") is None


def test_none_domain_safe() -> None:
    assert cs.canonical_source_for(None, "scholarships") is None


def test_english_url_is_rejected(monkeypatch) -> None:
    # Even if someone seeds an English mirror, the ground-rule guard drops it.
    monkeypatch.setitem(
        cs.CANONICAL_SOURCES, "x.ac.kr",
        {"scholarships": "https://admission.x.ac.kr/en/scholarships"},
    )
    assert cs.canonical_source_for("x.ac.kr", "scholarships") is None


def test_korean_url_passes(monkeypatch) -> None:
    monkeypatch.setitem(
        cs.CANONICAL_SOURCES, "x.ac.kr",
        {"scholarships": "https://admission.x.ac.kr/장학금"},
    )
    assert cs.canonical_source_for("x.ac.kr", "scholarships") == "https://admission.x.ac.kr/장학금"


def test_missing_field_group_returns_none(monkeypatch) -> None:
    monkeypatch.setitem(cs.CANONICAL_SOURCES, "x.ac.kr", {"scholarships": "https://x.ac.kr/장학"})
    assert cs.canonical_source_for("x.ac.kr", "tuition") is None
