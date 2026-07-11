# Uni-DB: Reliability verification + human-approval gate

**Goal (2026-07):** before any auto-crawled guideline data is shown to staff, run
it through a multi-agent verification gauntlet; and publish **nothing** until a
staff member approves it. This is the reliability layer on top of the auto-crawl
(`auto-crawl-revival.md`).

Configured by three settings (`config.py`):

| env | default | meaning |
|---|---|---|
| `UNI_DB_VERIFY_LEVEL` | `maximum` | `off` / `balanced` / `thorough` / `maximum` |
| `UNI_DB_CONSENSUS_RUNS` | `3` | independent re-extractions at `maximum` |
| `UNI_DB_REQUIRE_APPROVAL` | `true` | every guideline waits in review_queue for a human |

## The gauntlet (code: `src/uni_db/verify/`)

Each guideline runs these gates; the result is a green/amber/red
`ReliabilityReport` attached to every review card.

| # | Gate | Technique | Where |
|---|---|---|---|
| 0 | **Identity** | a cheap model confirms it's *this* university's current *foreign-applicant* guideline (not a notice/tender/old year), AND a deterministic name cross-check | `agents.check_identity`, run by the finder before ingest |
| 1 | **Extraction** | per-field-group Claude extraction, only the schema fields, every value carries a verbatim source quote | existing `extract/` |
| 2 | **Grounding** | (a) deterministic: the quote must literally appear in the PDF; (b) LLM judge: does the quote support each value? | `checks.check_grounding_deterministic`, `agents.grounding_judge` |
| 3 | **Consensus** | N independent re-extractions must AGREE on the critical fields (dates, tuition, TOPIK, docs); disagreement → red | `checks.consensus` |
| 4 | **Critics** | 3 adversarial agents — accuracy, completeness, scope — try to break it | `agents.run_critics` |
| 5 | **Sanity** | deterministic: date order, tuition band, TOPIK 1–6, IELTS 0–9, cycle year | `checks.sanity_checks` |
| 6 | **Aggregate** | combine into green/amber/red | `engine.aggregate` |
| 7 | **HITL** | queue every guideline `open`; only staff Approve publishes | `parse_worker` (`require_approval`) |

**Colour policy** (`engine.aggregate`) — a guideline is **red** (do not publish
until fixed) when: identity rejected · a fabricated citation (quote not in the
PDF) · any high-severity critic issue · a non-unanimous consensus on a critical
field · a high-severity sanity violation. **Amber** for softer signals
(unsupported value, medium issue, cycle-year mismatch, low identity confidence).
**Green** when nothing tripped. Every guideline still requires human approval
regardless of colour; the colour tells the reviewer where to look first.

## The prompts

The verifier prompts live in `verify/prompts.py` (one place, so regressions show
up in review). All of them hard-forbid outside knowledge — a verifier may use
only the text it is shown — and demand strict JSON.

- **Identity** (`identity_prompt`): "strict admissions-document gatekeeper … decide
  ONLY whether this is the {year}학년도 foreign-applicant 모집요강 for {university} …
  if unsure, fail closed" → `{document_kind, matches_target_university,
  academic_year_in_doc, serves_foreign_applicants, is_old_or_superseded, …}`.
- **Grounding judge** (`grounding_judge_prompt`): "for every non-null field, decide
  whether the source span EXPLICITLY states that value … do not reward
  plausible-but-unstated values" → `{unsupported: [...]}`.
- **Accuracy critic** (`accuracy_critic_prompt`): "skeptical fact-checker … list
  EVERY value that is wrong or unsupported … default to flagging when uncertain".
- **Completeness critic** (`completeness_critic_prompt`): "list every REQUIRED item
  the source states but the extraction MISSED".
- **Scope critic** (`scope_critic_prompt`): "target = FOREIGN applicants … flag any
  row that belongs to a different applicant category / year / track".

The extraction prompt (`extract/prompt_assembler.py`) already requires
`source_text_ko` on every row — that per-value citation is what Gates 2/4 verify
against, and it's the backbone of the whole approach.

## Cost & models

Identity + grounding + critics use the cheap classify model
(`ANTHROPIC_MODEL_CLASSIFY`, e.g. haiku); consensus re-extraction uses the
extractor (`ANTHROPIC_MODEL_EXTRACT`, sonnet). At `maximum` a guideline is ~10–12
model calls; the deterministic gates (grounding-in-source, sanity, consensus
diff) are free and run at every level. Set a lower `UNI_DB_VERIFY_LEVEL` to trade
reliability for spend — the human-approval gate is independent of level.

## What a reviewer sees

Every content-bearing extraction is queued `open` with
`reviewer_notes = report.to_review_note()` — the colour, the failed gates, the
disagreeing values, the ungrounded quotes, and each critic's findings — plus the
existing per-field confidence and the source quote, and a link to the PDF. The
reviewer Approves / Edits / Rejects; only Approve lets `publish_worker` write the
data into the app's tables.

## Remaining wiring (needs live creds / DB / UI)

The engine + gates + prompts + full-HITL routing are code-complete and unit-tested
offline. Still to finish against a live project: surfacing the reliability report
in the CRM review screen (it currently rides in `reviewer_notes`; a dedicated
`review_queue.reliability jsonb` column + UI card is the follow-up), and a live
end-to-end run once the `ANTHROPIC_*`/`NAVER_*`/`SUPABASE_*` creds are set.
