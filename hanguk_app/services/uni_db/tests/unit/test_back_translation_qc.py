"""Plan §P.5 confidence formula."""

from uni_db.translate.back_translation_qc import (
    confidence_from_back_translation,
    levenshtein,
    normalized_distance,
)


def test_levenshtein_identical() -> None:
    assert levenshtein("hello", "hello") == 0


def test_levenshtein_substitution() -> None:
    assert levenshtein("kitten", "sitting") == 3


def test_normalized_distance_zero_when_identical() -> None:
    assert normalized_distance("외국인전형", "외국인전형") == 0.0


def test_normalized_distance_one_when_unrelated() -> None:
    d = normalized_distance("외국인전형", "completely-different-string")
    assert 0.5 < d <= 1.0


def test_confidence_drops_with_drift() -> None:
    pristine = confidence_from_back_translation(
        llm_self_confidence=0.9,
        normalized_back_trans_distance=0.0,
    )
    drifted = confidence_from_back_translation(
        llm_self_confidence=0.9,
        normalized_back_trans_distance=0.5,
    )
    assert pristine > drifted
