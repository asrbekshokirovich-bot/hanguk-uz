# documents_required field-group extraction prompt

Audit §5.3 row `documents_required[]` (difficulty 4). Strict JSON schema
= `DOCUMENTS_REQUIRED_SCHEMA`.

## Rules

- One row per `(applicant_category, document_type)`.
- `document_type` uses the canonical 15-item registry — see
  `lib/features/documents/domain/document_type.dart` (Flutter side, kept
  in sync). Examples: `transcript`, `diploma`, `passport`, `sop`, `lor`,
  `financial_proof`, `health_check`, `apostille_certificate`, etc.
  Capture the documents applicants frequently must submit even when they
  sit in a separate section: **Statement of Financial Resources /
  financial proof** (`financial_proof`), **Self-Introduction / Personal
  Statement** and **Study Plan** (`sop`), **recommendation letter**
  (`lor`), and **proof of citizenship / nationality** of the applicant
  and parents.
- `is_apostille_required`: true for foreign-issued docs in 95% of cases.
- `country_specific` is a JSON map keyed by ISO-3166 alpha-2:
  `{"CN":{"notarization":true},"UZ":{"consular":true}}`.
- `deadline` / `applies_to_round`: when the guideline gives a per-document
  or per-round submission deadline (e.g. a recommendation letter due on a
  different date than the application, or Early vs Regular rounds), set
  `deadline` (ISO date) and `applies_to_round` (e.g. `"early"`,
  `"regular"`). Leave `null` when a single global deadline applies.
- Preserve all footnotes verbatim in `notes_ko`. `notes_ko` is **Korean
  only** — never append an English translation, and never repeat the same
  list/sentence twice in one field.
