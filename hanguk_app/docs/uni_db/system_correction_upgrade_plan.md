# Whole-system correction & upgrade plan (phased, plain language)

_Date: 2026-05-24. Based on the full review-queue QA (Inha, KAIST, Korea,
Yonsei). Builds on the earlier
[source-accuracy plan](./source_accuracy_remediation_plan.md) (shipped in
PR #19) and the [full-sync plan](./full_sync_and_automation_plan.md)._

## The one thing to understand first

Many problems in the report are **not new extraction failures** — they fall
into three buckets:

1. ✅ **Already fixed in code (just needs a re-run to show).** The four
   universities in the queue were processed back on May 14–17, *before* the
   fixes from PR #19 landed. So the old data still shows old problems
   (truncated text, Korean+English mashed together, flat confidence,
   "not specified" instead of "not required"). Re-processing them makes the
   fixes appear. **No code change — just re-run.**
2. 🌐 **Website's job (hanguk-uz).** What the reviewer *sees* — which link a
   button opens, which fields are shown, the "translating…" spinner, showing
   the same thing twice on screen. These were handed to the website team; the
   report shows they're not done/deployed yet.
3. 🆕 **Genuinely new backend bugs** to fix in this repo (empty items,
   duplicate items, wrong source for Korea, narrow-notice-as-track, hidden
   timeline data, shallow scholarship extraction).

The phases below are ordered by **what unblocks the human reviewer fastest**.

Legend: 🟦 this repo (backend) · 🌐 website (hanguk-uz) · 🔄 you run it.

---

## Ground rule for the whole system: Korean-first (never lean on English sites)

Always **search in Korean and read the Korean pages**. Searching in English,
or using a university's English website, fails two ways:

- it **misses parts** — English pages are usually thinner, summarised, or out
  of date versus the Korean original; and
- it **sometimes can't reach the site at all** — many English mirrors are
  broken, partial, or just redirect.

So every step — finding a university, following a link to a scholarship/guide
page, and showing the reviewer the source — must use **Korean search terms**
(e.g. `외국인 입학 공지`, `재외국민 모집요강`) and the **Korean source page**,
even when an English version exists. Treat the Korean page as the single
source of truth; only fall back to English to *supplement*, never to replace.

The system is already built this way — it rejects `/eng/` `/en/` `/english/`
URLs and searches Korean keywords — so this plan's job is to **keep and
enforce** that rule everywhere, especially in discovery, the new-university
probe, and link-following (Phases 4 and 6). Any new adapter, search, or probe
that targets an English page should be treated as a bug.

---

## Phase 1 — Make what the reviewer sees trustworthy & verifiable

_The #1 complaint: a reviewer can't check the data because the source links
don't lead to the real source, and the queue is cluttered with junk._

1. **Open the real source PDF, not a landing page.** 🟦🌐
   - Backend: make sure the actual guideline PDF is fetched & stored, and the
     view hands the website a real PDF link (this is the `storage_path` →
     signed-URL path; the PDF resolvers feed it).
   - Website: point "Open source PDF" at that link; "View source page" at the
     page. Hide the PDF button when there's no PDF.
2. **Fix Korea University's wrong source.** 🟦 Its stored source link is a
   one-sentence redirect page — the real data came from the fetched PDF.
   Investigate which document the data actually came from and store/show that.
3. **Stop empty items reaching the queue.** 🟦 Korea's blank "OTHER" item
   (empty `{}`) should be filtered out before a reviewer ever sees it (the
   empty-drop rule missed this shape — fix it).
4. **Stop showing the same thing twice.** 🟦 Inha shows the same 3 tracks as
   two items; Korea shows the same timeline twice. Guarantee **one open
   review item per (university, section)** — supersede the old one when a new
   extraction runs.
5. **Show the *lowest* confidence on the card, and the right labels.** 🟦🌐
   Backend already computes the lowest per-row confidence; the website should
   show that (not a flat average) and show **"Not required"** vs **"Source
   didn't specify"** as different things (the data already distinguishes them
   via `topik_status` etc.).

---

## Phase 2 — Refresh the data so the fixes already made show up 🔄

_Pure operational step — no new code._

Re-process the universities already in the system (Inha, KAIST, Korea,
Yonsei + the newly added ones) so the fixes that shipped in PR #19 take
effect on their data:
- truncated text gets re-fetched in full,
- Korean+English no longer mashed into one field,
- confidence reflects the weakest row,
- "not required" shows correctly.

