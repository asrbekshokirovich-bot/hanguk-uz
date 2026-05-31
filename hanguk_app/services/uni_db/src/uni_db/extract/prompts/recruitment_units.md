# recruitment_units field-group extraction prompt (production)

Audit §4.3 / §5.3 (parsing-difficulty 4). Strict JSON schema =
[`RECRUITMENT_UNITS_SCHEMA`](../schemas.py).

## Why this is hard

The 모집단위 hierarchy (단과대학 → 학부 → 학과 → 전공) is not
1:1 with `학과` records in `data.go.kr`. Some universities admit at
학부 level (broad division); some at 학과 level; some have free-major
admissions (자유전공학부) that admit without a major. **You must
preserve the document's own granularity** — don't normalise by
collapsing 학부 into 학과 or vice versa.

## Strict rules

- One row per `(faculty_ko, department_ko)` pair as it appears in the
  source. Department-level rows must keep their parent 단과대학.
- `faculty_group` is the audit §4.4 bucket. Prefer null when uncertain —
  the parse_worker maps it via `parse.sections.classify_faculty_group`
  but tagging it here helps tuition correlation.
- `quota` may be an integer (`30`), a Korean qualitative quota
  (`약간명`, `소수정원`), or null. Schema accepts integer or string.
- `is_in_quota` is true for 정원내, false for 정원외.
- 외국인전형 / 재외국민특별전형 footnotes — store category in
  `applicant_category`.
- `external_code` is the university-internal identifier when published
  (some egov systems print 모집단위코드 in the table).
- `notes_ko` preserves the entire 비고 column verbatim — this is
  difficulty-4 because exception handling lives there.

## Few-shot

**Input** (archetype C, regional national plain table):

```
[모집단위별 모집인원 — 외국인전형]
공과대학  | 컴퓨터공학과   | 30 | 정원내
공과대학  | 기계공학과     | 25 | 정원내
공과대학  | 산업공학과     | 약간명 | 정원외 ※ 2027학년도 신설
경영대학  | 경영학부       | 50 | 정원내
인문대학  | 영어영문학과   | 15 | 정원내 ※ TOPIK 4급 이상 권장
```

**Output**:

```json
{
  "rows": [
    {"faculty_ko":"공과대학","department_ko":"컴퓨터공학과",
     "faculty_group":"engineering","quota":30,"is_in_quota":true,
     "applicant_category":"외국인전형","is_correction_notice":false,
     "source_text_ko":"공과대학  | 컴퓨터공학과   | 30 | 정원내",
     "extractor_confidence":0.93},
    {"faculty_ko":"공과대학","department_ko":"기계공학과",
     "faculty_group":"engineering","quota":25,"is_in_quota":true,
     "applicant_category":"외국인전형","is_correction_notice":false,
     "source_text_ko":"공과대학  | 기계공학과     | 25 | 정원내",
     "extractor_confidence":0.93},
    {"faculty_ko":"공과대학","department_ko":"산업공학과",
     "faculty_group":"engineering","quota":"약간명","is_in_quota":false,
     "notes_ko":"2027학년도 신설","applicant_category":"외국인전형",
     "is_correction_notice":false,
     "source_text_ko":"공과대학  | 산업공학과     | 약간명 | 정원외 ※ 2027학년도 신설",
     "extractor_confidence":0.78},
    {"faculty_ko":"경영대학","department_ko":"경영학부",
     "faculty_group":"social","quota":50,"is_in_quota":true,
     "applicant_category":"외국인전형","is_correction_notice":false,
     "source_text_ko":"경영대학  | 경영학부       | 50 | 정원내",
     "extractor_confidence":0.91},
    {"faculty_ko":"인문대학","department_ko":"영어영문학과",
     "faculty_group":"humanities","quota":15,"is_in_quota":true,
     "notes_ko":"TOPIK 4급 이상 권장","applicant_category":"외국인전형",
     "is_correction_notice":false,
     "source_text_ko":"인문대학  | 영어영문학과   | 15 | 정원내 ※ TOPIK 4급 이상 권장",
     "extractor_confidence":0.88}
  ]
}
```
