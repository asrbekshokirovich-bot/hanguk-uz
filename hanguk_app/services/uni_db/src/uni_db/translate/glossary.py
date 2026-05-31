"""Glossary-aware lookup that bypasses MT.

Plan §P.3: institution names and 외국인전형-class official terms must
never be machine-translated naively. They live in `term_glossary` with
authoritative=true and we look them up before any LLM/Papago/DeepL call.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping

from .models import TargetLang


@dataclass(frozen=True, slots=True)
class GlossaryHit:
    term_ko: str
    term_value: str
    category: str


# In-process cache populated from the term_glossary table at worker startup.
# Tests pass a dict directly so they don't need a DB.
GlossaryCache = Mapping[tuple[str, TargetLang], GlossaryHit]


def lookup(
    cache: GlossaryCache,
    *,
    term_ko: str,
    target_lang: TargetLang,
) -> GlossaryHit | None:
    return cache.get((term_ko, target_lang))


def apply_glossary_pre_translate(
    text: str,
    *,
    cache: GlossaryCache,
    target_lang: TargetLang,
) -> tuple[str, list[GlossaryHit]]:
    """Return (text_with_terms_pinned, hits).

    Strategy: longest-match first to avoid '서울대' eclipsing '서울대학교'.
    For each pinned term we substitute a placeholder `⟪G:N⟫` so the
    downstream MT call doesn't touch it; the placeholder map is returned
    so callers can re-substitute the authoritative target after MT.
    """
    candidates = sorted(
        ((k, v) for (k, lang), v in cache.items() if lang == target_lang),
        key=lambda kv: len(kv[0]),
        reverse=True,
    )
    hits: list[GlossaryHit] = []
    out = text
    for term_ko, hit in candidates:
        if term_ko in out:
            # Use the post-translate index (== len(hits) at point of match)
            # so apply_glossary_post_translate's enumerate(hits) lines up.
            out = out.replace(term_ko, f"⟪G:{len(hits)}⟫")
            hits.append(hit)
    return out, hits


def apply_glossary_post_translate(
    text: str,
    hits: list[GlossaryHit],
) -> str:
    """Restore pinned glossary terms after MT.

    The placeholder is `⟪G:N⟫`, but MT — especially the ko→en→uz two-hop —
    mangles it: swapping ⟪⟫→⟨⟩, adding spaces, even emitting a literal "N". An
    exact `str.replace` then misses and the token leaks into titles (the
    ⟨G:0⟩ / ⟨G:N⟩ artefacts seen in stored Uzbek/English titles). So match the
    index tolerantly across bracket/space variants, then strip any residual or
    lost-index placeholder so it can never surface to a user.
    """
    def _restore(match: re.Match[str]) -> str:
        index = int(match.group(1))
        return hits[index].term_value if 0 <= index < len(hits) else ""

    out = _PLACEHOLDER_INDEXED.sub(_restore, text)
    out = _PLACEHOLDER_RESIDUAL.sub("", out)         # garbled / lost-index → drop
    return re.sub(r"[ \t]{2,}", " ", out).strip()


# ⟪G:0⟫ and its MT-mangled forms (single brackets ⟨⟩, guillemets «», stray
# spaces, full-width colon). _INDEXED captures a real index; _RESIDUAL clears
# anything placeholder-shaped left over (e.g. a literal "N").
_PLACEHOLDER_INDEXED = re.compile(r"[⟪⟨«]\s*[Gg]\s*[:：]?\s*(\d+)\s*[⟫⟩»]")
_PLACEHOLDER_RESIDUAL = re.compile(r"[⟪⟨«]\s*[Gg]\s*[:：]?\s*[A-Za-z0-9]*\s*[⟫⟩»]")


def contains_placeholder_residue(text: str) -> bool:
    """True if any glossary-placeholder artefact (including the MT-mangled
    bracket/space variants) survives in `text` — a post-translation safety net."""
    return bool(_PLACEHOLDER_INDEXED.search(text) or _PLACEHOLDER_RESIDUAL.search(text))