How: re-run the sync (or a targeted re-extract). Also apply the pending
`min_row_confidence` view migration so the website can read that number.

**Expected result:** most of the report's "extraction quality" complaints
disappear on the four current universities without any further code.

---

## Phase 3 — Show ALL the data that was extracted (stop hiding it)

_Korea's timeline has 18+ dated events in the data, but the form shows
"Not specified" almost everywhere — the data is there, it's just not mapped
to the visible fields._

1. **Backend** 🟦: make the calendar extraction fill the labelled fields
   (application window, interview, results, fees) — today it stores a list of
   raw events but doesn't always populate the structured per-period fields the
   form reads.
2. **Website** 🌐: map every extracted field to the form; if a section has
   rich data, don't render it as blank.

---

## Phase 4 — Extract more completely & correctly

_The model under-extracts depth and sometimes files the wrong kind of post._

1. **Follow the one-click link to the real page — the Korean one.** 🟦 KAIST's
   350,000 KRW/month stipend, the 8-semester cap, and the 2.7 GPA rule are on
   the linked scholarship page — the crawler only read the notice excerpt.
   Teach it to follow to the canonical scholarship/tuition/guide page, and per
   the ground rule **follow the Korean page** (`/intl-undergraduate/...` KO,
   재외국민/외국인 모집요강), not the English mirror — the English page often
   omits exactly these numbers.
   (This is the previously-planned "sub-page crawl" — still pending.)
2. **Capture all of a university's tracks, not just one.** 🟦 Korea/Yonsei
   each have several international tracks; only one was captured.
3. **Don't file a narrow notice as a full "track."** 🟦 Yonsei's
   interview-day announcement was shipped as a complete "Admission track."
   Add a completeness check before queueing, and label partial items as
   "partial / needs more."

---

## Phase 5 — Fix the translation experience

1. **Translate once and store it.** 🟦🌐 Today translation re-runs on every
   click (5-second "translating…" wait, and different English wording each
   time). Pre-compute translations and store them so the screen is instant and
   stable. (Backend determinism already set to temperature 0; the remaining
   piece is pre-computing + joining the stored translation so the site never
   translates on the fly.)
2. **No language mash-ups or leftover placeholders.** 🟦🌐 Stop Korean+English
   being concatenated in one field (fixed for new extractions; old data clears
   on re-run), and stop "translating…" text leaking into the saved fields.

---

## Phase 6 — Complete coverage & add universities

1. **Fill the missing sections for everyone.** 🟦🔄 No university yet has a
   full profile (timeline + tracks + tuition + scholarships + documents).
   Combine Phase 4 depth + re-runs so each gets a student-ready profile.
2. **Keep onboarding universities — via the Korean board.** 🟦🔄 Continue the
   batch work (Chung-Ang + Kookmin are in; Sogang/Sejong/Dongguk/HUFS next via
   the probe loop). Per the ground rule, find each school by **Korean search**
   (`<학교명> 외국인 입학 공지`) and wire the **Korean** notice board — never
   the English admissions site, which is often incomplete or unreachable. The
   probe and discovery should reject English URLs the same way the existing
   adapters do.

---

## Who does what

| Area | Owner |
|---|---|
| Empty-item filter, dedup, Korea source fix, events→fields, sub-page crawl, track-completeness check, pre-computed translations | 🟦 this repo (me) |
| Source-link buttons, showing all fields, lowest-confidence + "not required" labels, instant/stable translation display, side-by-side source view | 🌐 hanguk-uz website |
| Re-running the sync, applying the view migration, approving paid re-extraction | 🔄 you |

## Suggested order

1. **Phase 1 (backend bits) + Phase 2 re-run together** — this clears the
   majority of the report's complaints on the four current universities and
   makes the queue verifiable. Biggest bang for the buck.
2. **Phase 3** — so reviewers see everything that's already extracted.
3. **Phase 4** — depth (the missing scholarship/track detail).
4. **Phase 5** — translation polish.
5. **Phase 6** — breadth (more universities, full profiles).

Cross-cutting: the 🌐 website items should go to the hanguk-uz session in
parallel — several report findings (source links, hidden fields, spinner,
labels) are display-only and won't move until that side ships. Worth checking
where that work stands.
