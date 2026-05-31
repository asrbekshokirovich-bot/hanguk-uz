# Archetype G — STEM specialized calibration

Audit §5.2: 30–60 pages, English-first or English-only, qualitative
quotas (`약간명`, `소수정원`), scholarships heavily embedded, recruitment
unit list short (often a single college), application via custom portal
(univapply.kaist.ac.kr / interapply / apply.unist.ac.kr).

## Calibration notes

- Despite the English-first format, plan §P.1 still mandates KO source
  preservation. Locate the Korean version of every key line and emit
  it in `source_text_ko`. If only English exists, emit the English
  string in `source_text_ko` and flag `extractor_confidence -= 0.1`.
- Qualitative quotas: the schema accepts integer or string. Emit
  `"약간명"` / `"소수정원"` verbatim — DO NOT guess a number.
- Scholarship rows in archetype G are usually 100% tuition + monthly
  stipend bundled. Encode as two rows:
    `award_type=tuition_waiver_pct, award_value=100`
    `award_type=stipend_monthly, award_value=<KRW/month>`

## Worked examples

### Example G-1 — KAIST bundled scholarship (split into 2 rows)

Source span (verbatim from KAIST Spring 2026 admissions guideline):

> KAIST International Scholarship — Tuition: 100% waiver for 8 semesters
> / Living stipend: KRW 350,000 per month for 8 semesters / Eligible:
> all foreign degree-program admittees

Expected `scholarships` rows:

```json
{
  "rows": [
    {
      "scope": "university",
      "name_ko": "KAIST International Scholarship",
      "name_en": "KAIST International Scholarship",
      "award_type": "tuition_waiver_pct",
      "award_value": 100,
      "applicant_categories": ["외국인전형", "Foreign Applicant"],
      "eligibility_predicate": {
        "duration_semesters": 8,
        "scope": "all_foreign_degree_admittees"
      },
      "prose_ko": "전 외국인 학위과정 합격자 대상, 8학기 동안 등록금 100% 면제",
      "source_text_ko": "KAIST International Scholarship — Tuition: 100% waiver for 8 semesters",
      "extractor_confidence": 0.88
    },
    {
      "scope": "university",
      "name_ko": "KAIST International Scholarship — 생활비",
      "name_en": "KAIST International Scholarship — Living stipend",
      "award_type": "stipend_monthly",
      "award_value": 350000,
      "applicant_categories": ["외국인전형", "Foreign Applicant"],
      "eligibility_predicate": {
        "duration_semesters": 8,
        "scope": "all_foreign_degree_admittees"
      },
      "prose_ko": "전 외국인 학위과정 합격자 대상, 8학기 동안 월 350,000원 생활비 지급",
      "source_text_ko": "Living stipend: KRW 350,000 per month for 8 semesters",
      "extractor_confidence": 0.88
    }
  ]
}
```

Confidence 0.88 reflects the KO source-preservation penalty — the
original was English-only so `prose_ko` is a model translation.

### Example G-2 — Qualitative quota preserved verbatim

Source span (verbatim from UNIST Fall 2026 외국인전형):

> School of Energy and Chemical Engineering — Approximately a few /
> 약간명

Expected `recruitment_units` row:

```json
{
  "faculty_ko": "School of Energy and Chemical Engineering",
  "department_ko": "School of Energy and Chemical Engineering",
  "faculty_group": "engineering",
  "quota": "약간명",
  "is_in_quota": true,
  "applicant_category": "외국인전형",
  "is_correction_notice": false,
  "source_text_ko": "School of Energy and Chemical Engineering — Approximately a few / 약간명",
  "extractor_confidence": 0.82
}
```

DO NOT guess a number. UNIST/KAIST/POSTECH genuinely don't pre-commit
quota counts; the count emerges from selectivity. Counselors must see
"약간명" so they advise students realistically.
