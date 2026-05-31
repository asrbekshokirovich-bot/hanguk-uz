# University DB — source-accuracy remediation plan

_Date: 2026-05-23. Trigger: a live source-comparison QA pass (Claude
Chrome extension) that diffed the AI-extracted Inha + KAIST data against
the actual `inha.ac.kr` / `kaist.ac.kr` pages and PDFs._

## Scope & ownership

This plan covers **only the backend + extraction/translation pipeline in
this repo** (`services/uni_db/`, `supabase/`). The reviewer screen the QA
was run against — university selector, per-section cards, the
"Accept as-is / Save edits + accept / Reject / Source is wrong" buttons —
is the separate **`hanguk-uz` website** (the Lovable-built reviewer site),
which is *not* in this repository. Its UI/workflow items (report §4) are
handed off in
[`hanguk_uz_review_ui_handoff.md`](./hanguk_uz_review_ui_handoff.md),
together with the backend data contract this plan delivers so that work is
unblocked.

This is the **next layer on top of**
[`review_data_quality_plan.md`](./review_data_quality_plan.md). That plan
(Layers 1–4) stopped the queue from showing empty/failed/raw-JSON items.
The system is now structurally sound — the QA confirmed the *schema* is
good (per-track categories, country-specific apostille overrides, separate
`source_text_ko` vs `prose_ko`, honest `null`/confidence flags). What
remains are **accuracy and completeness** problems: the pipeline records
"not specified" where the real answer is "not required", ships truncated
source spans, extracts only from the notice excerpt instead of the
canonical sub-page, and lets non-deterministic translation produce
artifacts.

## Root-cause map (report finding → code → fix → owner)

| # | Report finding | Root cause (file:line) | Workstream | Owner |
|---|---|---|---|---|
| 1b | TOPIK/English/GPA shown "Not specified" when the real answer is "not required" | `null` is the only sentinel — `extract/schemas.py:135,143,163`; prompt says "`english_test` is null when no English test is required" `prompts/requirements.md:28` | **A** | this repo |
| 3c | Doubled phrases ("SAT, ACT… (e.g. SAT, ACT…)") | no post-extraction normalization; prompt doesn't forbid echoing examples | **A** | this repo |
| 3e | No per-document deadlines | `DOCUMENTS_REQUIRED_SCHEMA` has no deadline field — `schemas.py:262-289` | **A** | this repo |
| 3a | `source_text_ko` clipped mid-word ("English Proficiency T") | hard 12k/8k slice, no boundary check, no truncation retry — `workers/parse_worker.py:261-265` | **B** | this repo |
| 2b | `award_value: null` (KAIST stipend) not retried | `award_value` accepts null with no escalation — `schemas.py:214`; no narrow-span retry in `parse_worker.py:79-115` | **B** | this repo |
| 1d, 2a, 3d | Shallow coverage; missed stipend 350k/GPA 2.7/8-sem cap; missing docs (financial statement, SOP, study plan) | single-document extraction, no link-following to the canonical scholarship/tuition page — `workers/discovery_worker.py`, `parse_worker.py:79` | **C** | this repo |
| 1d | Only 전형 extracted for a university; other groups silently absent | empty extractions dropped, no per-group source coverage tracking — `parse_worker.py:111-115` | **C** | this repo |
| 4.5, §5.7 | Card shows flat 85%; per-row confidence (0.68–0.91) not surfaced | `_self_score` returns root value or constant 0.85, never aggregates rows — `extract/llm_anthropic.py:208-214`; view exposes only `accuracy_self_score` — `migrations/...review_dashboard_add_field_group.sql:13` | **D** | this repo |
| 4.3, 1c | Same row retranslated with different wording between renders | `translate-document` runs at temperature 0.1 — `functions/translate-document/index.ts:335,369`; no result cache before the LLM call | **E** | this repo |
| 3b | Korean + English concatenated in one note field | bilingual content in `notes_ko` (extraction-time or field-translate write-back) | **E** | this repo |
| 4.2 | Translation blocks render ~4s ("translating…") | `prose_en` not precomputed/exposed; site translates on read | **E** + **F** | this repo + `hanguk-uz` |
| 1a, 2a, 4.1, §5.1 | "Open source PDF" opens the notice page, not the PDF | `storage_path` is null because no PDF was resolved/downloaded — KAIST has no resolver (`parse/pdf_resolvers/__init__.py:81-93`); Inha resolver exists but needs a post-detail URL, while discovery stored the board landing page | **F** | this repo |
| 1c | Duplicate "cards" for the same tracks | view does not fan out (`v_review_queue_dashboard` joins are 1:1); duplication is render-side, *unless* two open `extraction_jobs` exist for one (institution, field_group) | **F** + handoff | this repo + `hanguk-uz` |
| §4.4 | Selection resets on panel click | pure website state bug | handoff | `hanguk-uz` |
| §4.6 | Freeform JSON editor, no schema validation, no diff | website editor | handoff (backend ships the JSON Schema) | `hanguk-uz` |
| §4.7 | Four actions, no confirmation / no reason capture | website; backend reject-reason RPC already exists | handoff | `hanguk-uz` |

