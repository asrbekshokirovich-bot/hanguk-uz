# Translation glossary — locked-term spec

> Companion to [`PHASE_3_DESIGN.md` §1](PHASE_3_DESIGN.md#1-english-translation-worker).
> The translation worker MUST consult this glossary before invoking
> any LLM or NMT provider. Locked terms never get model-translated;
> they get substituted in via placeholder tokens.
>
> Status: spec only. Phase 3 implementation lands the
> `term_glossary` table and the `translate/glossary.py` lookup module.

## 1. Why a glossary at all

Two reasons:

1. **Quality.** Korean institution names ("연세대학교", "한국과학기술원")
   have official English forms ("Yonsei University", "KAIST") that
   the model gets right ~90% of the time and wrong the other ~10%.
   Wrong is unacceptable for an admission tool. A locked lookup is
   100%.
2. **Cost.** Per-token model spend on millions of repeated proper
   nouns is wasted budget. Pre-substitution skips the tokens entirely.

[ADR-001](../../docs/decisions/001-budget-ceiling.md) budgets ~$15/mo
for English translation under the internal-tool reframe. About half
that budget evaporates without a glossary because every page repeats
the same 50-100 proper nouns.

## 2. What lives in the glossary

| Category | Example KO | Example EN | Locked? |
|---|---|---|---|
| Institution full names | 서울대학교 | Seoul National University | yes |
| Institution short names | SNU, KAIST, POSTECH | (same) | yes |
| College / school names | 공과대학 | College of Engineering | yes |
| Department names | 컴퓨터공학과 | Department of Computer Science | yes |
| Program names | 글로벌 인재 양성 프로그램 | Global Talent Program | yes |
| Applicant categories | 외국인 전형, 재외국민 전형 | Foreign Applicant Track, Overseas Korean Applicant Track | yes |
| Document types | 학교생활기록부, 졸업증명서 | School Record, Graduation Certificate | yes |
| Standardised tests | 토픽, 토익, 토플 | TOPIK, TOEIC, TOEFL | yes |
| Scholarship program names | 한국어능력우수장학 | Korean Proficiency Excellence Scholarship | yes |
| Government agencies | 교육부, 한국대학교육협의회 (KCUE) | Ministry of Education, KCUE | yes |
| Currency / units | 원, 만원, 억원 | KRW, 10,000 KRW, 100,000,000 KRW | format-only |
| Honorifics / role titles | 총장, 학장, 교수 | President, Dean, Professor | yes |

Things that are **NOT** locked (let the model translate them):

- Free-prose scholarship narratives
- Free-prose requirement descriptions
- Free-prose admission philosophy statements
- Notes / footnotes / disclaimers in PDFs

The split is: **proper nouns + standardised vocabulary lock; everything
descriptive flows through the model.**

## 3. Schema (planned migration)

To be created by `20260701000000_uni_db_v3_translation_queue.sql`
(see PHASE_3_DESIGN.md §1.4) — the glossary lives in the same
migration as the translation queue.

```sql
create table public.term_glossary (
  id              uuid primary key default gen_random_uuid(),
  term_ko         text not null,
  term_en         text,
  term_uz         text,
  term_vi         text,
  term_mn         text,
  category        text not null check (category in (
    'institution_full',
    'institution_short',
    'college',
    'department',
    'program',
    'applicant_category',
    'document_type',
    'standardised_test',
    'scholarship_program',
    'agency',
    'role_title'
  )),
  source_type     text not null default 'manual' check (source_type in (
    'manual',                   -- entered by reviewer / engineer
    'kcue_official',            -- pulled from KCUE name lists
    'institution_canonical',    -- pulled from institutions.name_en
    'reviewer_correction'       -- HITL added after a model error
  )),
  locked          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (term_ko, category)
);

create index idx_term_glossary_term_ko on public.term_glossary
  using gin (term_ko gin_trgm_ops);
create index idx_term_glossary_category on public.term_glossary (category);

-- RLS: read for app users; write for reviewers + service role
alter table public.term_glossary enable row level security;
create policy term_glossary_read on public.term_glossary
  for select using (fn_is_app_user());
create policy term_glossary_write on public.term_glossary
  for all using (
    coalesce((select role from public.profiles where user_id = auth.uid()), 'student')
      in ('uni_db_reviewer', 'uni_db_admin')
  );
```

## 4. Lookup flow in the worker

`services/uni_db/src/uni_db/translate/glossary.py` (planned):

```python
def pre_substitute(source_ko: str) -> tuple[str, dict[str, str]]:
    """Replace every locked term in source_ko with a placeholder.

    Returns:
        (templated_text, placeholder_map)
        templated_text uses tokens like __GL_001__ in place of locked terms.
        placeholder_map maps each placeholder back to its target-language form
        (looked up by the caller for the right column, e.g. term_en).
    """

def post_substitute(translated: str, placeholder_map: dict[str, str]) -> str:
    """Replace placeholders in the model's output with the locked translations."""
```

Invariant: a locked term that appears in the source MUST round-trip
exactly through the placeholder. If `__GL_017__` is missing from the
model's output, treat the whole translation as failed and re-queue.

### 4.1 Tokenisation strategy

Naive substring match is wrong: "한국과학기술원" is a substring of
"한국과학기술원 부설 영재고등학교" (Korea Science Academy of KAIST).
We want to lock the longer match.

The lookup module:

1. Loads all glossary rows into memory at worker start (cache-friendly,
   the table will stay in the low thousands of rows for years)
2. Sorts by `length(term_ko) DESC` so the longest match wins
3. Walks the source greedy left-to-right, replacing matches with
   `__GL_NNN__` placeholders
4. Records the placeholder → target-translation mapping for
   post-substitution

If a glossary row has `term_en IS NULL`, we don't substitute — fall
through to the model. (This is normal during glossary build-out for a
new language.)

## 5. Adding terms

Three ways a new term lands in `term_glossary`:

### 5.1 Manual seed (Phase 3 launch)

Engineering pre-loads ~500 terms from:

- `institutions.name_ko` / `.name_en` for all 110 priority universities
- KCUE's official college list (publicly available, free)
- `applicant_category` enum values (a fixed handful)
- `document_type` enum values (likewise)
- TOPIK / TOEFL / TOEIC + variants

Lives in `supabase/migrations/20260701000100_uni_db_v3_seed_term_glossary.sql`.

### 5.2 Reviewer correction during HITL

When the in-office reviewer (per ADR-005) catches a translation
hallucinating a proper noun, the `/admin/review` route's edit flow
includes an **"Add to glossary"** action: the reviewer enters the
correct EN form, and the system writes a row with
`source_type='reviewer_correction'`.

This path is the dominant source of long-tail entries — institutions
whose canonical English name doesn't match what the model guesses.

### 5.3 Crawler-derived

When the discovery worker pulls a new institution, it auto-inserts a
glossary row keyed off `institutions.name_ko` → `name_en`. These get
`source_type='institution_canonical'` and are reviewer-editable later.

## 6. Confidence interaction

Per `PHASE_3_DESIGN.md` §1.2, every model translation runs through
back-translation QC: en→ko via the same provider, then similarity
score against the original Korean.

**Glossary substitutions skip back-translation.** They're known-good
by definition. The QC pass operates on the templated text (with
placeholders intact); placeholders are treated as identity strings on
both sides.

This is important for cost — back-translation roughly doubles
per-prose tokens, and glossary substitutions are zero-cost.

## 7. Glossary review cadence

| Cadence | Action | Owner |
|---|---|---|
| Weekly | Reviewer skims `term_glossary` rows added in the past 7 days; flags duplicates / typos | In-office reviewer |
| Monthly | Engineering audits `term_glossary` for `term_en IS NULL` rows that were added > 30 days ago — chase the missing translations | Eng |
| Per-cohort | When a new applicant cohort lands (e.g. Vietnamese students), seed `term_vi` for the existing rows | Engineering + native reviewer |
| As-needed | `source_type='reviewer_correction'` rows that fire repeatedly (>5 hits/month in the lookup) get reviewed for correctness | Eng |

## 8. Conflict resolution

Two glossary rows can disagree (e.g. "고려대학교" → "Korea University"
vs "Korea Univ."). Resolution rule:

1. `source_type='manual'` rows entered by an engineer or reviewer win
   over auto-inserted rows
2. Among manual rows, the most recently `updated_at` wins
3. `source_type='kcue_official'` is the tiebreaker for institution
   names — KCUE's canonical English form is authoritative

Implementation: the unique constraint `(term_ko, category)` already
prevents true duplicates. Conflicts manifest as an attempted
duplicate-key INSERT, which the writer rolls back to an UPDATE that
respects the precedence rules above.

## 9. Test expectations

`services/uni_db/src/uni_db/translate/tests/test_glossary.py` (planned):

```python
def test_pre_substitute_basic():
    """A single locked term is replaced with a placeholder."""

def test_pre_substitute_longest_match_wins():
    """When two terms overlap, the longer one is matched first."""

def test_pre_substitute_no_match():
    """Source with no locked terms passes through unchanged."""

def test_post_substitute_round_trip():
    """A pre-substituted then post-substituted string equals the
    target-language replacement of every locked term."""

def test_post_substitute_missing_placeholder_raises():
    """If the model dropped a placeholder, the worker raises
    GlossaryRoundTripError."""

def test_glossary_loads_only_locked_rows():
    """Rows with locked=false are not substituted (they fall through
    to the model)."""

def test_glossary_skips_null_target_lang():
    """Rows where term_en IS NULL don't substitute when target_lang='en'."""
```

7 tests for the glossary module. Counted into the ~45-test Phase 3
budget per `PHASE_3_DESIGN.md` §8.

## 10. Out of scope

- **Stemming / lemma matching.** Korean is morphologically rich, but
  the canonical forms of institution names and document types appear
  consistently across PDFs. We don't need stemming for proper nouns;
  the long-tail use case (matching "고려대학교의" → "고려대학교 + 의")
  is descriptive prose and stays with the model.
- **Hangul ↔ Hanja mapping.** Old PDFs sometimes write 大學校 instead
  of 대학교. We could normalise at ingestion, but the volume is
  rounding-error-low and HITL catches it.
- **Translation memory (Trados-style fuzzy match).** Out of scope for
  Phase 3. If the cost data shows the back-translation QC is the
  dominant spend item, a TM cache becomes a Phase 4 candidate.
