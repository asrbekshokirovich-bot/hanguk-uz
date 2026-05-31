# Archetype C — Regional national plain table calibration

Audit §5.2: 30–50 pages, function-over-form B&W layout, very long
recruitment-unit lists (80–150 units typical), calendar table with many
footnote layers (특정 전공 면접일, 도서관학과 추가 시험 등), embedded
per-faculty tuition table, KO-only common.

## Calibration notes

- Recruitment-unit tables can run for 5+ pages. The parse_worker runs
  `parse.tables.stitch_spans()` to merge them; you receive the stitched
  table as one block. Trust column 0 to be the 단과대학 / 학부 label.
- 정원외 / 정원내 split is critical for these schools — they often have
  large 정원외 outside-quota allocations for foreign applicants. Always
  set `is_in_quota` correctly.
- Footnotes use `※` glyphs heavily. Preserve every footnote's verbatim
  Korean in `notes_ko`.
- KO-only documents — do not attempt translation. `name_en` stays null;
  the translation worker handles it later.

## Worked examples

### Example C-1 — KNU footnoted faculty row

Source span (verbatim from KNU 2026 외국인전형 PDF):

> 의예과 — 정원외 — 약간명 ※ 면접 별도 일정으로 시행, 2026.11.15(토)
> 14:00 KST 본교 의과대학 강당

Expected `recruitment_units` row:

```json
{
  "faculty_ko": "의과대학",
  "department_ko": "의예과",
  "faculty_group": "medicine",
  "quota": "약간명",
  "is_in_quota": false,
  "notes_ko": "면접 별도 일정으로 시행, 2026.11.15(토) 14:00 KST 본교 의과대학 강당",
  "applicant_category": "외국인전형",
  "is_correction_notice": false,
  "source_text_ko": "의예과 — 정원외 — 약간명 ※ 면접 별도 일정으로 시행, 2026.11.15(토) 14:00 KST 본교 의과대학 강당",
  "extractor_confidence": 0.89
}
```

The interview-date footnote ALSO emits a `cycle_dates` row at
event_type='interview' / `recruitment_unit_id=<the medicine unit>`.
The parse worker stitches the two via the recruitment_unit FK.

### Example C-2 — PNU 거점국립대 with multiple campuses

Source span (verbatim from PNU 2026 외국인전형 quotas table):

> 공과대학 (양산캠퍼스) — 기계공학과 — 정원외 5명
> 공과대학 (부산캠퍼스) — 컴퓨터공학과 — 정원외 8명

Expected `recruitment_units` rows (campus must be set):

```json
{
  "rows": [
    {
      "faculty_ko": "공과대학",
      "department_ko": "기계공학과",
      "campus": "Yangsan",
      "faculty_group": "engineering",
      "quota": 5,
      "is_in_quota": false,
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "source_text_ko": "공과대학 (양산캠퍼스) — 기계공학과 — 정원외 5명",
      "extractor_confidence": 0.92
    },
    {
      "faculty_ko": "공과대학",
      "department_ko": "컴퓨터공학과",
      "campus": "Busan",
      "faculty_group": "engineering",
      "quota": 8,
      "is_in_quota": false,
      "applicant_category": "외국인전형",
      "is_correction_notice": false,
      "source_text_ko": "공과대학 (부산캠퍼스) — 컴퓨터공학과 — 정원외 8명",
      "extractor_confidence": 0.92
    }
  ]
}
```

`campus` distinguishes 양산 / 부산 / 밀양 across audit §1's 거점국립대
schools. Use the romanised campus name (Yangsan / Busan / Miryang)
since the field is consumed by the Flutter UI.
