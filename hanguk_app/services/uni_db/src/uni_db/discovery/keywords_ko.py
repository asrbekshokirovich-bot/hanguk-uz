"""Korean keyword vocabulary for admission-relevant content classification.

Sources:
  - Audit §6.3 (Korean signal terms)
  - Plan §P.1 (Korean-first principle)
  - Audit §6.6 (classifier hard rules)

Used by:
  - discovery/classifier.py — title and attachment-filename matching
  - extraction/archetype/* — header detection
  - translate/glossary.py — term-glossary lookup primer
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Primary admission vocabulary — the 16 anchor terms from audit §6.3.
# A post matching any of these is a strong admission signal.
# ---------------------------------------------------------------------------
PRIMARY_KEYWORDS_KO: tuple[str, ...] = (
    "모집요강",       # admission guidelines
    "수시모집",       # early admission cycle (susi)
    "정시모집",       # regular admission cycle (jeongsi)
    "외국인전형",     # foreign-applicant track
    "외국인특별전형", # foreign special admission (no-space)
    "외국인 특별전형",# foreign special admission (with space variant)
    "재외국민",       # overseas Korean
    "재외국민특별전형",
    "편입학",         # transfer
    "신·편입학",      # new + transfer
    "대학원 모집",    # graduate recruitment
    "정정공고",       # CORRECTION NOTICE — highest priority
    "변경공고",       # amendment notice
    "일정변경",       # schedule change
    "추가모집",       # additional recruitment
    "충원합격",       # waitlist replacement
    "합격자발표",     # results announcement
    "원서접수",       # application receipt
)

# ---------------------------------------------------------------------------
# Critical correction-notice tokens — detected separately because a title
# diff acquiring any of these forces priority=1 in review_queue
# (audit §6.5, plan §F.6). Tightened to only the canonical markers — bare
# 정정/변경/수정 are too broad ("수정판" = revised edition is a regular
# update, not a correction notice).
# ---------------------------------------------------------------------------
CORRECTION_KEYWORDS_KO: tuple[str, ...] = (
    "정정공고",
    "변경공고",
    "일정변경",
)

# ---------------------------------------------------------------------------
# English equivalents on bilingual sites — kept for filename heuristics
# only. Per §P-1 we never crawl /eng/ pages, but English-named PDF files
# like `2026-Spring-Foreign-Applicants.pdf` show up on KO boards.
# ---------------------------------------------------------------------------
PRIMARY_KEYWORDS_EN: tuple[str, ...] = (
    "admission guide",
    "admission guidelines",
    "international student admission",
    "foreign applicant",
    "special admission",
    "overseas korean",
    "transfer admission",
    "application period",
    "online application",
    "recruitment",
    "notice of correction",
    "result announcement",
    "successful applicants",
)

# ---------------------------------------------------------------------------
# File-extension allowlist for "this is the actual guideline document".
# Audit §5.1: 95% PDF, some HWP/HWPX. Ignore everything else.
# ---------------------------------------------------------------------------
GUIDELINE_FILE_EXTENSIONS: frozenset[str] = frozenset(
    {".pdf", ".hwp", ".hwpx", ".docx"}
)

# ---------------------------------------------------------------------------
# Domain allowlist — discovery never ingests Naver Cafe / blog mirrors.
# ---------------------------------------------------------------------------
ALLOWED_DOMAIN_SUFFIXES: tuple[str, ...] = (".ac.kr", ".go.kr")

# Korean universities that use non-standard TLDs as their primary domain.
# SKKU runs admission boards on `.edu` not `.ac.kr`. Curated whitelist —
# do NOT generalize, this is an exception list, not a default.
EXTRA_ALLOWED_HOSTS: frozenset[str] = frozenset({
    "admission.skku.edu",
    "skku.edu",
})

# ---------------------------------------------------------------------------
# URL path segments that mark a page as English-side and out-of-scope (§P-1).
# ---------------------------------------------------------------------------
ENGLISH_PATH_SEGMENTS: tuple[str, ...] = ("/eng/", "/en/", "/english/")


def matches_admission_signal(title: str, attachments_filenames: list[str]) -> bool:
    """Audit §6.6 hard rules. Returns True when ANY of:

      (a) at least one attachment filename ends with a guideline extension
          AND the title carries at least one PRIMARY_KEYWORDS_KO/EN anchor,
      (b) at least one attachment filename CONTAINS a PRIMARY_KEYWORDS_KO
          token (e.g. `2026 모집요강.hwp`), regardless of title,
      (c) attachment metadata is unavailable (empty list — typical for
          board-listing rows or search-result hits) AND the title carries
          ≥ 2 PRIMARY_KEYWORDS_KO/EN anchors OR a correction-notice
          keyword. Layer 3 (embedding similarity) + Layer 4 (LLM
          tiebreaker) downstream still apply.
    """
    title_l = title.lower()
    ko_hits = sum(1 for kw in PRIMARY_KEYWORDS_KO if kw in title)
    en_hits = sum(1 for kw in PRIMARY_KEYWORDS_EN if kw in title_l)
    title_anchor_count = ko_hits + en_hits
    has_correction_marker = is_correction_notice(title)

    # (b) attachment-filename keyword wins regardless of title.
    for fname in attachments_filenames:
        if any(kw in fname for kw in PRIMARY_KEYWORDS_KO):
            return True

    # (a) attachment + title anchor.
    if title_anchor_count >= 1:
        for fname in attachments_filenames:
            fname_lower = fname.lower()
            if any(fname_lower.endswith(ext) for ext in GUIDELINE_FILE_EXTENSIONS):
                return True

    # (c) title-only — only when we have NO attachment metadata at all.
    if not attachments_filenames:
        if has_correction_marker:
            return True
        if title_anchor_count >= 2:
            return True

    return False


def is_correction_notice(title: str) -> bool:
    """Critical: priority-1 routing per audit §6.5."""
    return any(kw in title for kw in CORRECTION_KEYWORDS_KO)


def is_disallowed_url(url: str) -> bool:
    """Reject Naver/Daum mirrors, English subdomains, and English mirror
    paths (§P-1)."""
    url_l = url.lower()
    if any(seg in url_l for seg in ENGLISH_PATH_SEGMENTS):
        return True
    host = url_l.split("/")[2] if "//" in url_l else url_l
    if host in EXTRA_ALLOWED_HOSTS:
        return False
    if not any(host.endswith(suffix) for suffix in ALLOWED_DOMAIN_SUFFIXES):
        return True
    # Subdomain check — `en.snu.ac.kr` and `english.skku.ac.kr` are the
    # bilingual mirrors that audit §P-1 explicitly excludes.
    leftmost = host.split(".", 1)[0]
    if leftmost in {"en", "english"}:
        return True
    return False


# ---------------------------------------------------------------------------
# Applicant audience — who a guideline is actually FOR.
# ---------------------------------------------------------------------------
#
# 외국인 is a FOREIGN NATIONAL. 재외국민 is an overseas KOREAN national, and
# 새터민 / 북한이탈주민 are North Korean defectors — all three of the latter are
# Korean citizens applying under a domestic quota, on different requirements
# (no TOPIK floor, no apostilled foreign diploma, a different fee table) and
# often at a different price. An Uzbek student cannot apply on any of them, so
# a guideline written only for them is not merely lower-value: it is the wrong
# document, and publishing its figures would quote a student a price and a
# requirement set they can never be held to.
#
# Most universities publish one combined "재외국민과 외국인 특별전형 모집요강",
# which is correct — it contains 외국인 and so ranks as a foreign guide. Some
# publish the two separately, and it is the separate 재외국민 booklet that must
# never be picked in place of the 외국인 one.
_FOREIGN_AUDIENCE_RE = re.compile(r"외국인|유학생|국제학생|국제입학|international|foreign")
_KOREAN_CITIZEN_AUDIENCE_RE = re.compile(r"재외국민|새터민|북한이탈|탈북")

# Ordinal values, ascending = better. Named so a caller reading a sort key can
# see which end is preferred.
AUDIENCE_FOREIGN = 0
AUDIENCE_UNKNOWN = 1
AUDIENCE_KOREAN_CITIZEN = 2


def audience_rank(text: str) -> int:
    """Rank text (a title, a URL, or both) by who the guideline serves.

    Three values rather than a boolean, because "wrong audience" and "no
    signal" are not the same thing. Both proposers cap how many candidates
    they keep per university, so a 재외국민-only booklet that merely TIED with
    a genuine 외국인 guide could take its place in the cap and be the one a
    university was represented by — which is how Korea University's
    "2027학년도 재외국민(정원외2%)/새터민 모집요강" reached the review queue as
    if it were an international-student guide.

    Checked foreign-first so a combined booklet naming both audiences ranks as
    foreign, which is what it is.
    """
    if _FOREIGN_AUDIENCE_RE.search(text):
        return AUDIENCE_FOREIGN
    if _KOREAN_CITIZEN_AUDIENCE_RE.search(text):
        return AUDIENCE_KOREAN_CITIZEN
    return AUDIENCE_UNKNOWN
