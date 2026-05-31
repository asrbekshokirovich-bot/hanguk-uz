"""Canonical Korean source pages for depth extraction (Phase 4 — sub-page crawl).

Some high-value details — scholarship stipend amounts, GPA-maintenance rules,
semester caps, full track lists — live on a university's dedicated page, not
on the notice excerpt the crawler first reads (the KAIST 350,000 KRW stipend
is the canonical example). This maps an institution's `primary_domain` → the
canonical page per field group, so a depth pass can fetch + extract from the
right page instead of only the notice.

GROUND RULE (Korean-first): only Korean pages belong here. Every lookup is
screened by `is_disallowed_url` (rejects `/eng/` `/en/` `/english/` mirrors);
an English URL is treated as absent. The map is intentionally seeded empty —
canonical KO URLs are added once a live probe confirms the Korean surface
(the dev sandbox can't reach `*.ac.kr`), exactly like adapter onboarding.
Populate via the `uni-db-probe` workflow, then add the confirmed KO URL here.
"""

from __future__ import annotations

from .keywords_ko import is_disallowed_url

# primary_domain (lowercase) -> { field_group: canonical_KO_url }.
# Seed entries here ONLY after a probe confirms the Korean page. Example shape:
#   "kaist.ac.kr": {"scholarships": "https://admission.kaist.ac.kr/.../<KO>"}
CANONICAL_SOURCES: dict[str, dict[str, str]] = {}


def canonical_source_for(domain: str | None, field_group: str) -> str | None:
    """Return the canonical KO page for (institution domain, field group), or
    None when there's no entry — or the entry is an English mirror (ground
    rule: never fall back to an English page)."""
    entry = CANONICAL_SOURCES.get((domain or "").lower())
    if not entry:
        return None
    url = entry.get(field_group)
    if not url or is_disallowed_url(url):
        return None
    return url
