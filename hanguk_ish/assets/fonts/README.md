# Fonts

The three families of the Claude Design prototype (2026-11-10), as static
files per weight so Flutter matches `font-weight` exactly.

| Family | Weights | Source | Licence |
|---|---|---|---|
| Inter | 400–900 | static Inter 4, copied from `hanguk_app/assets/fonts` | OFL-inter.txt |
| Noto Sans KR | 400–900 | google/fonts `ofl/notosanskr` variable font, instanced and subset by `tool/build_fonts.py` | OFL-notosanskr.txt |
| JetBrains Mono | 500–800 | google/fonts `ofl/jetbrainsmono` variable font, instanced by `tool/build_fonts.py` | OFL-jetbrainsmono.txt |

Noto Sans KR is subset to the 2 350 Hangul syllables of KS X 1001, every
syllable the prototype uses, compatibility jamo, Latin-1, CJK punctuation and
₩ — about 0.5 MB per weight instead of 10 MB. User-written Korean outside
KS X 1001 (rare syllables) falls back to the phone's system font.

Inter has no Hangul and no ₩; text styles list Noto Sans KR as the fallback,
the same order as the prototype's `font-family`.
