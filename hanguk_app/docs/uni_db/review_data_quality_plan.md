# Review-data quality & presentation — plan to "completely solve it"

_Date: 2026-05-23. Trigger: staff review screen shows raw Korean JSON; most
items are empty or failed._

## What's actually wrong (from reviewing the live queue, 39 items)

| Issue | Evidence | Severity |
| --- | --- | --- |
| **A. Raw JSON shown to staff** | Review pane is an editable JSON blob with `prose_ko`, `notes_ko`, `source_text_ko`, `extractor_confidence`, `eligibility_predicate`, etc. | High (UX) |
| **B. No translation for reviewers** | Korean-only fields (`prose_ko`, `notes_ko`, `applicant_category:"외국인전형"`). Uzbek/English staff can't read them. | High |
| **C. Empty extractions queued as "high confidence"** | **tuition 9/9 empty** (`{"rows":[]}`) at conf 0.85; many scholarships/docs/requirements also empty. ~22/39 are empty. | High (noise) |
| **D. Failed extractions in the human queue** | 13/39 are `{"_extraction_failed": ...}` (schema/enum mismatches + Anthropic invalid-JSON). Shown as raw error text. | High |
| **E. Wrong / thin source document** | `source_text_ko:"Application Form ①"` + all-empty tuition ⇒ crawler fetched a notice/application page, not the real 모집요강 guideline PDF with tables. | High (root cause of empties) |
| **F. Unsegmented Korean prose** | Whole eligibility narratives crammed into one `prose_ko` (e.g. the 재외국민 paragraph) instead of separated sub-fields. | Medium |

Net: only ~4 of 39 items are worth a human's time today; the rest are empty,
failed, or unreadable.

## The plan — four layers, each independently shippable

### Layer 1 — Queue hygiene (stop showing noise) · backend · fastest, highest impact
Only put items with **real, readable content** in front of staff.
- Parse worker: if `parsed_output` is empty (`rows:[]` / `{}`) → **do not enqueue**; mark the extraction `needs_resolution` and flag the *guideline* for re-fetch/re-extract instead of a human.
- Failed extractions (`_extraction_failed`) → route to a separate **"extraction errors"** lane (engineering / auto-retry), not the staff content queue.
- Backfill: reclassify the existing 35 empty/failed items out of the staff queue now (so the queue drops from 39 → the ~4 real ones).

### Layer 2 — Fix extraction quality (so there IS data) · backend/pipeline
- **Source resolution (root cause):** make the crawler resolve and fetch the actual 모집요강 PDF (the guideline with tables), not the thin "Application Form/notice" page. Add per-adapter PDF resolvers (already exist for Korea Univ / Yonsei — extend to KAIST/Inha/etc.).
- **Fix schema/prompt mismatches** behind the 13 failures: `'rows'` required wrapper, `'applicant_category'` required, invalid `event_type` enums (`tuition_payment`, `other`), Anthropic invalid-JSON. Align schemas + prompts, add a JSON-repair pass.
- **Retry** transient Anthropic errors before queueing.
- Re-run extraction on affected guidelines.

### Layer 3 — Translate for reviewers (so staff can read) · backend
Every Korean field that reaches the review screen must carry an English (+ Uzbek)
translation. Two options:
- (a) Extend extraction to emit `*_en` next to each `*_ko` (one prompt change), **or**
- (b) Run the translation worker over the extracted fields and join the result.
Recommended: (a) for prose/notes/category (cheap, in the same call), keep (b) for
long narratives. Show EN/UZ by default with a **"view original (한국어)"** toggle.
Also map enum-like Korean values to labels (`외국인전형` → "Foreign/International admission").

### Layer 4 — Structured, separated presentation (not raw JSON) · website + backend shape
Replace the JSON editor with a **labeled, separated form per field group**:
- **Deadlines** (calendar): table — Event · Date (KST) · Notes.
- **Tuition**: Faculty · Year · Semester · Amount (KRW) · Admission fee.
- **Requirements**: separated fields — TOPIK level · English test · GPA · age · + a
  translated **Eligibility** and **Selection method** section (not one Korean blob).
- **Scholarships**: Name (EN) · Type · Value · Eligibility (translated) · TOPIK tiers.
- **Documents**: Document · Required? · Apostille? · Country-specific · Notes (translated).
- Hide pipeline-internal fields (`extractor_confidence`, `eligibility_predicate`,
  `is_correction_notice`, `source_text_ko`) behind an **"advanced / raw JSON"** toggle.
- Keep raw-JSON edit as the power-user fallback; default to the structured form.

## Who does what
- **Backend (this repo / Supabase):** Layers 1, 2, 3 — worker logic, schemas/prompts,
  source resolvers, translation, and a clean `v_review_queue_item_detail` view that
  exposes already-separated + already-translated fields so the site renders without
  business logic.
- **hanguk-uz (website):** Layer 4 — the structured form UI consuming that view.

## Recommended order
1. **Layer 1 now** (queue drops to the real items; staff stop wasting time). 
2. Layer 2 (source resolvers + schema fixes + re-extract) — turns empties into real data.
3. Layer 3 (translation) in parallel with 2.
4. Layer 4 (UI) once the backend exposes clean separated+translated fields.
