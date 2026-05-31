# Archetype F — Specialized art/music/PE calibration

Audit §5.2: 40–80 pages, heavy 실기고사 (audition / practical exam)
emphasis with discipline-by-discipline pages (required pieces, recording
specs, evaluation rubrics), per-discipline quotas, per-discipline
tuition (vocal vs instrumental vs composition), calendar with multiple
discipline-specific exam dates.

## Calibration notes

- Audition specs are unstructured prose with technical terms (key
  signatures, etudes, etc.). Treat as free text → keep `prose_ko` and
  preserve `source_text_ko` verbatim. Do NOT try to schematise into
  structured rules.
- `practical_exam_required=true` for every recruitment unit in this
  archetype. The calendar emits multiple `practical_exam` events — one
  per discipline.
- Tuition is per-discipline (예: 성악 vs 작곡). The schema's
  `faculty_group=arts_pe` is fine for all, but preserve discipline in
  `recruitment_unit.major_track_ko` so counselors can drill in.

## Worked examples

### Example F-1 — KNUA per-discipline practical exam dates

Source span (verbatim from KNUA 2026 외국인전형 calendar table):

> 음악원 / 성악과 — 실기고사 2026.11.05(목) 10:00 KST / 본관 대공연장
> 음악원 / 작곡과 — 실기고사 2026.11.06(금) 14:00 KST / 본관 대공연장
> 미술원 / 회화과 — 실기고사 2026.11.07(토) 09:00 KST / 미술원 화실 1관

Expected `cycle_dates` rows (one per discipline; note the
`recruitment_unit_id` linkage):

```json
{
  "events": [
    {
      "event_type": "practical_exam",
      "starts_at": "2026-11-05T10:00:00+09:00",
      "notes_ko": "음악원 성악과 실기고사 (본관 대공연장)",
      "source_text_ko": "음악원 / 성악과 — 실기고사 2026.11.05(목) 10:00 KST / 본관 대공연장",
      "is_tentative": false,
      "extractor_confidence": 0.94
    },
    {
      "event_type": "practical_exam",
      "starts_at": "2026-11-06T14:00:00+09:00",
      "notes_ko": "음악원 작곡과 실기고사 (본관 대공연장)",
      "source_text_ko": "음악원 / 작곡과 — 실기고사 2026.11.06(금) 14:00 KST / 본관 대공연장",
      "is_tentative": false,
      "extractor_confidence": 0.94
    },
    {
      "event_type": "practical_exam",
      "starts_at": "2026-11-07T09:00:00+09:00",
      "notes_ko": "미술원 회화과 실기고사 (미술원 화실 1관)",
      "source_text_ko": "미술원 / 회화과 — 실기고사 2026.11.07(토) 09:00 KST / 미술원 화실 1관",
      "is_tentative": false,
      "extractor_confidence": 0.94
    }
  ]
}
```

The downstream parse worker links each event to the matching
`recruitment_unit_id` via the (faculty_ko, department_ko) tuple in
the same source slice.

### Example F-2 — Audition piece spec is FREE TEXT

Source span (verbatim — Korean National Sport Univ rhythmic gymnastics
실기 spec):

> 리듬체조 (여) — 자유종목 1분 ~ 1분 30초 / BGM은 응시생이 USB로 지참
> / 의상은 단정한 운동복 / 점수: 기술 60%, 표현력 40%

Do NOT schematise into separate fields. Keep verbatim:

```json
{
  "rows": [
    {
      "faculty_ko": "체육과학대학",
      "department_ko": "리듬체조학과",
      "major_track_ko": "리듬체조 (여)",
      "faculty_group": "arts_pe",
      "quota": null,
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "notes_ko": "자유종목 1분 ~ 1분 30초 / BGM은 응시생이 USB로 지참 / 의상은 단정한 운동복 / 점수: 기술 60%, 표현력 40%",
      "source_text_ko": "리듬체조 (여) — 자유종목 1분 ~ 1분 30초 / BGM은 응시생이 USB로 지참 / 의상은 단정한 운동복 / 점수: 기술 60%, 표현력 40%",
      "extractor_confidence": 0.78
    }
  ]
}
```

The audition spec stays in `notes_ko` as one verbatim string.
Counselors read it; we don't try to extract scoring weights or piece
durations as structured fields.
