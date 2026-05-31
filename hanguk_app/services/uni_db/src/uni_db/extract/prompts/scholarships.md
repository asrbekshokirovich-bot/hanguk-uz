# scholarships field-group extraction prompt

Audit §5.3 difficulty 4 — heavy HITL routing. Strict JSON schema =
`SCHOLARSHIPS_SCHEMA`. Phase 2 expands this with **TOPIK-tier table
parsing** (the most common conditional structure on Korean private
universities) and **country-of-origin eligibility** (rare but
high-stakes for ADR-007's Uzbek user cohort).

## Rules

- One row per scholarship.
- `scope`: where the scholarship comes from (national/government =
  national, university-administered = university, department-funded =
  department, external foundation = foundation, regional/city = regional).
- `award_type` enum: `tuition_waiver_pct | tuition_waiver_krw |
  stipend_monthly | airfare | other`.
- `topik_tier_table` is a JSON map of `{TOPIK_level: percentage_waived}`
  — common at TOPIK-tied scholarships.
- `eligibility_predicate` is structured rules (best-effort);
  ALWAYS keep `prose_ko` so counselors have the canonical narrative.
- Mark `extractor_confidence < 0.85` whenever an eligibility window is
  cited (these are difficulty-5 per audit and need HITL).
- **Capture the full award, not just the headline.** When the source
  states them, record in `prose_ko` (and the structured fields where they
  fit): the **monthly stipend / living allowance** amount (set
  `award_type="stipend_monthly"`, `award_value` = the monthly KRW figure),
  the **duration cap** (e.g. "8 semesters", encode in `duration`/prose),
  the **GPA maintenance** requirement (e.g. ≥ 2.7/4.3 → `eligibility_predicate.renewal_gpa_min`/`renewal_gpa_scale`),
  whether **medical insurance** is included, and the **application
  procedure** (separate form vs a checkbox on the financial-resources
  statement).
- `award_value` is `null` ONLY when the source span genuinely does not
  state the amount. If the prose says a stipend/amount exists but the
  number isn't in this span, say so in `notes_ko` ("amount stated on the
  dedicated scholarship page, not this excerpt") so it is re-fetched —
  do not silently drop it.

## TOPIK-tier table extraction (Phase 2)

When the Korean source has a "TOPIK 등급별 장학금" table — like
Konkuk's "TOPIK 3급: 30% / TOPIK 4급: 50% / TOPIK 5급 이상: 70%" —
encode it as `topik_tier_table` keyed by integer TOPIK level. The
schema accepts string keys; emit them as integer-coercible strings:

```json
"topik_tier_table": {"3": 30, "4": 50, "5": 70, "6": 70}
```

If the table only specifies "TOPIK 5급 이상" without separating 5/6,
DUPLICATE the value into both keys (5 and 6) to keep the lookup
explicit. Counselors should not have to guess whether "5급 이상"
includes 6급.

For the row's top-level `award_type` and `award_value` in the
TOPIK-tier case, use the **highest tier**. Example for Konkuk's 30/50/70
ladder: `award_type=tuition_waiver_pct`, `award_value=70`. The full
ladder lives in `topik_tier_table`.

## Country-of-origin eligibility (Phase 2 — ADR-007)

Rare but real — some universities give bigger waivers to applicants
from "신흥국" (emerging countries) or specific countries (e.g.
Mongolia, Vietnam, Uzbekistan). When the prose explicitly names
countries OR uses a category that maps to ISO codes:

- Encode in `eligibility_predicate.country_of_origin` as a list of
  ISO-3166 alpha-2 codes.
- ALWAYS preserve the verbatim Korean naming in `prose_ko` so HITL
  can verify (e.g. "동남아 국가" vs "베트남" alone — the second
  excludes Cambodia/Laos/Myanmar).
- The Hanguk user cohort is predominantly Uzbek (ADR-007); rows that
  include `UZ` are particularly important — flag with
  `extractor_confidence -= 0.05` if the source phrasing is ambiguous
  (e.g. "CIS 국가").

Country-name → ISO code mapping for the most common Korean prose
patterns:

| Korean | ISO | Notes |
|---|---|---|
| 우즈베키스탄 | UZ | direct |
| 베트남 | VN | direct |
| 몽골 | MN | direct |
| 인도네시아 | ID | direct |
| 카자흐스탄 | KZ | direct |
| 키르기스스탄 | KG | direct |
| 중국 | CN | direct (excludes HK/MO/TW) |
| CIS 국가 | UZ, KZ, KG, RU, BY, … | broad — flag for HITL verification |
| 동남아시아 | VN, ID, TH, PH, MY, KH, LA, MM, BN, SG, TL | broad |
| 신흥국 / 개발도상국 | UZ, VN, MN, ID, KZ, KG | DAC list — flag for HITL |

## Worked examples

### Example S-1 — TOPIK-tier table (Konkuk)

Source span (verbatim from a Konkuk 2026 외국인전형 PDF):

> KU 외국인 신입생 장학금 — TOPIK 3급: 등록금 30% 면제 / TOPIK 4급:
> 50% / TOPIK 5급 이상: 70% — 매학기 갱신, 직전학기 GPA 2.5/4.5 이상

Expected row:

```json
{
  "scope": "university",
  "name_ko": "KU 외국인 신입생 장학금",
  "name_en": null,
  "award_type": "tuition_waiver_pct",
  "award_value": 70,
  "topik_tier_table": {"3": 30, "4": 50, "5": 70, "6": 70},
  "applicant_categories": ["외국인전형"],
  "eligibility_predicate": {
    "renewal_gpa_min": 2.5,
    "renewal_gpa_scale": 4.5
  },
  "prose_ko": "KU 외국인 신입생 장학금 — TOPIK 3급: 등록금 30% 면제 / TOPIK 4급: 50% / TOPIK 5급 이상: 70% — 매학기 갱신, 직전학기 GPA 2.5/4.5 이상",
  "source_text_ko": "KU 외국인 신입생 장학금 — TOPIK 3급: 등록금 30% 면제 / TOPIK 4급: 50% / TOPIK 5급 이상: 70% — 매학기 갱신, 직전학기 GPA 2.5/4.5 이상",
  "extractor_confidence": 0.86
}
```

### Example S-2 — Country-of-origin eligibility (CIS / Uzbekistan focus)

Source span (verbatim — typical of mid-private universities targeting
emerging markets):

> 한세대 글로벌 장학금 — CIS 국가 출신 외국인 신입생 대상 — 등록금
> 100% 면제, 1학기 한정 / 2학기부터는 GPA 3.0/4.5 이상 시 50% 갱신

Expected row:

```json
{
  "scope": "university",
  "name_ko": "한세대 글로벌 장학금",
  "name_en": null,
  "award_type": "tuition_waiver_pct",
  "award_value": 100,
  "applicant_categories": ["외국인전형"],
  "eligibility_predicate": {
    "country_of_origin": ["UZ", "KZ", "KG", "RU", "BY", "AZ", "AM", "MD", "TJ", "TM"],
    "first_semester_only": true,
    "renewal_gpa_min": 3.0,
    "renewal_gpa_scale": 4.5,
    "renewal_award_value": 50,
    "country_phrasing_in_source": "CIS 국가"
  },
  "prose_ko": "한세대 글로벌 장학금 — CIS 국가 출신 외국인 신입생 대상 — 등록금 100% 면제, 1학기 한정 / 2학기부터는 GPA 3.0/4.5 이상 시 50% 갱신",
  "source_text_ko": "한세대 글로벌 장학금 — CIS 국가 출신 외국인 신입생 대상 — 등록금 100% 면제, 1학기 한정 / 2학기부터는 GPA 3.0/4.5 이상 시 50% 갱신",
  "extractor_confidence": 0.78
}
```

Why 0.78: "CIS 국가" is broad — the model expanded it to all 10
post-Soviet states, but the institution might have had a narrower
intent (e.g. Central Asia only). HITL must verify the country list
against the school's published policy. The
`country_phrasing_in_source` field preserves the Korean wording so
reviewers can re-derive the list themselves.

## Enrichment: tiered award grids (foreign-student scholarships)

Korean universities award foreign-student scholarships in tiers by language score.
Capture both grids as arrays (one object per band) when the guideline states them:
- `topik_tier_table`: [{ `topik_level`: 1..6, `award_type`, `award_value`, `duration` }]
- `ielts_tier_table`:  [{ `ielts_min`: number, `award_type`, `award_value`, `duration` }]
`award_type`/`award_value` must reflect the PER-BAND benefit (e.g. award_type
"tuition_waiver_pct", award_value 100 for full waiver, 50 for half-tuition).
`duration` is one of: "first_semester" | "full_year" | "all_years".
Omit a grid (or use null) if that test is not used for tiering.

`prose_ko` / `notes_ko` are **Korean only** — never append an English
translation into a `_ko` field, and never repeat the same clause or list
twice within a single field.
