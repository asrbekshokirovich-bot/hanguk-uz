# shared glossary header

Every extraction prompt is composed of: `_common_glossary.md`
followed by the field-group-specific markdown. This file is loaded
once per process and prepended to the system message so the LLM always
has the same authoritative term mappings (plan §C.16, §P.3).

The glossary itself lives in the `term_glossary` table (see
[seed migration](../../../../../supabase/migrations/20260601000200_uni_db_v1_seed_term_glossary.sql)).
The Python loader pulls all `category='official_term'` rows where
`authoritative=true` and renders them into this prompt at startup.

## Render format

When invoked, this file is replaced at runtime with content like:

```
모집요강       → Admission Guidelines  (authoritative)
외국인전형     → Foreign Applicant Track (authoritative)
재외국민       → Overseas Korean (authoritative)
정정공고       → Notice of Correction (authoritative)
... (all term_glossary rows)
```

Tests use the static markdown body for stability.
