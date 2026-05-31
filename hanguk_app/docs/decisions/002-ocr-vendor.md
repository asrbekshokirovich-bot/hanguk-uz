# ADR-002 — OCR vendor

- **Status:** Accepted
- **Date:** 2026-05-07
- **Context:** plan §O.2, plan §F.2 layer 3, audit §7.6

## Question

For image-only / scanned Korean PDFs (~10% of priority guidelines), do we
use **Naver Clova OCR** ($80/mo at scale, best Korean accuracy) or stick
with **all-OSS easyocr / PaddleOCR** (free)?

## Decision

**EasyOCR (open-source).** Korean tabular accuracy is ~85% vs Clova's
~97%, but the cost difference outweighs the accuracy gap for the
internal-only volume profile (ADR-007).

## Implementation impact

- `services/uni_db/src/uni_db/parse/ocr_naver_clova.py` stays as the
  Phase 0 stub — not deleted in case we revisit later.
- A new `parse/ocr_easyocr.py` will land in Phase 2, called from the
  PDF pipeline whenever `extract_text_pymupdf()` returns
  `has_text_layer=False`.
- The 15% accuracy gap routes more PDFs to HITL — the in-office
  reviewer (ADR-005) handles them. Estimated extra load: ~2–4 hours/
  week during high season.
- `services/uni_db/.env.example` keeps `NAVER_CLOVA_OCR_*` envvars
  commented for future re-enablement.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Naver Clova OCR | $80/mo overkill at our volume given the in-office reviewer |
| Tesseract | Korean accuracy ~75% — too brittle on tables |
| Google Cloud Vision | Comparable quality, but not Korea-region-hosted (PIPA concern) |
| Skip OCR entirely | Loses ~10% of priority universities |

## Reversal trigger

If the in-office reviewer reports that OCR cleanup is consuming >6
hours/week sustained for 4 weeks, switch to Naver Clova. The code path
already exists; flipping a config flag re-enables it.
