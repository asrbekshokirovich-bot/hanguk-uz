# Archetype B — Top Seoul private brochure-style calibration

Audit §5.2: 50–80 pages, glossy first 5–8 pages, recruitment units
organised by 단과대학, calendar in a single tabular page near the front,
embedded tuition tables (faculty-grouped, sometimes with 1학기 vs 2학기
split), bilingual side-by-side but English often abridged.

## Calibration notes

- Skip the first 5–8 marketing pages. They contain "왜 본교를 선택했나"
  prose that should NOT be extracted as a requirement or a recruitment
  unit. The calendar / tuition / unit-list section starts after the
  marketing block.
- Faculty-group classification is straightforward (인문 / 사회 / 자연 /
  공학 / 예체능). Map per audit §4.4.
- 단과대학 → 학부 → 학과 hierarchy is fully populated. Always emit the
  parent 단과대학 in `faculty_ko`.
- 1학기 = `is_first_semester=true` and includes 입학금. The 2학기 row
  excludes it (the brochure usually says "(입학금 별도)" — check the
  footnote).

## Worked examples

### Example B-1 — Yonsei tuition with 1학기 vs 2학기 split

Source span (verbatim from the Yonsei 2026 fee PDF, College of Liberal
Arts row):

> 인문대학 / 신학대학: 4,770,000원 (1학기, 입학금 포함) / 4,556,000원
> (2학기, 입학금 별도)

Expected `tuition` rows (two rows, one per semester):

```json
{
  "rows": [
    {
      "faculty_group": "humanities",
      "academic_year": 2026,
      "semester_number": 1,
      "amount_krw": 4770000,
      "is_first_semester": true,
      "source_text_ko": "인문대학 / 신학대학: 4,770,000원 (1학기, 입학금 포함)",
      "extractor_confidence": 0.94
    },
    {
      "faculty_group": "humanities",
      "academic_year": 2026,
      "semester_number": 2,
      "amount_krw": 4556000,
      "is_first_semester": false,
      "source_text_ko": "4,556,000원 (2학기, 입학금 별도)",
      "extractor_confidence": 0.94
    }
  ]
}
```

### Example B-2 — Korea University 단과대학 hierarchy

Source span (verbatim from KU recruitment-unit table):

> 자유전공학부 (자유전공) — 약간명, 인문계열 자율 — 비고: 입학 후
> 2학년 진학 시 학과 결정 / 글로벌인재학부 — 30명 / 정원외

Expected `recruitment_units` rows:

```json
{
  "rows": [
    {
      "faculty_ko": "자유전공학부",
      "division_ko": "자유전공학부",
      "department_ko": "자유전공",
      "faculty_group": "interdisciplinary",
      "quota": "약간명",
      "is_in_quota": true,
      "notes_ko": "입학 후 2학년 진학 시 학과 결정. 인문계열 자율.",
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "source_text_ko": "자유전공학부 (자유전공) — 약간명, 인문계열 자율 — 비고: 입학 후 2학년 진학 시 학과 결정",
      "extractor_confidence": 0.86
    },
    {
      "faculty_ko": "글로벌인재학부",
      "division_ko": null,
      "department_ko": "글로벌인재학부",
      "faculty_group": "interdisciplinary",
      "quota": 30,
      "is_in_quota": false,
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "source_text_ko": "글로벌인재학부 — 30명 / 정원외",
      "extractor_confidence": 0.93
    }
  ]
}
```

Note: `is_in_quota=false` on the second row because "정원외" — preserve
that distinction; counselors filter on it.
