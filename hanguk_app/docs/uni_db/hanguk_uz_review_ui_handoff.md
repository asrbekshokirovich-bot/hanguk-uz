# Hand-off prompt — `hanguk-uz` reviewer UI fixes

This is the website half of the
[source-accuracy remediation plan](./source_accuracy_remediation_plan.md).
The backend/pipeline items are fixed in the `hanguk_app` repo; the items
below are pure reviewer-website (`hanguk-uz`) concerns.

**How to use:** open a Claude Code session in the `hanguk-uz` repository and
paste everything in the fenced block below as the prompt. It is written to
be self-contained — it assumes no knowledge of `hanguk_app`.

---

````text
You are working in the hanguk-uz repository — the staff reviewer website
for a Korean university admissions database. Staff open a university, review
AI-extracted admission data (admission tracks / 전형, timeline & fees,
tuition, scholarships, required documents) against the official source, and
Accept / Edit & accept / Reject each item. Data comes from a Supabase view,
`v_review_queue_dashboard` (one row per extraction item, grouped client-side
by university).

A QA pass comparing the screen to live inha.ac.kr / kaist.ac.kr pages found
the UI/workflow problems below. The backend has been updated to give you the
data you need (see "Backend contract" at the end). Fix these:

1. SOURCE LINKS — "View source page" and "Open source PDF" currently point
   to the SAME url (the notice-board landing page); "Open source PDF" never
   opens a PDF. The view now returns TWO distinct fields:
   `source_page_url` (the human page) and `source_pdf_url` (a signed URL to
   the actual guideline PDF, or null). Wire "View source page" →
   `source_page_url` and "Open source PDF" → `source_pdf_url`; disable/hide
   the PDF button when `source_pdf_url` is null.

2. DUPLICATE CARDS — the same extraction (e.g. Inha's 3 admission tracks) is
   rendered twice, the second copy with slightly different re-translated
   wording. Two causes: (a) the component renders the rows once as cards and
   again as re-translated prose, and/or (b) it calls a translate function at
   render time so wording is non-deterministic. Render each row exactly once,
   and read the precomputed translation field (`prose_en` / translated
   fields now provided by the view) instead of translating on the client.

3. TRANSLATION BLOCKS RENDER — the panel shows "translating…" for ~4s before
   any data appears. Translations are now precomputed server-side and joined
   into the view (`prose_en`, etc.). Render Korean immediately and show the
   translation when present; never block initial render on a translate call.

4. SELECTION RESET — clicking inside the right-hand detail panel (on a
   non-interactive area) deselects the university and returns to "Select a
   university to review its extracted data." Stop the click from bubbling to
   the selection handler; selection state must persist until the user picks a
   different university or completes an action.

5. CONFIDENCE BADGE — the card shows a flat "85%" / static "P3 /
   high_difficulty_field" badge even though per-row confidences vary. The
   view now returns `min_row_confidence` (the lowest per-row confidence for
   the item). Show that value (and ideally per-row confidence in the
   expanded view), so reviewers see the weakest row, not a constant.

6. EDITOR — "Save edits + accept" opens a freeform JSON editor with no
   validation and no diff. (a) Validate edits against the field-group JSON
   Schema the backend exposes (schema id/version is on the view row) and
   block save on invalid JSON/shape. (b) Show a before/after diff of changed
   fields on save. Keep raw-JSON edit as a power-user fallback but default to
   a structured, labeled form per field group.

7. DESTRUCTIVE ACTIONS — "Accept as-is / Save edits + accept / Reject /
   Source is wrong" sit in a row with no confirmation. Add a confirmation
   step to "Reject" and "Source is wrong", and require a reason (the backend
   reject RPC already accepts a reason + optional detail; reason enum:
   wrong_year, wrong_archetype, hallucinated_field, ocr_garbled, source_404,
   other).

8. RENDER STABILITY — because translations are now precomputed and
   deterministic, the text a reviewer approves must be exactly the text shown
   (no re-translation between renders). Verify the displayed string is the
   stored one.

After implementing, verify against a real Inha and a real KAIST item:
distinct page vs PDF links, no duplicate cards, instant render, persistent
selection, lowest-confidence badge, validated editor with diff, and
confirmation + reason on Reject / Source is wrong.

BACKEND CONTRACT — fields now available on `v_review_queue_dashboard`
(actual columns on v_review_queue_dashboard as of the backend changes):
- source_url_ko         : text  — the human-readable source PAGE
                                   ("View source page" → this).
- storage_path          : text  — the stored PDF object path, or null. For
                                   "Open source PDF", call the `get-pdf-url`
                                   edge function with this path to mint a
                                   short-lived signed URL client-side. There
                                   is NO static `source_pdf_url` column — a
                                   signed URL can't live in a view. Hide the
                                   PDF button when storage_path is null.
- min_row_confidence    : numeric — lowest per-row extractor_confidence
                                   (null → fall back to accuracy_self_score).
- accuracy_self_score   : numeric — job-level (now = min of per-row scores).
- parsed_output         : jsonb — the structured rows (render, don't re-fetch).
- field_group           : text  — calendar | tuition | requirements |
                                   scholarships | documents_required
- requirements rows now carry status enums: topik_status / english_status /
  gpa_status ∈ {required, not_required, not_stated} — render "Not required"
  (not "Not specified") when the value is not_required.
- documents rows now carry per-document `deadline` / `applies_to_round`.
- Validate editor changes against the field-group JSON Schema in
  `services/uni_db/src/uni_db/extract/schemas.py` (FIELD_GROUP_SCHEMAS).
- prose_en / precomputed translations are NOT yet joined into the view
  (plan E5 is still pending); until then, render Korean immediately and do
  not block on a translate call.
````

---

## Notes for whoever runs the hand-off

Backend status (this repo) as of the latest commits:
- DONE: deterministic translation (`translate-document` now temperature 0),
  per-row `min_row_confidence` on the view, requirement status enums +
  document deadline fields in the schemas, KAIST PDF resolver, truncation
  re-extraction, and `*_ko` text hygiene (no bilingual concat / dup).
- PENDING: precomputing/joining `prose_en` into the view (plan E5). So
  items 2/3/8 still require the site to render Korean immediately and NOT
  block on a translate call; remove "translate on read" only once E5 ships.
- Item 1 depends on the PDF resolvers actually populating `storage_path`
  for a given university (KAIST/Inha/KU/Yonsei now have resolvers). Until a
  university's PDF is resolved+stored, `storage_path` is null and the PDF
  button should stay hidden — that is correct, not a bug.
- The `min_row_confidence` column ships via migration
  `20260523150000_review_dashboard_min_row_confidence.sql` (apply it to the
  Supabase project before relying on the column).
