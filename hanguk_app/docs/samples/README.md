# Sample admission guidelines — archetype anchors

This folder is referenced from `UNIVERSITY_DB_AUDIT.md` §5.4.

Each `archetype-X-{university}.md` is a structured reference for one anchor university per archetype. The intent is:

1. During the audit, the agent did not have direct fetch access to `*.ac.kr` (egress allow-list constraint). These markdown files capture the **predicted page-count, section structure, parsing notes, and verification checklist** so that when the implementation phase has direct fetch access, the team can drop the actual PDF in next to this file (e.g. `archetype-A-snu.pdf`) and **verify or correct** the predictions.

2. They serve as **anchors for the canonical-fields catalog** (§5.3 of the audit). If a parsing strategy is being designed for, say, the "Top Seoul private brochure-style" archetype (Archetype B), the sample files give the engineering team a concrete starting point.

3. These files **do not contain copyrighted PDF prose** — only structural fingerprints, URLs, and what to verify. When PDFs are downloaded later, those PDFs are the universities' copyright; we record extracted *facts* in our DB but should not redistribute the PDFs themselves.

## Archetype map

| Archetype | Description | Anchor sample(s) |
|---|---|---|
| A | "SNU flagship" — long voluminous formal | `archetype-A-snu.md` |
| B | "Top Seoul private brochure-style" | `archetype-B-yonsei.md`, `archetype-B-korea-univ.md` |
| C | "Regional national plain table" | `archetype-C-pnu.md`, `archetype-C-knu.md` |
| D | "Faith-affiliated / mid-private" | `archetype-D-sogang.md`, `archetype-D-dongguk.md` |
| E | "Women's university" | `archetype-E-ewha.md` |
| F | "Specialized art/music/PE" | `archetype-F-knua.md` |
| G | "STEM specialized" | `archetype-G-kaist.md`, `archetype-G-unist.md` |
| H | "전문대 minimal" | `archetype-H-inha-tech.md` |

## Verification checklist (per sample)

When the actual PDF is dropped next to a sample reference:

- [ ] Page count matches predicted range
- [ ] Section ordering matches predicted ordering
- [ ] Recruitment-unit table is present in predicted section
- [ ] Calendar table format matches archetype prediction
- [ ] Tuition is embedded vs cross-referenced as predicted
- [ ] Scholarship section organization matches prediction
- [ ] Bilingual layout matches prediction (side-by-side / parallel docs / one-language-only)
- [ ] Appendix structure matches prediction
- [ ] Number of footnotes per quota table is in expected range
- [ ] Document-checklist section structure is parseable per the canonical fields catalog

## How parsers should consume this

Parsers should treat `archetype` as a routing parameter:

```text
extract_guideline(pdf, archetype) →
  switch archetype:
    A → snu_flagship_extractor
    B → top_seoul_brochure_extractor
    C → regional_national_plain_extractor
    D → faith_affiliated_extractor
    E → womens_extractor   # mostly inherits B's structure + adds gender field
    F → specialized_arts_extractor
    G → stem_specialized_extractor
    H → minimal_jeonmun_extractor
  default → ungrouped_llm_extractor
```

Each extractor gets the structural-fingerprint advantage; ambiguous fields fall through to the LLM extractor.
