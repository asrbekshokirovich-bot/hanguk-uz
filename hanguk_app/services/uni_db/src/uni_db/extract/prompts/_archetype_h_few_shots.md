# Archetype H — 전문대 minimal calibration

Audit §5.2: 8–20 pages, plain layout (sometimes Word-document export),
quotas per 학과, calendar single table, scholarships often a single-
line sentence ("국가장학금 신청 대상"), 외국인전형 chapter sometimes
1–2 pages within a larger guide.

## Calibration notes

- The 외국인전형 section can be ≤ 2 pages — extract every dated row
  even if `extractor_confidence` ends up modest.
- 전문대 (associate-degree) is usually 2년제 or 3년제. Encode the
  duration in `programs.duration_years` (set 2.0 / 3.0 as appropriate).
- Scholarships often reduce to "국가장학금 안내" — encode as
  `scope=national, name_ko=국가장학금, award_type=other` with prose
  preserved.
- Documents are minimal (5–8 items). Don't pad.

## Worked examples

### Example H-1 — Inha Tech 2년제 program duration

Source span (verbatim from Inha Tech 2026 외국인전형 announcement):

> 기계과 — 2년제 — 정원외 8명 / 전기과 — 2년제 — 정원외 5명

Expected `programs` rows:

```json
{
  "rows": [
    {
      "name_ko": "기계과",
      "degree_level": "associate",
      "duration_years": 2.0,
      "language_of_instruction": ["ko"],
      "source_text_ko": "기계과 — 2년제"
    },
    {
      "name_ko": "전기과",
      "degree_level": "associate",
      "duration_years": 2.0,
      "language_of_instruction": ["ko"],
      "source_text_ko": "전기과 — 2년제"
    }
  ]
}
```

And the matching `recruitment_units`:

```json
{
  "rows": [
    {
      "faculty_ko": "공학계열",
      "department_ko": "기계과",
      "faculty_group": "engineering",
      "quota": 8,
      "is_in_quota": false,
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "source_text_ko": "기계과 — 2년제 — 정원외 8명",
      "extractor_confidence": 0.93
    },
    {
      "faculty_ko": "공학계열",
      "department_ko": "전기과",
      "faculty_group": "engineering",
      "quota": 5,
      "is_in_quota": false,
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "source_text_ko": "전기과 — 2년제 — 정원외 5명",
      "extractor_confidence": 0.93
    }
  ]
}
```

### Example H-2 — Scholarship single-line

Source span (verbatim from any 전문대 H archetype PDF):

> 장학금: 국가장학금 신청 대상 (한국장학재단)

Expected `scholarships` row:

```json
{
  "rows": [
    {
      "scope": "national",
      "name_ko": "국가장학금",
      "name_en": "National Scholarship (Korea Student Aid Foundation)",
      "award_type": "other",
      "award_value": null,
      "applicant_categories": ["외국인전형"],
      "eligibility_predicate": {
        "administered_by": "kosaf",
        "external_application": true
      },
      "prose_ko": "국가장학금 신청 대상 (한국장학재단)",
      "source_text_ko": "장학금: 국가장학금 신청 대상 (한국장학재단)",
      "extractor_confidence": 0.95
    }
  ]
}
```

Single row covers it. Don't invent `award_value` numbers; KOSAF
amounts vary annually and are out-of-scope for the institution-level
record.
