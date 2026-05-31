"""Test the new REQUIREMENTS_SCHEMA against:
  1. The reconstructed Job #1 hallucination (should now REJECT cleanly)
  2. A clean multi-row response (should accept)
  3. An empty-case response (should accept — fixes Jobs #2 + #3)
  4. The mock output in _MOCK_OUTPUTS (should accept — proves mock is in sync)
"""

from __future__ import annotations

import json
import sys

import jsonschema

from uni_db.extract.llm_anthropic import _MOCK_OUTPUTS
from uni_db.extract.schemas import REQUIREMENTS_SCHEMA

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def case(label: str, payload: dict, *, expect_valid: bool) -> None:
    try:
        jsonschema.validate(instance=payload, schema=REQUIREMENTS_SCHEMA)
        ok = expect_valid
        verdict = "PASS (accepted)" if expect_valid else "FAIL (should have rejected)"
    except jsonschema.ValidationError as e:
        ok = not expect_valid
        msg = f"REJECT: {e.message[:160]}"
        verdict = f"PASS ({msg})" if not expect_valid else f"FAIL: {msg}"
    print(f"[{'PASS' if ok else 'FAIL'}] {label}")
    print(f"  verdict: {verdict}")
    print()


# Case 1 — Job #1 reconstructed: wrong-group fields at row level. Should REJECT.
case(
    "Job #1 reconstructed: wrong-group fields (document_type, institution, ...)",
    {
        "rows": [
            {
                "applicant_category": "외국인전형",
                "document_type": "모집요강",          # wrong-group field
                "is_correction_notice": False,
                "institution": "KAIST",               # wrong-group field
                "program_level": "undergraduate",     # wrong-group field
                "admission_cycles": [{"year": 2026}], # wrong-group field
                "source_text_ko": "...",
            }
        ]
    },
    expect_valid=False,
)

# Case 2 — clean single-row response. Should ACCEPT.
case(
    "clean single-row response",
    {
        "rows": [
            {
                "applicant_category": "외국인전형",
                "topik_min_level": 3,
                "topik_deferred": False,
                "english_test": {"toefl_ibt": 80, "ielts": 5.5, "deferred": False},
                "gpa_floor_pct": None,
                "interview_required": True,
                "practical_exam_required": False,
                "prose_ko": "...",
                "source_text_ko": "...",
                "extractor_confidence": 0.88,
            }
        ]
    },
    expect_valid=True,
)

# Case 3 — clean multi-row response (외국인 + 재외국민). Should ACCEPT.
case(
    "clean multi-row response (2 applicant categories)",
    {
        "rows": [
            {
                "applicant_category": "외국인전형",
                "topik_min_level": 4,
                "topik_deferred": False,
                "english_test": None,
                "gpa_floor_pct": None,
                "interview_required": False,
                "practical_exam_required": False,
                "prose_ko": "...",
                "source_text_ko": "...",
                "extractor_confidence": 0.91,
            },
            {
                "applicant_category": "재외국민전형",
                "topik_min_level": None,
                "topik_deferred": False,
                "english_test": None,
                "gpa_floor_pct": None,
                "interview_required": True,
                "practical_exam_required": False,
                "prose_ko": "...",
                "source_text_ko": "...",
                "extractor_confidence": 0.86,
            },
        ]
    },
    expect_valid=True,
)

# Case 4 — empty case (the old schema bug). Should ACCEPT.
case(
    "empty case: {rows: []} (Job #2 + #3 fix)",
    {"rows": []},
    expect_valid=True,
)

# Case 5 — mock output sync check.
case(
    "_MOCK_OUTPUTS['requirements'] matches new shape",
    _MOCK_OUTPUTS["requirements"],
    expect_valid=True,
)

# Case 6 — invented english_test field (defense-in-depth).
case(
    "invented english_test sub-field (toefl_garbage)",
    {
        "rows": [
            {
                "applicant_category": "외국인전형",
                "english_test": {"toefl_garbage": 999},  # not in closed list
                "source_text_ko": "...",
            }
        ]
    },
    expect_valid=False,
)

# Case 7 — root-level meta still allowed (additionalProperties True at root).
case(
    "root-level meta field is_correction_notice (allowed at root)",
    {
        "is_correction_notice": True,
        "correction_text_ko": "정정공고: TOPIK 요건 변경",
        "rows": [
            {
                "applicant_category": "외국인전형",
                "topik_min_level": 4,
                "source_text_ko": "...",
            }
        ],
    },
    expect_valid=True,
)

print(f"\nMOCK_OUTPUTS['requirements'] full payload:")
print(json.dumps(_MOCK_OUTPUTS["requirements"], ensure_ascii=False, indent=2))
