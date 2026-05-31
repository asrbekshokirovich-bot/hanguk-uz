# ADR-004 amendment 2 — Vietnamese + Mongolian translation enabled

- **Status:** Accepted
- **Date:** 2026-05-10
- **Supersedes:** Phase 4 timing in
  [ADR-004](004-uzbek-translation-timing.md) and
  [ADR-004 amend 1](004-uzbek-translation-timing-amend-1.md) for vi+mn.

## What changed

ADR-004 originally placed Vietnamese and Mongolian translation in
Phase 4 (months 10–12), gated on Vietnamese and Mongolian
native-speaker reviewers being recruited.

The owner has now extended the same risk acceptance pattern from
ADR-004-amend-1 (which flipped Uzbek on without a native reviewer):
Vietnamese and Mongolian translations ship immediately, with the
existing in-office reviewer's HITL queue catching gross errors and
the "View original (한국어)" toggle remaining the safety valve.

## What is now in effect

* `services/uni_db/src/uni_db/config.py` —
  `translation_languages_enabled` default is `"en,uz,vi,mn"`.
* `services/uni_db/src/uni_db/translate/pipeline.py` —
  `DEFAULT_ENABLED_LANGUAGES = frozenset({"en", "uz", "vi", "mn"})`.
* `infra/env.example` — `UNI_DB_TRANSLATION_LANGUAGES=en,uz,vi,mn`.

Provider routing per ADR-004 unchanged:

| Target | Provider | Pivot |
|---|---|---|
| `en` | Claude (prose) / DeepL (labels) | direct |
| `uz` | Claude | ko → en → uz |
| `vi` | Papago | direct |
| `mn` | Claude | ko → en → mn |

Vietnamese gets a quality bump from direct Papago support; Mongolian
takes the two-hop pivot tax (-0.15 confidence).

## What we lose vs the original plan

Same trade-off as amend-1: native vi/mn reviewers would catch nuance
the in-office reviewer can't. Those errors will ship until cohort
growth justifies the recruit.

## How to revert per-language

To roll Vietnamese back: `UNI_DB_TRANSLATION_LANGUAGES=en,uz,mn`
(comma-separated). Same for Mongolian. Already-translated rows in
`public.translations` stay in place; the toggle only governs new
output.

## Pointer back

ADR-004 stays accepted on every other point — ko→target via the
documented provider chain, back-translation QC, glossary-locked
proper nouns. Only the gating clauses for vi+mn are amended here.
