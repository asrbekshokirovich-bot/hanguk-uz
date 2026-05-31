"""Back-translation QC.

Plan §P.5: ko → target → ko, then Levenshtein distance vs original.
Stored in `translations.back_trans_distance` and feeds confidence scoring.
"""

from __future__ import annotations


def levenshtein(a: str, b: str) -> int:
    """Pure-Python Levenshtein. Fine for typical guideline prose lengths
    (<2k chars) — we don't need rapidfuzz for Phase 0."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr[j] = min(
                curr[j - 1] + 1,        # insertion
                prev[j] + 1,            # deletion
                prev[j - 1] + cost,     # substitution
            )
        prev = curr
    return prev[-1]


def normalized_distance(original_ko: str, back_translated_ko: str) -> float:
    """0.0 = identical; 1.0 = totally diverged."""
    if not original_ko:
        return 0.0
    raw = levenshtein(original_ko, back_translated_ko)
    return min(1.0, raw / max(1, len(original_ko)))


def confidence_from_back_translation(
    *,
    llm_self_confidence: float,
    normalized_back_trans_distance: float,
) -> float:
    """Plan §P.5 formula:
        (1 - normalized_back_trans_distance) * llm_self_reported_confidence
    Clamped to [0, 1].
    """
    val = (1.0 - normalized_back_trans_distance) * llm_self_confidence
    return max(0.0, min(1.0, val))
