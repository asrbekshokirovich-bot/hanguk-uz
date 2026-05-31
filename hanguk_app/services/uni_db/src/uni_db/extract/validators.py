"""Per-difficulty validation rules (plan §F.4).

Auto-publish gates:
  Difficulty 1–2: confidence ≥ 0.85
  Difficulty 3:   confidence ≥ 0.90 AND no field disagreement vs prior version
  Difficulty 4–5: ALWAYS HITL

The mapping below comes from audit §5.3.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DifficultyTier = Literal[1, 2, 3, 4, 5]


# ---------------------------------------------------------------------------
# Field → difficulty mapping (audit §5.3, abridged to the fields we extract).
# When extending, keep this in sync with the §C tables and the prompts.
# ---------------------------------------------------------------------------
FIELD_DIFFICULTY: dict[str, DifficultyTier] = {
    # Difficulty 1
    "institution_name_ko": 1,
    "institution_name_en": 1,
    "cycle":               1,
    "round":               1,
    "application_open_at": 1,
    "application_close_at":1,
    "final_results_at":    1,
    "registration_open_at":1,
    "registration_close_at":1,
    "tuition_currency":    1,
    "application_fee":     1,
    "medical_insurance_required": 1,
    # Difficulty 2
    "applicant_category":  2,
    "document_submission_deadline": 2,
    "first_stage_results_at": 2,
    "registration_withdrawal_window": 2,
    "quota_in_or_out_of_quota": 2,
    "admission_fee":       2,
    "attached_files":      2,
    "dormitory_available": 2,
    # Difficulty 3
    "interview_dates":     3,
    "practical_exam_dates":3,
    "additional_admit_results_at": 3,
    "quota":               3,
    "tuition_per_semester":3,
    "topik_required_level":3,
    "english_test_required":3,
    "interview_required":  3,
    "apostille_required":  3,
    # Difficulty 4
    "recruitment_unit":    4,
    "gpa_floor":           4,
    "documents_required":  4,
    "scholarships":        4,
    # Difficulty 5
    "scholarship_topik_tier_table": 5,
    "late_application_window":      5,
    "correction_notice_url":        5,
}


@dataclass(frozen=True, slots=True)
class ValidationVerdict:
    auto_publish: bool
    requires_hitl: bool
    rationale: str


def evaluate(
    *,
    field_name: str,
    confidence: float,
    has_prior_version: bool = False,
    fields_disagree_with_prior: bool = False,
) -> ValidationVerdict:
    diff = FIELD_DIFFICULTY.get(field_name)
    if diff is None:
        # Unknown fields default to Difficulty 3 (safer than ≤2).
        diff = 3

    if diff <= 2:
        if confidence >= 0.85:
            return ValidationVerdict(True, False, f"D{diff} auto-publish (conf {confidence:.2f})")
        return ValidationVerdict(
            False, True, f"D{diff} confidence {confidence:.2f} < 0.85 → HITL"
        )

    if diff == 3:
        if confidence >= 0.90 and not (has_prior_version and fields_disagree_with_prior):
            return ValidationVerdict(True, False, "D3 auto-publish (no diff vs prior)")
        return ValidationVerdict(
            False,
            True,
            "D3 needs HITL — confidence < 0.90 or diverged from prior version",
        )

    # D4 / D5
    return ValidationVerdict(False, True, f"D{diff} ALWAYS HITL")
