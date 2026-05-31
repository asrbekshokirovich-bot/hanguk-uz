# Archetype D — Faith-affiliated / mid-private calibration

Audit §5.2: 20–50 pages, mission-statement page early, narrative prose
more frequent than competitors, scholarship tables emphasise religious-
merit awards alongside academic, quotas often less granular (sometimes
collapse to 단과대학 level only).

## Calibration notes

- The mission/chaplaincy page is NOT a recruitment-units source —
  ignore it.
- Scholarship rows often carry religious-eligibility predicates
  (예: 기독교인, 신학과 우대). Encode them in
  `eligibility_predicate.religion` when present, but ALWAYS keep the
  prose verbatim — counselors flag this for HITL.
- Some D-archetype docs (Sogang, Dongguk) split spring/fall in the same
  document. Emit ONLY the events for the cycle the parse_worker is
  targeting; the worker passes the cycle context in `source_text_ko`.

## Worked examples

### Example D-1 — Sogang religious-merit scholarship

Source span (verbatim from Sogang 2026 외국인전형 PDF, scholarship section):

> 예수회 추천장학금 — 등록금 50% 면제 — 가톨릭 신자로서 본당 사제의
> 추천을 받은 자 — 매년 갱신, GPA 3.0/4.5 이상 유지 시

Expected `scholarships` row:

```json
{
  "scope": "university",
  "name_ko": "예수회 추천장학금",
  "name_en": null,
  "award_type": "tuition_waiver_pct",
  "award_value": 50,
  "applicant_categories": ["외국인전형", "재외국민특별전형"],
  "eligibility_predicate": {
    "religion": "catholic",
    "letter_of_recommendation_required": true,
    "renewal_gpa_min": 3.0,
    "renewal_gpa_scale": 4.5
  },
  "prose_ko": "예수회 추천장학금 — 등록금 50% 면제 — 가톨릭 신자로서 본당 사제의 추천을 받은 자 — 매년 갱신, GPA 3.0/4.5 이상 유지 시",
  "source_text_ko": "예수회 추천장학금 — 등록금 50% 면제 — 가톨릭 신자로서 본당 사제의 추천을 받은 자 — 매년 갱신, GPA 3.0/4.5 이상 유지 시",
  "extractor_confidence": 0.74
}
```

Why 0.74: religious-eligibility is sensitive (HITL must verify the
Korean → English mapping is right; "가톨릭" → "catholic" is fine but
the renewal predicate may reference cultural context the model
mishandles). D-archetype scholarships ALWAYS need HITL.

### Example D-2 — Dongguk spring/fall combined doc

Source span (verbatim — Dongguk's combined doc has both cycles):

> 2026학년도 신입학 — 봄학기 (3월 입학): 원서접수 2025.10.20 ~ 11.10
>                       — 가을학기 (9월 입학): 원서접수 2026.04.15 ~ 05.05

Parse worker context: `current_cycle='fall'` for this run.

Expected `cycle_dates` rows (only fall events emitted):

```json
{
  "events": [
    {
      "event_type": "apply_open",
      "starts_at": "2026-04-15T00:00:00+09:00",
      "is_tentative": false,
      "notes_ko": "가을학기 (9월 입학) 원서접수 시작",
      "source_text_ko": "가을학기 (9월 입학): 원서접수 2026.04.15",
      "extractor_confidence": 0.96
    },
    {
      "event_type": "apply_close",
      "starts_at": "2026-05-05T17:00:00+09:00",
      "is_tentative": true,
      "notes_ko": "가을학기 마감 (시각 미명시 — 17:00 KST 추정)",
      "source_text_ko": "가을학기 (9월 입학): 원서접수 ~ 05.05",
      "extractor_confidence": 0.85
    }
  ]
}
```

Spring rows are SUPPRESSED for this run. Counselors get the spring
cycle in a separate run with `current_cycle='spring'`.