---

## Workstream A — schema & prompt correctness

**A1. Distinguish "not required" from "not stated" (report 1b).**
`null` currently means both. Add explicit, additive `*_status` signals to
`REQUIREMENTS_SCHEMA` (jsonb keys — no DB migration needed, same pattern
as commit #17):

- `topik_status`: enum `required | not_required | not_stated` (keep
  `topik_min_level` for the level when required).
- `english_status`: enum `required | not_required | not_stated`
  (alongside the existing `english_test` object).
- `gpa_status`: enum `required | not_required | not_stated`.

Update `prompts/requirements.md`:
- Replace "`english_test` is null when no English test is required" (line
  28) with: set `english_status = not_required` when the source explicitly
  waives/omits it (면제 / 불필요 / 해당없음 / "not required"); set
  `not_stated` only when the excerpt is silent; set `required` + the score
  object otherwise.
- Few-shot 2's 재외국민 row (`prompts/requirements.md:107-117`) must show
  `topik_status: "not_required"` (it says TOPIK 면제), not bare `null`.

**Acceptance:** re-extracting Inha 재외국민/북한이탈주민 yields
`topik_status: "not_required"` (not `null`), so the site can render
"Not required" instead of "Not specified".

**A2. Per-document deadlines (report 3e).** Add `deadline` (string|null,
ISO) and `applies_to_round` (string|null, e.g. `early`/`regular`) to each
row in `DOCUMENTS_REQUIRED_SCHEMA` (`schemas.py:262-289`); instruct
`prompts/documents_required.md` to capture the per-document / per-round
deadline when stated (KAIST's recommendation-letter Oct 29 / Jan 21 case).

**A3. Forbid echoed examples & enforce monolingual fields (report 3b, 3c).**
In every prompt's "Final reminder":
- "Do not repeat the same list/example twice in one field
  (`notes_ko` must contain each enumerated item once)."
- "`*_ko` fields contain Korean only. Never concatenate an English
  translation into a `_ko` field — English belongs in the translation
  layer."
Add a cheap post-extraction normalizer (new
`extract/normalize_text.py`, called from `llm_anthropic.extract_field_group`
before validation) that collapses an exact duplicated sentence/clause and
strips a trailing English run appended after a Korean clause in `*_ko`
fields. Keep it conservative (exact-substring dedup only) to avoid
mangling legitimate repetition.

---

## Workstream B — span adequacy & re-extraction

**B1. Boundary-aware slicing (report 3a).** Replace the hard cut in
`parse_worker.py:_slice_for` (lines 261-265) with a window that extends to
the next sentence/line/heading boundary (Korean `。`/`\n`/heading regex)
rather than mid-token, and widen the cap when a known section header is
detected after the cut.

**B2. Truncation detection + retry.** After extraction, scan each row's
`source_text_ko`; if it ends mid-word/mid-token (no terminal punctuation,
trailing single ASCII letter like "T", or equals the slice boundary
length), re-run that field group once against a widened slice
(`start : start + 24000`) before queueing. Surface a
`truncation_retry: true` flag on the job for observability.

**B3. Null-on-narrow-span retry (report 2b).** When a high-value field
comes back null *with* a model note that the span was too narrow
(`award_value: null`, `prose`/`notes` mentions the value exists), trigger
the same widened-slice re-extraction (or the WS-C sub-page fetch) before
accepting the null.

**Acceptance:** the KAIST "English Proficiency" documents row is no longer
shipped as the stub "English Proficiency T"; a re-extraction either fills
it or flags it for re-fetch.

---

## Workstream C — coverage & canonical source resolution

This is the highest-impact accuracy fix: the pipeline extracts from a
single fetched notice/excerpt and never follows the one-click link to the
canonical page (KAIST scholarship page has the 350k KRW stipend, 2.7 GPA,
8-semester cap, insurance, procedure — none reached the extractor).

**C1. Canonical sub-page following.** In discovery/parse, when a notice or
guideline references a canonical sub-page for a field group (scholarship,
tuition, requirements), resolve and fetch that page and extract that field
group from it. Concretely:
- Add a small per-institution "canonical source map"
  (`scholarships` → `admission.kaist.ac.kr/intl-undergraduate/support/scholarships/...`,
  `tuition` → …) seeded for the top universities, plus a generic
  link-following heuristic (anchor text 장학금/등록금/지원자격 →
  follow same-host link, fetch, extract).
- The parse worker extracts each field group from its **best** source
  (canonical sub-page if available, else the guideline slice), not always
  from the same 12k window.

**C2. Missing documents (report 3d).** With C1 feeding the canonical KAIST
admissions guide, the documents extraction should pick up Statement of
Financial Resources, Self-Introduction/Personal Statement, Study Plan, and
citizenship proof. Add these `document_type` values to the registry note
in `prompts/documents_required.md` so the model emits canonical types.

**C3. Coverage observability (report 1d).** Empty extractions are silently
dropped (`parse_worker.py:111-115`), so a university can show only 전형
with no signal that tuition/timeline/scholarships were attempted-and-empty
vs never-attempted. Record a per-(institution, field_group) **coverage
row** (attempted, empty, source_url used, last_run) so the dashboard can
show "Not extracted yet" vs "Attempted, source had nothing" — and so we
can target re-fetches. Do **not** re-introduce empty items into the staff
queue.

**Acceptance:** re-running KAIST produces a scholarships row with
`award_value` (stipend) populated and the GPA/cap/insurance/procedure in
structured fields + prose; coverage table shows which groups were sourced
from which URL.

---

## Workstream D — confidence model

**D1. Aggregate per-row confidence.** Change `_self_score`
(`llm_anthropic.py:208-214`) so the job-level `accuracy_self_score` is the
**min** of the per-row `extractor_confidence` values (fall back to the
current root value / 0.85 only when no rows carry one). This makes
queueing priority reflect the weakest row, and matches what a reviewer
should be alerted to.

**D2. Surface min in the view.** Add a computed
`min_row_confidence` column to `v_review_queue_dashboard` (min over
`parsed_output->'rows'->*->>'extractor_confidence'`) so the site can badge
the lowest per-row confidence, not a flat 85%. (View change only — additive
column at end, per the CREATE OR REPLACE constraint.)

**Acceptance:** the KAIST scholarships card surfaces 0.68 (its weakest
row), not 85%.

---

## Workstream E — translation determinism & artifacts

**E1. Deterministic sampling.** Set `temperature: 0` in
`functions/translate-document/index.ts:335` (Anthropic) and `:369`
(Gemini), matching `translate-fields` (`:57,77`). This removes the
"operating a business" vs "running a business" drift.

**E2. Result cache (idempotent translation).** Before calling the model,
look up `translations` by `(entity_type, entity_id, field_name, lang)` and
a hash of `(source_text, glossary_version)`; return the stored value on
hit. The worker already upserts on that key
(`workers/translate_worker.py:113-118`) — add the read-side short-circuit
and a `source_hash`/`glossary_version` column so identical inputs always
yield identical output and we stop re-calling the model on every render.

**E3. Post-translate dedup.** Add the same conservative exact-duplicate
collapse from A3 to the translation output path.

**E4. Monolingual enforcement (report 3b).** Pin down where the KO+EN
concatenation originates — the two candidates are (a) the extraction model
emitting bilingual `notes_ko`, or (b) a field-translate write-back. The
fix is the A3 prompt rule + normalizer for (a), and ensuring `translate-*`
writes EN to the `translations` table only (never back into a `*_ko`
field) for (b).

**E5. Precompute `prose_en` for the review view (report 4.2).** Ensure the
translation worker runs over review-bound `prose_ko`/`notes_ko` and the
result is exposed (joined) so the site renders instantly instead of
translating on read. See WS-F view contract.

**Acceptance:** translating the same `source_text_ko` twice returns
byte-identical output; the review view carries `prose_en` so the website
shows text immediately.

---

## Workstream F — PDF resolution & review-view data contract

**F1. KAIST PDF resolver (report 1a, 2a, §5.1).** KAIST is absent from
`_REGISTRY` (`parse/pdf_resolvers/__init__.py:81-93`) and its attachment
isn't a direct PDF stream — the notice detail page links
`Admissions Guide for 2027 admission.pdf`. Add `parse/pdf_resolvers/kaist.py`
(+ fixture + unit test per the package's resolver contract) that extracts
the attached PDF link from the KAIST notice detail page.

**F2. Inha post-detail URL.** The Inha resolver exists (reuses the KU
`FR_BBS_SVC` resolver, `__init__.py:92`) but needs the **post detail** URL
with `fileDown` anchors. Discovery currently records the board landing page
(`...index.do?MENU_ID=170`). Fix discovery to store the specific post
detail URL so the resolver can find the 시행계획 PDF.

**F3. Review-view data contract (the backend half of report §4).** Extend
`v_review_queue_dashboard` so the website can fix its UI without business
logic:
- `source_page_url` (the human page — today's `source_url_ko`) **and**
  `source_pdf_url` (signed URL resolved from `storage_path` via
  `get-pdf-url`, or null) as **two distinct fields** → fixes "both buttons
  same URL".
- `min_row_confidence` (WS-D2).
- `prose_en` / translated fields joined from `translations` (WS-E5).
- Guarantee **one open `review_queue` row per (institution, field_group)**:
  when a re-extraction creates a new `extraction_jobs` row, close/supersede
  the prior open queue item so the site can't render the same tracks twice
  from two jobs. (Investigate whether the report's duplicate cards are two
  jobs or pure render duplication; if render-only, it's handoff-side, but
  this guarantee removes the data-side possibility.)
- Expose the field-group **JSON Schema** (or a stable schema version id) so
  the website editor can validate edits (report §4.6).

**Acceptance:** the dashboard view returns a non-null `source_pdf_url` for
Inha and KAIST that opens the actual guideline PDF; "view page" and "open
PDF" point to different URLs.

---

## Sequencing

1. **F1–F2 (PDF resolvers) + C1 (canonical sub-page following)** — root
   cause of both the broken PDF link *and* the missed/shallow data. Highest
   accuracy ROI. Re-run Inha + KAIST after.
2. **A1–A3 (sentinels, dedup, monolingual) + B1–B3 (truncation/null
   retry)** — correctness of the fields we do extract.
3. **E1–E5 (translation determinism/cache/precompute)** — removes
   artifacts and the render block; depends on nothing above.
4. **D1–D2 + F3 (confidence + view contract)** — surface the right signals;
   F3 is the contract the website consumes.
5. **Backfill re-extraction** of the top universities; hand `hanguk-uz` the
   contract doc.

WS-E and WS-D can proceed in parallel with 1–2.

## Verification (definition of "completely corrected")

Re-run the same QA loop the report used, against live Inha + KAIST:
- 재외국민/북한이탈주민 TOPIK reads "Not required" (status), not "Not
  specified".
- KAIST scholarship shows the 350,000 KRW/month stipend, ≥2.7/4.3 GPA,
  8-semester cap, insurance, and procedure.
- KAIST documents include the financial statement / SOP / study plan;
  no truncated stub rows; notes are single-language and de-duplicated.
- "Open source PDF" opens the actual guideline PDF (distinct from the page
  link).
- Translating a field twice is byte-identical; the card shows the lowest
  per-row confidence.
- Add regression tests: schema tests for the new status enums + deadline
  field; a `kaist` PDF-resolver unit test; a truncation-retry unit test; a
  translation-idempotency test.

## Delegated to `hanguk-uz` (report §4)

Pure website concerns — see
[`hanguk_uz_review_ui_handoff.md`](./hanguk_uz_review_ui_handoff.md):
selection-reset bug (§4.4), render-side translation/duplicate-card behavior
(§4.2/§4.3 render half), confirmation + reason capture on destructive
actions (§4.7), schema-validated/diff editor (§4.6), and consuming the new
view fields (`source_pdf_url`, `min_row_confidence`, `prose_en`, status
enums).

## Risks & notes

- **Cost / rate:** C1 sub-page fetches and B-retries add fetches + LLM
  calls. Gate behind the existing `UNI_DB_LIVE_*` flags; budget per
  ADR-001.
- **Additive only:** all schema changes are new jsonb keys + additive view
  columns — no destructive migration, consistent with commit #17.
- **Don't re-flood the queue:** WS-C coverage tracking must stay out of the
  staff content queue (it's observability), preserving the
  `review_data_quality_plan.md` Layer-1 hygiene gain.
