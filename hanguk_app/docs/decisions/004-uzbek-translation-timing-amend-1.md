# ADR-004 amendment 1 — Uzbek translation enabled without native reviewer

- **Status:** Accepted
- **Date:** 2026-05-08
- **Supersedes:** [ADR-004 §"Decision"](004-uzbek-translation-timing.md)
  partially — the strict "non-negotiable" coupling between Uzbek
  translation rollout and a native Uzbek-speaker reviewer is relaxed.

## What changed

Original ADR-004 deferred Uzbek translation to Phase 3 _and_ tied the
rollout to a native Uzbek-speaker reviewer in the HITL queue. The
project owner has now decided to ship Uzbek translation immediately
without recruiting that reviewer first, accepting the two-hop
ko->en->uz quality risk.

## What is now in effect

* `services/uni_db/src/uni_db/config.py` —
  `translation_languages_enabled` default is `"en,uz"`.
* `services/uni_db/src/uni_db/translate/pipeline.py` —
  `DEFAULT_ENABLED_LANGUAGES = frozenset({"en", "uz"})`.
* `infra/env.example` — `UNI_DB_TRANSLATION_LANGUAGES=en,uz`.
* The translation worker on the Hetzner VPS (when provisioned) will
  pick up the new default automatically; no per-host override needed.
* The owner-override is encoded as a project default rather than as
  an opt-in flag, so a fresh dev environment also produces Uzbek
  translations out of the box.

## Why this is acceptable to the owner

1. The pipeline still flags low-confidence translations for HITL
   review. The in-office reviewer (ADR-005) gets Uzbek rows in their
   queue alongside English; even non-native review catches gross
   errors (placeholder leaks, garbled text, wrong dates).
2. The "View original (한국어)" toggle (plan §P.4) is still the safety
   valve — a student who suspects the Uzbek translation can read the
   Korean original.
3. Counsellors verbally translate when a student asks. The Uzbek
   translation is meant to lower the threshold for self-service
   browsing, not to replace counsellor advice.
4. Shipping imperfect Uzbek now and improving it as the in-office
   reviewer learns the corpus is judged better than withholding it
   indefinitely.

## What we lose vs the original plan

* A native Uzbek-speaker reviewer would catch nuance and cultural
  framing errors that the in-office reviewer can't. Those errors will
  now ship to production until a native reviewer joins the rotation.
* Confidence scores on Uzbek output stay lower (the pipeline applies
  a 0.15 confidence penalty for pivoted languages — ADR-004
  unchanged on that point).

## How to revert

If feedback shows Uzbek output is causing real misunderstandings,
flip back to English-only by setting
`UNI_DB_TRANSLATION_LANGUAGES=en` on the worker host (or by reverting
this commit's config.py / pipeline.py changes). No data loss; the
already-translated rows in `public.translations` stay in place.

## Pointer back to ADR-004

The original ADR-004 stays accepted on every other point — Uzbek
needs a native reviewer eventually; the back-translation QC distance
threshold is unchanged; the pivot through English remains the
implementation strategy. Only the gating clause is amended here.
