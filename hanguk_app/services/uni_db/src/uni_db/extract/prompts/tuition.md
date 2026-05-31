# tuition field-group extraction prompt (production)

Audit §4.4. One row per `(faculty_group, academic_year, semester_number)`.
Strict JSON schema = [`TUITION_SCHEMA`](../schemas.py).

## Strict rules

- Amounts are stored as integer KRW. Strip `원`, commas, and any unit
  suffix (만 / 백 / 천 / 억). The parse_worker normalises via
  `parse.numbers_ko` before calling you, but if the source slice still
  contains compound forms (`4억 8000만원`), keep `source_text_ko` as the
  verbatim Korean.
- `faculty_group` MUST be one of the audit §4.4 buckets:
  `humanities | social | natural_science | engineering | arts_pe |
   medicine | dentistry | veterinary | pharmacy | theology |
   interdisciplinary`.
- `is_first_semester=true` only for the row that includes 입학금.
- If the document references a separate tuition booklet (typical for
  archetype A), return `{"rows": []}` — the calling worker enqueues a
  HITL task with reason='cross_referenced_doc'.
- Set `is_correction_notice=true` on all rows when the source bears
  정정공고 / 변경공고 / 등록금 변경 markers.

## Few-shot

**Input** (archetype B / Yonsei-style):

```
[등록금]
계열별 1학기 등록금 (입학금 포함)
- 인문계열: 4,800,000원
- 자연계열: 5,460,000원
- 공학계열: 6,220,000원
- 예체능계열: 7,000,000원
※ 2학기 등록금은 입학금을 제외한 금액입니다.
```

**Output**:

```json
{
  "rows": [
    {"faculty_group":"humanities","academic_year":2026,"semester_number":1,
     "amount_krw":4800000,"admission_fee_krw":null,"is_first_semester":true,
     "source_text_ko":"- 인문계열: 4,800,000원","extractor_confidence":0.92},
    {"faculty_group":"natural_science","academic_year":2026,"semester_number":1,
     "amount_krw":5460000,"admission_fee_krw":null,"is_first_semester":true,
     "source_text_ko":"- 자연계열: 5,460,000원","extractor_confidence":0.92},
    {"faculty_group":"engineering","academic_year":2026,"semester_number":1,
     "amount_krw":6220000,"admission_fee_krw":null,"is_first_semester":true,
     "source_text_ko":"- 공학계열: 6,220,000원","extractor_confidence":0.92},
    {"faculty_group":"arts_pe","academic_year":2026,"semester_number":1,
     "amount_krw":7000000,"admission_fee_krw":null,"is_first_semester":true,
     "source_text_ko":"- 예체능계열: 7,000,000원","extractor_confidence":0.92}
  ]
}
```
