# Archetype A — SNU flagship calibration

Audit §5.2: 80–120 pages, deep applicant-category sections, cross-
referenced tuition booklet, bilingual side-by-side columns, 부록 (appendix)
tables, voluminous 모집단위별 quotas with 정원외 / 정원내 split.

## Calibration notes

- The bilingual layout means the same calendar row often appears twice —
  once Korean, once English. **Trust the Korean row** (§P.1) and ignore
  the English copy. Set `source_text_ko` to the Korean version only.
- Tuition is published in a separate booklet. When the section says
  "별도 책자 참조", emit `{"rows": []}` and DO NOT hallucinate from the
  brochure summary lines.
- `applicant_category` granularity is high: 외국인전형 신입학,
  외국인전형 편입학, 글로벌인재특별전형, 재외국민특별전형. Match
  exactly.
- `quota` values are usually integers; SNU uses 정원외 markers heavily
  for arts/PE — preserve as `is_in_quota=false`.

## Worked examples

### Example A-1 — applicant_category disambiguation

Source span (verbatim Korean from a 16-college quota table):

> 외국인전형 신입학 — 자유전공학부: 약간명 / 정원외 / 자유전공으로
> 입학 후 2학년 진학 시 학과 결정

Expected `recruitment_units` row:

```json
{
  "faculty_ko": "자유전공학부",
  "department_ko": "자유전공학부",
  "faculty_group": "interdisciplinary",
  "quota": "약간명",
  "is_in_quota": false,
  "applicant_category": "외국인전형 신입학",
  "is_correction_notice": false,
  "notes_ko": "자유전공으로 입학 후 2학년 진학 시 학과 결정",
  "source_text_ko": "외국인전형 신입학 — 자유전공학부: 약간명 / 정원외 / 자유전공으로 입학 후 2학년 진학 시 학과 결정",
  "extractor_confidence": 0.83
}
```

Why 0.83: 약간명 is qualitative quota (D3 difficulty), HITL likely
needs to confirm "약간명" maps to a meaningful student count for this
year. Faculty group `interdisciplinary` matches audit §4.4.

### Example A-2 — cross-referenced tuition booklet

Source span (in the body of the SNU intl admissions PDF):

> 등록금: 별도 책자 「2026학년도 등록금 안내」 참조

Expected `tuition` group output:

```json
{ "rows": [] }
```

The parse worker also enqueues a HITL task with reason
`cross_referenced_doc` pointing the reviewer at the tuition booklet
URL. Do NOT attempt to extract tuition from the brochure summary
"학비는 약 350~400만원" — those are estimates, not authoritative.
