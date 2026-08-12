# tuition field-group extraction prompt (production)

Audit §4.4. One row per `(faculty as printed, academic_year, semester_number)`.
Strict JSON schema = [`TUITION_SCHEMA`](../schemas.py).

## The faculty is a name, not a bucket

`faculty_ko` is the identity of a row. Copy the faculty **exactly as the
document prints it** — Korean, English, or a mix of the two. Do not
translate it, do not normalise it, do not shorten it, do not merge two
printed labels into one.

```
공학·예능                      →  faculty_ko: "공학·예능"
세종 자연계열/미술계열           →  faculty_ko: "세종 자연계열/미술계열"
Cultural & Technology 융합대학   →  faculty_ko: "Cultural & Technology 융합대학"
글로벌Hospitality경영전공        →  faculty_ko: "글로벌Hospitality경영전공"
```

`faculty_group` is a **filter, not the answer**. Set it only when the line
clearly belongs to exactly one bucket:

`humanities | social | natural_science | engineering | arts_pe | medicine |
 dentistry | veterinary | pharmacy | theology | interdisciplinary`

Leave it `null` whenever:

- the line covers more than one bucket — `공학·예능` is engineering AND
  arts, so neither is correct on its own;
- the label is a campus or admission grouping rather than a faculty —
  `구분없음`, `일반대학원 석사`;
- you are not confident.

**A null bucket is a correct answer. A guessed bucket is not.** A reviewer
can add the bucket later from the name; nobody can recover the name from a
wrong bucket.

Emit **one row per printed line**. Never split a line into two rows to make
its faculties fit separate buckets — that makes one fee look like two.

## Strict rules

- Amounts are stored as integer KRW. Strip `원`, commas, and any unit
  suffix (만 / 백 / 천 / 억). The parse_worker normalises via
  `parse.numbers_ko` before calling you, but if the source slice still
  contains compound forms (`4억 8000만원`), keep `source_text_ko` as the
  verbatim Korean.
- `source_text_ko` is the verbatim line the amount came from. The review UI
  shows it under every row, so a human can check the number against the PDF.
- `faculty_uz` is an optional Uzbek rendering for the review UI. It never
  replaces `faculty_ko`; leave it `null` rather than guess a translation.
- `is_first_semester=true` only for the row that includes 입학금.
- If the document references a separate tuition booklet (typical for
  archetype A), return `{"rows": []}` — the calling worker enqueues a
  HITL task with reason='cross_referenced_doc'.
- Set `is_correction_notice=true` on all rows when the source bears
  정정공고 / 변경공고 / 등록금 변경 markers.

## Few-shot 1 — clean single-bucket lines

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
    {"faculty_ko":"인문계열","faculty_group":"humanities","academic_year":2026,
     "semester_number":1,"amount_krw":4800000,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"- 인문계열: 4,800,000원",
     "extractor_confidence":0.92},
    {"faculty_ko":"자연계열","faculty_group":"natural_science","academic_year":2026,
     "semester_number":1,"amount_krw":5460000,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"- 자연계열: 5,460,000원",
     "extractor_confidence":0.92},
    {"faculty_ko":"공학계열","faculty_group":"engineering","academic_year":2026,
     "semester_number":1,"amount_krw":6220000,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"- 공학계열: 6,220,000원",
     "extractor_confidence":0.92},
    {"faculty_ko":"예체능계열","faculty_group":"arts_pe","academic_year":2026,
     "semester_number":1,"amount_krw":7000000,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"- 예체능계열: 7,000,000원",
     "extractor_confidence":0.92}
  ]
}
```

## Few-shot 2 — mixed scripts and multi-faculty lines

These are the lines that used to come out wrong. Note that every
`faculty_ko` is verbatim, and every ambiguous bucket is `null`.

**Input**:

```
세종 인문계열 5,025,200원
세종 자연계열/미술계열 6,527,200원
공학·예능 4,043,000
Cultural & Technology 융합대학(디지털콘텐츠학부, 투어리즘&웰니스학부) — 첫 학기 등록금 5,360,000원
일반대학원 석사: 경영학과, 환경경영학과 4,255,000원
```

**Output**:

```json
{
  "rows": [
    {"faculty_ko":"세종 인문계열","faculty_group":"humanities","academic_year":2026,
     "semester_number":1,"amount_krw":5025200,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"세종 인문계열 5,025,200원",
     "extractor_confidence":0.9},

    {"faculty_ko":"세종 자연계열/미술계열","faculty_group":null,"academic_year":2026,
     "semester_number":1,"amount_krw":6527200,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"세종 자연계열/미술계열 6,527,200원",
     "extractor_confidence":0.88},

    {"faculty_ko":"공학·예능","faculty_group":null,"academic_year":2026,
     "semester_number":1,"amount_krw":4043000,"admission_fee_krw":null,
     "is_first_semester":true,"source_text_ko":"공학·예능 4,043,000",
     "extractor_confidence":0.85},

    {"faculty_ko":"Cultural & Technology 융합대학(디지털콘텐츠학부, 투어리즘&웰니스학부)",
     "faculty_group":"interdisciplinary","academic_year":2026,
     "semester_number":1,"amount_krw":5360000,"admission_fee_krw":null,
     "is_first_semester":true,
     "source_text_ko":"Cultural & Technology 융합대학(디지털콘텐츠학부, 투어리즘&웰니스학부) — 첫 학기 등록금 5,360,000원",
     "extractor_confidence":0.87},

    {"faculty_ko":"일반대학원 석사: 경영학과, 환경경영학과","faculty_group":null,
     "academic_year":2026,"semester_number":1,"amount_krw":4255000,
     "admission_fee_krw":null,"is_first_semester":true,
     "source_text_ko":"일반대학원 석사: 경영학과, 환경경영학과 4,255,000원",
     "extractor_confidence":0.8}
  ]
}
```

Why each `null` above: `자연계열/미술계열` is natural science **and** fine
art; `공학·예능` is engineering **and** arts; `일반대학원 석사` names a
graduate degree level, not one of the eleven undergraduate buckets. Guessing
any of them loses information the reviewer cannot get back.
