# document_checklist field-group extraction prompt (production)

Audit §4.7. Strict JSON schema = [`DOCUMENTS_REQUIRED_SCHEMA`](../schemas.py).
Difficulty-4: country-specific apostille routing is the trap.

Phase 2 expands this with explicit **country-of-origin conditional logic**
(audit §4.7 country gotchas + ADR-007 Uzbek-cohort focus). The
`country_specific` field is the heart of the value proposition — get
this wrong and a contracted student wastes a week chasing the wrong
document type.

## Strict rules

- One row per `(applicant_category, document_type)`.
- `document_type` uses the canonical enum (kept in sync with
  `lib/features/documents/domain/document_type.dart`):
  `application_form`, `personal_statement`, `study_plan`,
  `hs_diploma`, `hs_transcript`, `nationality_proof_self`,
  `nationality_proof_parents`, `family_relationship_cert`,
  `topik_certificate`, `english_test`, `recommendation_letter`,
  `bank_balance_cert`, `sponsor_bank_statement`, `photo`,
  `application_fee_receipt`.
- `is_apostille_required`: true for any foreign-issued document by
  default (audit §4.7).
- `country_specific`: ISO-3166 alpha-2 keyed object. See country-of-
  origin matrix below.
- `notes_ko` carries the verbatim Korean footnote.

## Country-of-origin matrix (audit §4.7 + ADR-007 priority cases)

The matrix below is the **default routing** when the source PDF is
silent on country. Override only if the source explicitly says
otherwise. Per-country defaults for `hs_diploma` / `hs_transcript` /
`family_relationship_cert`:

| ISO | Country | Default routing |
|---|---|---|
| **UZ** | Uzbekistan | `consular_legalization=true, apostille=false`. Uzbekistan is NOT in the Apostille Convention. Korean Embassy in Tashkent does the consular verification. **The dominant Hanguk user case.** |
| **VN** | Vietnam | Vietnam joined the Apostille Convention 2025-12-25 — **older PDFs still ask for consular**. When source PDF predates 2026 OR explicitly says "영사확인", default `consular_legalization=true, apostille=false`. When source says "아포스티유", switch. |
| **CN** | China | `notarization=true, chesicc_required=true, apostille=false`. CHESICC verification of HS graduation status is almost universally required for Chinese applicants. |
| **MN** | Mongolia | `apostille=true` (joined 2009). Korean translation must be notarized. |
| **KZ** | Kazakhstan | `apostille=true`. Korean translation must be notarized. |
| **KG** | Kyrgyzstan | `apostille=true` (joined 2011). |
| **RU** | Russia | `apostille=true, translation_notarized=true`. |
| **CA** | Canada | `apostille=true` (joined 2024-01-11). Pre-2024 docs may still reference consular path — flag for HITL if source predates 2024. |
| **US** | United States | `apostille=true`. Issued by Secretary of State of the issuing US state. |
| **ID** | Indonesia | `consular_legalization=true, apostille=false`. Indonesia is NOT in the convention. |
| **TR** | Türkiye | `apostille=true`. |
| **PH** | Philippines | `apostille=true` (joined 2019). |
| **TH** | Thailand | NOT in the convention as of audit date. `consular_legalization=true`. |

## D3 conditional logic — when the source explicitly differs

- If the PDF says "출신 국가별로 추가 서류가 필요할 수 있음" (a vague
  catch-all) WITHOUT specifics, set
  `country_specific = {"_default": {"flag_for_hitl": true}}` so the
  reviewer knows to chase the institution for clarification.
- If the PDF says "본 대학은 아포스티유만 인정함 (영사확인 불가)"
  (apostille-only — consular not accepted), then for non-Apostille
  countries (UZ, ID, TH) the application is effectively closed —
  set `_blocked_countries = ["UZ","ID","TH"]` in the row's
  `country_specific` and **flag for HITL with priority=2** (this is
  a counselor-actionable rejection condition).
- If the PDF lists country-specific document types (e.g.
  "베트남 출신: 졸업증명서 + 호적등본 (영사확인)"), emit ONE row per
  document_type with the per-country gotchas in `country_specific`.

## Worked examples

### Example DC-1 — Uzbek-specific routing (the dominant Hanguk case)

Source span (verbatim from a typical 외국인전형 PDF):

> 고등학교 졸업증명서 — 원본 + 한국어 번역본 (공증 필수) — 본국이
> 아포스티유 협약 가입국이면 아포스티유, 아니면 한국대사관 영사확인.

Expected row (note multi-country `country_specific` map):

```json
{
  "applicant_category": "외국인전형",
  "document_type": "hs_diploma",
  "is_required": true,
  "is_apostille_required": true,
  "country_specific": {
    "UZ": {"consular_legalization": true, "apostille": false, "translation_notarized": true},
    "ID": {"consular_legalization": true, "apostille": false, "translation_notarized": true},
    "TH": {"consular_legalization": true, "apostille": false, "translation_notarized": true},
    "VN": {"consular_legalization": true, "apostille": false, "translation_notarized": true,
            "note_ko": "베트남이 2025-12-25 협약 가입 — 본 PDF가 그 전에 발표된 경우 영사확인이 기본값"},
    "CN": {"notarization": true, "chesicc_required": true, "apostille": false,
            "translation_notarized": true},
    "MN": {"apostille": true, "translation_notarized": true},
    "KZ": {"apostille": true, "translation_notarized": true},
    "KG": {"apostille": true, "translation_notarized": true},
    "RU": {"apostille": true, "translation_notarized": true},
    "_default": {"apostille": true, "translation_notarized": true}
  },
  "notes_ko": "한국어 번역본 공증 필수. 본국이 아포스티유 협약 가입국이면 아포스티유, 아니면 한국대사관 영사확인.",
  "source_text_ko": "고등학교 졸업증명서 — 원본 + 한국어 번역본 (공증 필수) — 본국이 아포스티유 협약 가입국이면 아포스티유, 아니면 한국대사관 영사확인."
}
```

### Example DC-2 — Apostille-only school blocks Uzbek applicants

Source span:

> 본 대학은 아포스티유 협약 가입국 출신자만 지원 가능하며, 영사확인은
> 인정하지 않습니다. 가입국 목록은 헤이그 협약 공식 사이트 참조.

Expected row (any document_type — the rule applies to all foreign-issued
HS docs in this institution's checklist):

```json
{
  "applicant_category": "외국인전형",
  "document_type": "hs_diploma",
  "is_required": true,
  "is_apostille_required": true,
  "country_specific": {
    "_blocked_countries": ["UZ", "ID", "TH"],
    "_default": {"apostille": true, "consular_legalization_accepted": false}
  },
  "notes_ko": "본 대학은 아포스티유 협약 가입국 출신자만 지원 가능. 영사확인 불가.",
  "source_text_ko": "본 대학은 아포스티유 협약 가입국 출신자만 지원 가능하며, 영사확인은 인정하지 않습니다."
}
```

A `_blocked_countries` row enqueues a P2 HITL task. The Hanguk app
must surface this as a blocker on the Applications tab BEFORE the
student starts the document-prep workflow — saves the contracted
student weeks of futile effort.
