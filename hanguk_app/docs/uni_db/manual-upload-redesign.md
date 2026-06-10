# Uni-DB Redesign: Manual Upload → AI Extraction

**Decision (2026-06):** completely replace the automated scraping/discovery layer
with a **human-in-front** model: a staff member finds each university's current
admission-guideline PDF and uploads it; the system extracts every field and fills
the database. This deletes the brittle part (discovery/crawl/fetch/resolvers that
break whenever a site changes) and keeps the robust part (Claude reading PDFs).

## Why
- Per-site adapters/resolvers don't scale to 350+ changing sites; they break
  silently (the documented stall: green cron, `Total new=0`).
- The extraction (Claude on the PDF) was always the reliable half.
- A human picks the *right* PDF, so we also drop the "wrong source / 0 tuition"
  noise. No scraping = no anti-bot, no markup drift, no resolver maintenance.

## Keep / Cut / Build

| Keep (works) | Cut (brittle) | Build (new, small) |
|---|---|---|
| `institutions` + content tables (requirements, documents, scholarships, cycles, periods) | `discovery/` (adapters, registry, classifier, propose_source, change_detection) | **`upload-guideline`** edge fn ✅ (this PR) |
| Claude extraction: `parse_worker` → `extract_orchestrator` → `publish_worker` | `fetch_worker` + `parse/pdf_resolvers/*` (korea_univ/kaist breakage) | **Upload UI** `UniDbUploadContent` ✅ (this PR) |
| `review_queue` + needs-attention UI (fixed in #52) | `discovery_worker`; tables `announcement_sources` / `crawl_runs` / `crawl_findings` / `proposed_sources` (leave dormant) | **`uni-db-process-uploads`** workflow (reparse-pending → publish → translate) — next |
| `guideline_documents` + `guideline-blobs` bucket | `uni-db-sync.yml` + the 4 dead `uni-db-*` workflows | **Freshness/status** view + worklist column — next |
| `translations` + `translate_worker` | Naver discovery; the scheduler | (opt.) official-API pull for **tuition** (Academyinfo) |

## Flow
```
Staff uploads PDF ─▶ upload-guideline ─▶ guideline-blobs (storage)
                                       └▶ guideline_documents row (parse_status='pending')
                                                │
                                                ▼   (process-uploads job, no network)
                         reparse --pending-only → parse + Claude extract + validate
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          ▼                     ▼                       ▼
                    auto-publish (high conf)  needs_attention → review  translate (uz/ru/en/ko)
                          └───────────────── student app ──────────────┘
```
A manual upload creates **the same `guideline_documents` row the crawler used to
create**, so `parse → publish → translate` run unchanged. We swapped the *front
door*, not the house — ~80% reuse.

## The `upload-guideline` function (shipped)
- Auth: signed-in staff only (`owner/admin/document_handler/university_staff` via `user_roles`).
- Validates: PDF magic bytes (`%PDF`), ≤25 MB, institution exists.
- SHA-256 → upsert on `guideline_documents.file_hash_sha256` (idempotent; re-upload
  refreshes + re-queues). Stores in the private `guideline-blobs` bucket
  (service-role), rolls back the blob if the DB insert fails.
- Returns `{ guideline_document_id, parse_status: 'pending' }`.

## The Upload UI (shipped)
- `/crm/admin/uni-db-upload` (sidebar → Admin → "Upload PDFs", gated by
  `fn_can_review_uni_db`). Searchable institution list + per-row "Upload PDF".
- v1 has no per-university status column (avoids the internal-only RLS on
  `guideline_documents` from the client) — see fast-follow.

## Staff workflow — right-sized
Guidelines update **seasonally**, not daily. The daily job is a **worklist of
what's missing/stale**, not re-uploading 350 PDFs. Off-season = a few a day;
admission season = the push.

## What the human does vs the system
- **Human:** find the right PDF, upload it, fix flagged low-confidence fields.
- **System:** store, extract, validate, score confidence, auto-publish the
  confident rows, translate, and track freshness (so a missing/stale university is
  visible — the silent stall is structurally impossible here).

## Migration — phased
1. ✅ **Front door:** `upload-guideline` + Upload UI (this PR). Verify on a few unis.
2. ✅ **Extraction engine:** `.github/workflows/uni-db-process-uploads.yml` =
   `uni-db reparse --pending-only` → `uni-db publish` → translate (network-free
   subset of the old sync; every 30 min + manual dispatch). Turns a pending upload
   into published data. Added a `--pending-only` reparse mode that processes only
   never-parsed uploads and flips a broken PDF to `failed` so it isn't re-billed.
   Activates once on the default branch with the `UNI_DB_*` secrets set.
3. **Seed the worklist:** load the certified 350+ list (official registry).
4. **Delete the brittle layer:** remove discovery/crawl/fetch/resolvers +
   `uni-db-sync.yml` + the 4 dead workflows (pure dead-code removal once uploads work).
5. **Harden:** per-university freshness status, the (fixed) review queue,
   translation QC, and the **Academyinfo/data.go.kr API** for tuition/scholarships
   (guideline PDFs often omit tuition → today's `tuition=0`).

## Fast-follows (tracked)
- Status column on the upload list (security_invoker view over `guideline_documents`).
- Immediate trigger on upload (repository_dispatch) instead of the 30-min poll.
- Official-API ingestor for tuition/scholarships.
- Certified 350+ seed (the starter-100 is a working set, not the certified list).
