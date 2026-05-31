# Archetype E — Women's university calibration

Audit §5.2: 35–60 pages, eligibility section explicitly states gender
requirement (female applicants only), often two separate docs
(외국인특별전형 vs 재외국민특별전형), strong scholarship offerings often
in front matter, tuition sometimes routed to a separate file.

## Calibration notes

- The gender requirement MUST be captured. In `basic_requirements`
  output, encode it in `prose_ko` AND set the structured boolean
  `gender_required_female=true` (use a custom property — the schema
  permits any field with `additionalProperties: false` only at top
  level, so we route it through `notes_ko` if absent in schema).
  *Note*: Phase 1 schema doesn't carry gender; for now keep gender in
  `prose_ko` and the parse_worker's HITL gate flags it.
- Front-matter scholarships should NOT be skipped. Extract them even
  if they appear before the main 모집요강 body.

## Worked examples

### Example E-1 — Ewha gender requirement

Source span (verbatim from Ewha 2026 외국인특별전형 PDF):

> 지원자격 — 1. 학력: 외국에서 12년 이상 정규교육 과정을 이수한 자
> 또는 이에 준하는 자 / 2. 성별: **여성에 한함** / 3. TOPIK 4급 이상

Expected `basic_requirements` row:

```json
{
  "applicant_category": "외국인특별전형",
  "topik_min_level": 4,
  "topik_deferred": false,
  "english_test": null,
  "gpa_floor_pct": null,
  "interview_required": false,
  "practical_exam_required": false,
  "prose_ko": "1. 학력: 외국에서 12년 이상 정규교육 과정을 이수한 자 또는 이에 준하는 자. 2. 성별: 여성에 한함. 3. TOPIK 4급 이상.",
  "source_text_ko": "지원자격 — 1. 학력: 외국에서 12년 이상 정규교육 과정을 이수한 자 또는 이에 준하는 자 / 2. 성별: 여성에 한함 / 3. TOPIK 4급 이상",
  "extractor_confidence": 0.91
}
```

The gender requirement IS in `prose_ko` verbatim; HITL flags this
during review. Schema cannot carry it as a structured boolean yet;
that's a Phase 3 enhancement.

### Example E-2 — Sookmyung front-matter scholarship

Source span (verbatim from Sookmyung 2026 외국인전형 PDF, page 4 — front
matter, BEFORE the main 모집요강 body):

> Sookmyung Foreign Student Scholarship — 신입생 등록금 100% 면제,
> 매학기 갱신 (직전학기 GPA 3.5/4.5 이상 시), TOPIK 5급 이상 대상

Expected `scholarships` row (DO NOT skip the row just because it's in
front matter):

```json
{
  "scope": "university",
  "name_ko": "Sookmyung Foreign Student Scholarship",
  "name_en": "Sookmyung Foreign Student Scholarship",
  "award_type": "tuition_waiver_pct",
  "award_value": 100,
  "applicant_categories": ["외국인전형"],
  "topik_tier_table": {"5": 100, "6": 100},
  "eligibility_predicate": {
    "renewal_gpa_min": 3.5,
    "renewal_gpa_scale": 4.5,
    "topik_min": 5
  },
  "prose_ko": "신입생 등록금 100% 면제, 매학기 갱신 (직전학기 GPA 3.5/4.5 이상 시), TOPIK 5급 이상 대상",
  "source_text_ko": "Sookmyung Foreign Student Scholarship — 신입생 등록금 100% 면제, 매학기 갱신 (직전학기 GPA 3.5/4.5 이상 시), TOPIK 5급 이상 대상",
  "extractor_confidence": 0.88
}
```
