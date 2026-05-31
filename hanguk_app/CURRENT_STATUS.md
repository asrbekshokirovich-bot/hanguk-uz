# CURRENT_STATUS — read-only audit, 2026-05-07

> Snapshot of where the Hanguk repo + Korean university DB project stands
> right now, taken directly from the working tree and `.git/` (the bash
> sandbox was unavailable for this audit, so everything below is from
> `Read`/`Glob`/`Grep` against the file tree).
>
> Reference points from previous sessions:
> - Phase 0 commit `13f52ec` on `claude/vigorous-haibt-f28e2d`
> - Phase 1 commit `212f578` on the same branch
>
> Anything ambiguous is tagged **(needs user confirmation)**.

---

## 1. Branches and worktree state

### Facts

Loose refs and per-worktree HEADs read from `.git/refs/heads/` and
`.git/worktrees/*/HEAD`:

| Ref | Commit | Where it lives |
|---|---|---|
| `refs/heads/main` | `c6c8d47` | top-level checkout `C:\Users\User\Desktop\Hanguk\` |
| `refs/remotes/origin/main` | `c6c8d47` | (in sync with local main) |
| `refs/heads/claude/vigorous-haibt-f28e2d` | **`83cc097`** | worktree `.claude/worktrees/vigorous-haibt-f28e2d/` — **Phase 0/1 + 4 follow-ups** |
| `refs/heads/claude/angry-almeida-fe9d21` | `c6c8d47` | worktree `.claude/worktrees/angry-almeida-fe9d21/` (already merged into main) |
| `refs/heads/claude/quirky-taussig-671986` | `c6c8d47` | worktree exists, no branch progress |
| `refs/heads/claude/infallible-hofstadter-868266` | `43382a5` | older worktree, predates Phase 0 base |
| `refs/heads/claude/youthful-shannon-0b1dc4` | `c6c8d47` | branch exists, no commits past base **(needs user confirmation — when/why was this branch created?)** |
| `refs/remotes/origin/claude/angry-almeida-fe9d21` | `43382a5` | only remote-tracking claude branch; lags behind local |

### Inference

- `main` is unchanged since Phase 0/1 work began. Nothing from
  `vigorous-haibt-f28e2d` has been merged into it yet.
- Phase 0/1 work and all four follow-up commits live exclusively on
  `claude/vigorous-haibt-f28e2d`, which is **not** pushed to origin.
- A new branch `claude/youthful-shannon-0b1dc4` was created (no
  commits) — **(needs user confirmation)** about its intent.

---

## 2. Commits since Phase 1 (`212f578`)

### Facts

From `.git/worktrees/vigorous-haibt-f28e2d/logs/HEAD`, four commits
landed on the Phase 0/1 branch after `212f578`, all on 2026-05-07
(today, in roughly two-hour gaps):

| # | SHA | Subject | UTC time |
|---|---|---|---|
| 1 | `9cfcce7` | `fix(uni_db): clear Phase 0/1 analyzer warnings` | 2026-05-07 05:16 |
| 2 | `65479df` | `fix(uni_db): six bugs surfaced by first real pytest run` | 2026-05-07 06:11 |
| 3 | `9a8830c` | `feat(uni_db): deploy Phase 0+1 to staging Supabase + smoke-test` | 2026-05-07 08:39 |
| 4 | `83cc097` | `docs(uni_db): record §O answers as ADRs 001–010` | 2026-05-07 13:32 |

### Inference

- The user spent a full work-day on this branch today, going from
  Phase 1 scaffolding → analyzer-clean → first real pytest pass → live
  staging deploy → all ten §O questions converted to ADRs.
- No commit since `212f578` touches main — the branch is a clean
  forward chain on top of Phase 1.
- Commit (3) is the most consequential: it claims the migrations were
  pushed to a real Supabase staging project and smoke-tested. §3 below
  corroborates this with on-disk evidence.

---

## 3. Working-tree state right now

### Facts — main checkout (`C:\Users\User\Desktop\Hanguk\`)

`main` is at `c6c8d47`, but the working tree contains **uncommitted**
files that are not in that commit:

- `UNIVERSITY_DB_AUDIT.md` (root)
- `UNIVERSITY_DB_BUILD_PLAN.md` (root)
- `INTERVIEW_QA_REPORT.md` (root) — dated 2026-05-06
- `docs/samples/README.md` + 12 archetype anchor files
  (`archetype-A-snu.md` through `archetype-H-inha-tech.md`)
- `flutter_run.log` (most recent run 2026-05-06 20:03)
- `pubspec.yaml`: a `pointycastle: ^3.9.1` line was added under
  `dependency_overrides:` with comment "QA fix 2026-05-06: …"
- `pubspec.lock`: `pointycastle: dependency: "direct overridden"`,
  resolved to a 3.x version (the override took effect)
- No `services/` directory in main checkout
- No `lib/features/uni_db/`, no `lib/core/feature_flags/`

### Facts — worktree `vigorous-haibt-f28e2d`

This is the active branch (`claude/vigorous-haibt-f28e2d` at
`83cc097`). Every Phase 0/1 file is committed here:

- `services/uni_db/` populated with ~70 source files (plus a
  populated `.venv/` and `.pytest_cache/`)
- `supabase/migrations/` has the original 6 baseline files PLUS 18
  uni_db migrations (see §5)
- `lib/features/uni_db/` exists with 15 dart files
- `lib/core/feature_flags/uni_db_flag.dart` (default `false`)
- `docs/decisions/` 11 files (README + ADRs 001–010)
- `docs/credentials.md`
- `services/uni_db/PHASE_1_NOTES.md`
- **`supabase/.temp/`** with 9 CLI-generated artifacts indicating an
  active Supabase link (see §6)
- `pubspec.yaml` `dependency_overrides:` has only `freezed_annotation`
  and `vapi` — **no `pointycastle` override here.** This is a
  divergence from main's working-tree fix.

### Inference

- The user is doing the uni_db work in the worktree, and unrelated
  QA / sample-curation work in the main checkout. The two trees are
  conceptually independent right now.
- Main's working tree carries an unfinished QA-fix story:
  `pointycastle 3.9.1` override + Phase 0/1 design docs + 12
  archetype anchor samples, none committed.
- The `pointycastle` override in main pubspec.yaml/lock has **not been
  ported into the Phase 0/1 worktree**. Either (a) the worktree's
  pub-resolution doesn't trip the same `dart_jsonwebtoken` ↔
  `pointycastle 4.0.0` clash because the lockfile resolves earlier, or
  (b) the worktree will fail the same way the next time someone runs
  `flutter pub upgrade` there. **(needs user confirmation)** before
  flipping `UNI_DB_ENABLED=true` from the worktree.

---

## 4. The `services/uni_db/` Python service

### Facts

- ~70 `.py` files under `src/uni_db/`, ~25 test files (unit +
  integration + 8-archetype fixtures)
- `.venv/` exists with pinned versions (numpy 2.4.4, pymupdf 1.27.2,
  anthropic SDK installed, httpx, respx, pytest, mypy, ruff)
- `.pytest_cache/` exists — pytest has been run at least once
- `Makefile` provides `install / lint / typecheck / test / review-digest`
  targets
- `src/uni_db/extract/llm_anthropic.py` still contains
  `raise NotImplementedError(...)` in `_call_anthropic` — the live
  Anthropic call site is wired but not implemented
- `src/uni_db/parse/ocr_naver_clova.py` still contains
  `raise NotImplementedError(...)` for the live path — but this is
  intentional per ADR-002 (see §7)
- `PHASE_1_NOTES.md` describes the diff between Phase 0 and Phase 1
  (archetype dispatcher, prompt assembler, cost estimator, Korean
  date/number/table parsers, HITL views, reviewer assignment, Markdown
  digest, Flutter integrations, end-to-end test)
- README still says "Phase 0 status (2026-05-07). Scaffolded. No live
  API calls; no live crawls; no live DB writes" — and lists 14
  migrations, but the migrations folder now has 18 (see §5).

### Inference

- The Python service is in much better shape than after Phase 1: it
  now has an actually-tested archetype classifier, prompt assembler,
  and end-to-end pipeline test fixtures for archetypes A–H.
- "Six bugs surfaced by first real pytest run" (commit 2) means the
  test suite was actually executed — the `.pytest_cache` and `.venv`
  on disk are consistent with that.
- The `services/uni_db/README.md` is now slightly stale (it counts 14
  migrations and predates the four review-decisions / view migrations
  added on 20260605). **(low-priority doc lag, not blocking.)**
- Anthropic and Naver Clova OCR call sites remain `NotImplementedError`
  — this is **expected**: ADR-002 chose EasyOCR over Clova, and
  Anthropic live calls are gated on owner sign-off + the
  `UNI_DB_LIVE_APIS` flag, neither of which has been activated.

---

## 5. Supabase migrations

### Facts

Worktree `supabase/migrations/` contains 24 SQL files:

- 6 pre-existing baseline files (`20260505*` and `20260506*`) — the
  ones that were already in `main` before Phase 0
- 1 baseline placeholder `00000000000001_lovable_baseline.sql`
- 13 Phase 0 `20260601*_uni_db_v1_*` migrations (institutions →
  legacy_compat → seeds)
- 4 Phase 1 `20260605*_uni_db_v1_*` migrations
  (review_decisions, review_views, reviewer_assignment,
  recent_changes_view)

The placeholder file:

- File **was renamed** from `00000000000001_lovable_baseline.sql.PLACEHOLDER`
  to `00000000000001_lovable_baseline.sql` (no extension) — but the
  contents are still the **temporary stand-in** from Phase 0, not a
  real `supabase db dump`. The file's own header explicitly says:
  "TEMPORARY STAGING BASELINE … TO COMPLETE before any production
  deployment".

Main checkout `supabase/migrations/` has only the original 6 files.
No uni_db migrations there.

### Inference

- The user kept the placeholder file's contents but stripped the
  `.PLACEHOLDER` suffix so the Supabase CLI would actually pick it up
  as a migration (it ignores files with non-`.sql` extensions). This
  is consistent with running `supabase db push` against staging — and
  it's why staging was OK (the placeholder is a self-contained
  `create extension` + `create table profiles if not exists`), but
  it's still **not safe for production** because it doesn't reflect
  the actual production schema.
- 18 uni_db migrations now (matches §A "Phase 0 = 14 + Phase 1 = 4 =
  18" — exactly the 18 the prior prompt expected).
- No new migrations beyond Phase 1's four. Phase 2 work has not
  started in this folder.

---

## 6. Live Supabase linkage

### Facts

`supabase/.temp/` exists in the worktree (NOT in main) with these
artifacts:

| File | Contents |
|---|---|
| `project-ref` | `nhjzbjzhmugcmzchzxlv` |
| `linked-project.json` | `{"ref":"nhjzbjzhmugcmzchzxlv","name":"hanguk-staging","organization_id":"yhlbxgfpdydghudipzfk","organization_slug":"yhlbxgfpdydghudipzfk"}` |
| `pooler-url` | `postgresql://postgres.nhjzbjzhmugcmzchzxlv@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres` |
| `postgres-version` | `17.6.1.113` |
| `cli-latest` | `v2.98.2` |
| `gotrue-version`, `rest-version`, `storage-version`, `storage-migration` | present |

No `supabase/config.toml` and no `supabase/.branches/`.

No `.env` files anywhere in the worktree (only `.env.example` under
`services/uni_db/`). One `.env` exists in a different worktree
(`infallible-hofstadter-868266`), unrelated to uni_db.

### Inference

- **The user successfully linked the Supabase CLI to a real staging
  project** named `hanguk-staging` (ref `nhjzbjzhmugcmzchzxlv`),
  hosted in `ap-northeast-2` (Seoul) — matching ADR-010's data
  residency decision.
- The `postgres-version` and `*-version` files are populated with
  real values Supabase only returns over a live connection, so the
  `supabase link` succeeded against a reachable backend.
- Combined with commit `9a8830c` ("deploy Phase 0+1 to staging
  Supabase + smoke-test"), this is strong evidence that **the 18
  uni_db migrations are now applied on `hanguk-staging`.**
- **Production has not been linked.** No `prod` project-ref file, no
  `.branches/` directory. ADR-010 mentions a separate production
  project also in Seoul, but the CLI here is currently pointed at
  staging only.
- No `.env` file at the repo root for the Flutter side either —
  Supabase URL/anon are still hardcoded in `AppConfig`/`main.dart`
  per the QA report's S5 finding.

---

## 7. The `§O` open-questions list — closed

### Facts

`docs/decisions/` (worktree only) contains:

- `README.md` indexing the 10 ADRs
- ADRs 001–010, all `Status: Accepted` (or "Skipped / deferred" for
  008), all dated 2026-05-07

| ADR | Decision |
|---|---|
| 001 — Budget | Accept $300/mo steady, $960/mo burst (with internal-tool reframe to ~$30–80/mo) |
| 002 — OCR vendor | **EasyOCR** (open-source) — not Naver Clova |
| 003 — Crawler placement | **Hetzner VPS CX22** (Helsinki/Falkenstein), provisioned in Phase 2 |
| 004 — Uzbek translation | Stay at **Phase 3** with a native Uzbek-speaker reviewer |
| 005 — HITL reviewer #2 | **In-office** worker, TOPIK 4+, ~10 h/week |
| 006 — `is_partner` flag | **Keep separate** from recruitment data |
| 007 — Premium tier | **Internal-only**, no public discovery, no $4.99 tier — the system is for contracted Hanguk students only |
| 008 — Counselor mode | **Deferred** (Hanguk staff are the counselors) |
| 009 — PDF blob access | **Cached PDFs accessible** to authenticated app users via 15-minute signed URLs (Supabase Storage, not R2 — cost-driven shift per ADR-007) |
| 010 — Data residency | **Seoul (ap-northeast-2) confirmed** for prod and staging Supabase |

### Inference — this is the biggest unblock since Phase 1

- ADR-007 (internal-only) has wide downstream effects that PHASE_1_NOTES
  doesn't yet reflect: it suspends Plan §J unit-economics, defers
  Plan §K (counselor partnership), and makes the cost ceiling much
  lower than originally sized.
- ADR-002 changes the OCR plan from a budgeted $80/mo Clova
  integration to free EasyOCR. The current
  `parse/ocr_naver_clova.py` stub stays, but Phase 2 should land a
  new `parse/ocr_easyocr.py`.
- ADR-009 changes the storage plan from Cloudflare R2 to **Supabase
  Storage** (`guideline-blobs` bucket) — saves a vendor and matches
  ADR-010's Seoul residency.
- ADR-007 + ADR-008 together make the "counselor mode" branch in
  ADR-006/008 dead-letter for now; only `uni_db_reviewer` and
  `student` roles matter operationally.

`PHASE_1_NOTES.md` still lists §O as unresolved ("…Phase 1 didn't get
any answers…"); that note is now stale and should be regenerated to
reflect ADRs 001–010.

---

## 8. Flutter app side

### Facts

`lib/features/uni_db/` (worktree) contains 15 files:

```
data/uni_db_providers.dart
data/recent_changes_provider.dart
domain/institution_summary.dart
domain/upcoming_deadline.dart
domain/recruitment_target.dart
domain/recent_change.dart
presentation/institution_detail_screen.dart
presentation/institution_compare_screen.dart
presentation/application_tracker_screen.dart
presentation/notification_settings_screen.dart
presentation/widgets/coming_soon_card.dart
presentation/widgets/verified_deadline_card.dart
presentation/widgets/verified_deadlines_overlay.dart
presentation/widgets/home_recent_changes_banner.dart
presentation/widgets/university_specific_cta.dart
```

Cross-cutting integrations (worktree):

- `lib/features/applications/presentation/applications_tab.dart` —
  imports and renders `HomeRecentChangesBannerSliver` and
  `VerifiedDeadlinesOverlaySliver` as slivers above the user's free-text
  applications list. Both render `SizedBox.shrink()` when the flag is
  off.
- `lib/features/training/presentation/widgets/interview_setup_view.dart`
  — imports and renders `UniversitySpecificSetupAddon` when the user
  picks `university_specific` session type, otherwise renders nothing.
- `lib/core/router/app_router.dart` — registers the four uni_db routes
  conditionally: `if (kUniDbEnabled) ..._uniDbRoutes()`.

`lib/core/feature_flags/uni_db_flag.dart`:

```dart
const bool kUniDbEnabled = bool.fromEnvironment(
  'UNI_DB_ENABLED', defaultValue: false,
);
```

Several screens (`institution_detail_screen.dart`,
`application_tracker_screen.dart`) still render `ComingSoonCard`
when the data is empty — the empty-state copy says "Phase 1 lights
up the cycle-aware tracker" / "Per-institution detail wires up in
Phase 2".

### Inference

- The Flutter side IS wired up to the Phase 1 widgets, but they all
  short-circuit when `kUniDbEnabled=false` (the default). Production
  Chrome/web build behaviour is unchanged.
- The "Coming soon" stubs are intentionally not yet built out for the
  per-institution detail and tracker screens — those are
  Phase 2 deliverables.
- The `university_specific` interview path is now wired, gated by the
  same flag, and falls back to "Try general interview" if no
  recruitment data is verified yet — matching PHASE_1_NOTES §H.4.

---

## 9. Build / run state

### Facts

- `pubspec.yaml` version is `1.0.18+2031` (worktree and main, both
  unchanged)
- Main `pubspec.lock` has `pointycastle: dependency: "direct overridden"`
  — fix from `INTERVIEW_QA_REPORT.md` is in effect on main
- Worktree `pubspec.lock` has `pointycastle: dependency: transitive,
  version: "4.0.0"` — the override is **not** present here
- `flutter_run.log` (main only) shows a successful Chrome web build on
  2026-05-06 20:03, with `PUB_CACHE=D:\pub_cache` and
  `TMP=D:\flutter_temp` env overrides — the C-drive-full /
  D-drive-relocation workaround from the QA report is still active in
  the main shell environment
- The web app booted, Supabase init logged, then logged "user is null,
  returning empty list" twice — auth gate kept the user on the welcome
  screen
- No `flutter_run.log` in the worktree

### Inference

- Main is **buildable** today (Chrome web demonstrably booted on
  2026-05-06). The pointycastle/dart_jsonwebtoken P0 from the QA
  report is resolved on main.
- The worktree may or may not build cleanly today. If `flutter pub
  upgrade` is run there, it will resolve `pointycastle 4.0.0` and hit
  the same compile-time clash. **(needs user confirmation — does the
  worktree's `dart analyze` / `flutter test` pass?)** Commit
  `9cfcce7` is "clear Phase 0/1 analyzer warnings" so analysis must
  have run at least once on the worktree, but build/test status is
  not directly visible from disk.
- The D-drive relocation appears to be a per-shell environment
  variable rather than a system-wide install change. The C-drive
  capacity issue is **not** resolved at the OS level — only worked
  around for one shell.

---

## 10. Deltas in unrelated areas

### Facts

- `lib/features/applications/`: ~10 dart files, the only Phase 0/1
  modification is the import + sliver insertion in `applications_tab.dart`.
  No new providers or routes specific to applications.
- `lib/features/training/`: ~15 dart files, only modification is the
  `UniversitySpecificSetupAddon` insertion in `interview_setup_view.dart`.
- No new top-level directories beyond `services/`, `docs/decisions/`,
  and `docs/samples/` (latter is uncommitted in main only).
- No `infra/`, no `scripts/`, no `tools/` directory created.
- `pubspec.yaml` deps unchanged in worktree apart from
  `dependency_overrides` exclusion of pointycastle.

### Inference

The Phase 0/1 branch is admirably narrow in scope: the only
non-uni_db files it touches are two integration sites
(`applications_tab.dart` and `interview_setup_view.dart`) and the
router. Everything else is additive, behind the flag.

---

## 11. Open-questions / decisions log

### Facts — answer artifacts

The §O answers live in `docs/decisions/001-*.md` … `010-*.md`
(worktree only). No `OPEN_QUESTIONS_ANSWERS.md`, no
`DECISIONS_LOG.md`, no `KICKOFF.md` exists anywhere.

ADR-001 carries the most consequential reframe: §J's $300/mo budget
is now **suspended** at the unit-economics level because of ADR-007
(internal-only). Realistic monthly burn is reframed as $30–80.

`docs/credentials.md` (worktree only) is the run-list for activating
each integration. It is **un-edited** since Phase 1 — no completion
checkmarks.

### Inference

- The §O blockers from PHASE_1_NOTES are formally answered. Phase 2
  work can start.
- `docs/credentials.md` has not been touched since being written, so
  no live API keys appear to have been wired into a `.env` (and
  there's no `.env` next to `.env.example` to inspect).
- ADR-007's "internal-only" reframe means the §J budget math, the
  Plan §K customer-success FTE plan, and the Phase 4/5 public-API
  + counselor-mode roadmap are all officially deferred — Phase 2's
  scope shrinks accordingly.

---

## ✅ Confirmed completed since Phase 1

Direct disk evidence:

1. **Analyzer-clean Phase 0/1.** Commit `9cfcce7`. (no on-disk
   artifact, but the message + timestamp are in
   `.git/worktrees/.../logs/HEAD`).
2. **Pytest suite executed.** Commit `65479df` plus on-disk
   `.pytest_cache/` and a populated `.venv/` under
   `services/uni_db/`. Six bugs were apparently fixed in that pass.
3. **Supabase CLI linked to `hanguk-staging` (ref
   `nhjzbjzhmugcmzchzxlv`, Seoul region).** `supabase/.temp/` files
   carry Postgres 17.6.1.113 and CLI v2.98.2 — values only obtainable
   from a live connection.
4. **Phase 0+1 migrations applied to staging (high confidence).**
   Commit `9a8830c` says "deploy Phase 0+1 to staging Supabase +
   smoke-test"; combined with point 3, the 18 uni_db migrations are
   on staging. Smoke-test details aren't on disk — see §13 question
   4.
5. **All ten §O questions converted to ADRs 001–010.** All accepted
   on 2026-05-07 (commit `83cc097`).
6. **Phase 1 Flutter integrations are wired up** behind
   `kUniDbEnabled`: applications-tab slivers, interview-setup
   addon, four routes registered conditionally.
7. **`pointycastle 3.9.1` override on main** unblocks the Chrome
   web build (per `flutter_run.log` 2026-05-06).

## 🔧 In-flight or partial

1. **`00000000000001_lovable_baseline.sql` is still the
   temporary-shim placeholder.** The filename was de-`.PLACEHOLDER`'d
   so staging push could pick it up, but its contents do NOT come
   from a real `supabase db dump --linked`. Production push would
   ship a profiles-only schema instead of the actual production
   tables. **Has to be regenerated before any prod push.**
2. **`pointycastle` override is on main but not on the Phase 0/1
   worktree.** Flutter analyzer ran on the worktree
   (commit `9cfcce7`), so it built once, but a future `flutter pub
   upgrade` there would re-trigger the QA report's P0. Needs
   porting.
3. **Live API call sites still raise `NotImplementedError`.** `_call_anthropic`
   in `extract/llm_anthropic.py` and `ocr_pdf_bytes` (Naver Clova
   live path) still throw. ADR-002 deprecates Clova in favour of
   EasyOCR, so the Naver site can stay stubbed; Anthropic remains
   the gating activation step.
4. **`docs/credentials.md` is un-edited** — no live keys appear to
   be in a `.env`. The whole "credentials walkthrough" hasn't been
   run end-to-end.
5. **`PHASE_1_NOTES.md` is now stale** — it still describes §O as
   unresolved. Should be replaced (or pointed at) by the ADRs.
6. **`services/uni_db/README.md` lists 14 migrations** rather than
   the actual 18. Doc lag, no functional impact.
7. **Main checkout has uncommitted Phase 0/1 design docs**
   (`UNIVERSITY_DB_AUDIT.md`, `UNIVERSITY_DB_BUILD_PLAN.md`,
   `INTERVIEW_QA_REPORT.md`, `docs/samples/*`, the `pointycastle`
   override). None of these are on the worktree branch either.
   **(needs user confirmation — should these go to main, to the
   Phase 0/1 branch, or to a new branch?)**
8. **The Phase 0/1 branch has not been pushed to origin.** No
   `refs/remotes/origin/claude/vigorous-haibt-f28e2d` exists.
9. **A new branch `claude/youthful-shannon-0b1dc4`** was created at
   `c6c8d47` with no commits yet. **(needs user confirmation —
   intent unknown.)**

## ❓ What we should ask the user before resuming (ranked)

1. **Is staging `hanguk-staging` (`nhjzbjzhmugcmzchzxlv`) the
   intended target, and are the migrations applied cleanly?**
   Disk says yes; we want a verbal confirm + a sanity peek at the
   staging DB before we treat it as canonical.
2. **Where do we route the in-progress design docs in the main
   checkout?** Options: (a) commit them onto `main` directly,
   (b) cherry into `claude/vigorous-haibt-f28e2d` and let it
   propagate via PR, (c) new branch. Same question for the
   `pointycastle` override + the `docs/samples/*` archetype anchors
   + `INTERVIEW_QA_REPORT.md`.
3. **Do we want to mirror the `pointycastle` override into the
   Phase 0/1 worktree right now**, before any further work there?
   Otherwise the next `flutter pub upgrade` will re-trigger the QA
   report's P0.
4. **Was the staging smoke-test passing**, and what did it cover?
   The commit message says "smoke-test", but no test report is on
   disk. (We can re-run it, or accept the green-light from the
   user.)
5. **Are the §O ADR decisions final**, or should any be re-debated
   before Phase 2 work starts? Specifically ADR-007 (internal-only)
   has the largest blast radius — confirm we're really cancelling
   the public + premium roadmap.
6. **What is `claude/youthful-shannon-0b1dc4` for?** It's an empty
   branch sitting at `c6c8d47`. If unintended, we can prune it.
7. **For Phase 2 kickoff, is the priority order:**
   (a) Replace `00000000000001_lovable_baseline.sql` with a real
   `supabase db dump` against production, (b) provision the
   Hetzner VPS (ADR-003), (c) build `parse/ocr_easyocr.py`
   (ADR-002), or (d) wire `extract/llm_anthropic._call_anthropic`?
8. **Do we want to merge `claude/vigorous-haibt-f28e2d` into `main`
   now** (with `kUniDbEnabled=false` keeping production behaviour
   identical), or hold the branch until Phase 2 is also ready?

---

## 12. Update — 2026-05-08 — Phase 2 landed, Phase 3 planning written

### Facts since the 2026-05-07 audit

Three commits landed on `claude/vigorous-haibt-f28e2d` after `83cc097`:

| SHA | Subject | Date |
|---|---|---|
| `15c52b1` | `chore: housekeeping — pubspec parity, design docs onto branch, baseline TODO` | 2026-05-07 |
| `6b545f6` | `feat(uni_db): Phase 2 — EasyOCR + Supabase Storage + RLS tightening + HITL discovery` | 2026-05-07 |
| `b6e28b7` | `test(uni_db): extend staging smoke-test with 9 Phase 2 checks` | 2026-05-07 |

Phase 2 details are in
[`services/uni_db/PHASE_2_NOTES.md`](services/uni_db/PHASE_2_NOTES.md).
Highlights: EasyOCR replaces Naver Clova (ADR-002), Supabase Storage
replaces R2 (ADR-009), RLS tightened to `fn_is_app_user()` on 12
recruitment-data tables (ADR-007), 8 archetype calibrations expanded
with worked examples, scholarships + document-checklist prompts
extended, `proposed_sources` HITL discovery added, top-30 seed
expansion, 4 Phase 2 migrations applied to staging cleanly. Tests at
210/210 on Python 3.12.10.

### Today's work — planning documents only (no code, no DB changes)

Three docs added (option (b) from the prior handoff):

1. [`docs/runbooks/reviewer-onboarding.md`](docs/runbooks/reviewer-onboarding.md)
   — first-week guide for the in-office reviewer who'll be hired per
   [ADR-005](docs/decisions/005-hitl-reviewer.md). Covers Supabase
   Studio access, the SQL helpers (`fn_review_accept` / `_edit_accept`
   / `_reject`), SLA targets, common Korean-source failure modes
   (cycle confusion, applicant-category drift, TOPIK tier tables,
   정정공고, country-of-origin document routing, mixed numerals),
   weekly cadence, escalation path, cross-training trajectory.
2. [`services/uni_db/PHASE_3_DESIGN.md`](services/uni_db/PHASE_3_DESIGN.md)
   — forward-looking design sketch for the six Phase 3 build items
   (English translation worker, signed-URL Edge Function, Hetzner VPS
   provisioning, `notify-tracked-changes` Edge Function with FCM /
   APNs / Web Push fan-out, `/admin/review` Flutter route, compare
   screen). Includes named-but-unapplied migration drafts, planned
   file paths, systemd unit template, ~45 new tests sketched, entry
   criteria checklist.
3. This update section.

No SQL was applied. No live API calls. No new dependencies. No code
edits.

### Inference

The Phase 3 entry gates from `PHASE_2_NOTES.md` are unchanged — the
real prod schema baseline is still the long pole, the in-office
reviewer is still unhired, the Anthropic API key is still unset, the
first live crawl is still ungranted. Today's deliverables are paper
preparation; they unblock nothing on their own but reduce future
uncertainty about how Phase 3 fits together.

---

## 13. Update — 2026-05-08 (later) — Phase 3 implementation landed

After the §12 update, the user authorised the Anthropic API gate
(billing alerts at $200/$400/$1000 thresholds per ADR-001) and asked
to "completely complete phase 1 phase 2 phase 3 all of them." Plan:
delegate Supabase/secret-handling work to a Gemini 3.1 Pro deploy
prompt (one self-contained artefact), implement everything else in
the local worktree.

### Commits added today (eight new on top of §12)

| SHA | Subject |
|---|---|
| `b2aa9a8` | feat(uni_db): wire live Anthropic extraction call |
| `7d66a54` | docs(uni_db): self-contained Gemini 3.1 Pro deploy prompt |
| `fd3e82b` | feat(uni_db): Phase 3 SQL migrations |
| `756d87d` | feat(uni_db): live ko->en/uz/vi/ru translation providers |
| `a0cdecf` | feat(uni_db): three Phase 3 Edge Functions (Deno/TypeScript) |
| `dc0fd0e` | feat(uni_db): infra/ — Hetzner CX22 worker host source files |
| `8bd2ca9` | feat(uni_db): Flutter Phase 3 surfaces — /admin/review, compare grid, PDF + push glue |
| (this) | docs(uni_db): update CURRENT_STATUS for Phase 3 implementation |

### What landed in code

**Backend / Python** (`services/uni_db/`):

- `extract/llm_anthropic.py` — live `_call_anthropic` via the
  Anthropic SDK with prompt caching on the system message and
  per-call cost computation including cache-read at 0.1× and
  cache-write at 1.25× input rate. 13 unit tests.
- `translate/claude.py`, `papago.py`, `deepl.py` — three live
  provider implementations replacing the Phase 0/1 NotImplementedError
  stubs. Each gated by `settings.live_apis`, with tenacity exponential
  backoff over the provider-specific retriable exception types. 19
  unit tests in `test_translate_providers_live.py`.

**Database** (`supabase/migrations/`):

- `20260701000000_uni_db_v3_pdf_access_log.sql` — audit table
- `20260701000100_uni_db_v3_user_push_tokens.sql` — token registration
- `20260701000200_uni_db_v3_change_event_outbox.sql` — outbox + trigger
- `20260701000300_uni_db_v3_notification_event_enum.sql` — enum extension

**Edge Functions** (`supabase/functions/`, Deno/TypeScript):

- `get-pdf-url/` — JWT verification + fn_is_app_user RPC + signed URL
  (15-min TTL) + audit row insert
- `register-push-token/` — JWT verification + upsert into
  user_push_tokens with conflict on (platform, token)
- `notify-tracked-changes/` — cron drain of change_event_outbox with
  stuck-worker recovery, exponential retry backoff (2,4,8,16,32,60 min;
  dead at 8 attempts), FCM (HTTP v1 OAuth-from-service-account-JWT)
  + APNs (HTTP/2 with ES256 bearer JWT) + web-push skeleton

**Flutter** (`lib/features/uni_db/`):

- `domain/review_queue_item.dart` + 11 unit tests
- `data/admin_review_providers.dart` — 3 Riverpod providers + actions service
- `presentation/admin_review_screen.dart` — two-column /admin/review
  with Accept / Edit & accept / Reject (six reason codes from the
  reviewer onboarding guide); forbidden scaffold for non-reviewer roles
- `presentation/institution_compare_screen.dart` — filled out the
  Phase 1 stub with real side-by-side compare grid
- `data/pdf_url_service.dart` — calls get-pdf-url Edge Function
- `data/push_token_registrar.dart` — calls register-push-token Edge
  Function with platform auto-detection

**Infrastructure** (`infra/`, file-only — no provisioning):

- `bootstrap.sh` (idempotent first-boot hardening)
- `deploy.sh` (rsync + venv + systemd reload)
- `env.example`
- `systemd/uni-db-{discovery-poll,extract,translate,ocr}.service` +
  `discovery-poll.timer` (4 services + 1 timer, hardened with
  ProtectSystem/ProtectHome/PrivateTmp/CPUQuota/MemoryMax)

### What gets delegated to the Gemini deploy prompt

`docs/runbooks/gemini-deploy-prompt.md` — paste-and-run for Gemini
3.1 Pro. Takes the codebase from "on disk" to "running in prod" via
five phases:

1. **Phase A** — replace staging-shim baseline with real prod
   pg_dump, sanitize, reset staging, smoke-test
2. **Phase B** — apply migrations to staging then prod with dry-run
   gating
3. **Phase C** — deploy three Edge Functions, set per-platform
   secrets, smoke-test on staging
4. **Phase D** — provision Hetzner CX22, run bootstrap, deploy code,
   start systemd units
5. **Phase E** — final verification (pytest, flutter analyze,
   migration count, smoke-test)

### Tests (Python)

```
Phase 0+1+2 baseline:           210 tests
+ test_llm_anthropic            13
+ test_translate_providers_live 19
                              ----
Phase 3 total                  242 tests
```

All 242 passing on Python 3.12.10. Ruff clean on Phase 3 files. The
two `UP035` warnings remaining (`from typing import Mapping` /
`Callable` in `translate/glossary.py` and `translate/pipeline.py`)
are Phase 0/1 legacy, not introduced by Phase 3 work.

### Tests (Flutter)

`flutter test test/features/uni_db` — 11/11 passing on Phase 3
review-queue-item domain tests.

`flutter analyze lib/features/uni_db lib/core/router lib/core/feature_flags test/features/uni_db`
— No issues found! (4 items).

### What's still gating Phase 3 going LIVE

These items are unchanged by today's code work — they remain human
decisions or paid-account creation steps that no agent (Gemini or
Claude) can fully automate:

1. **Real prod schema baseline** — Gemini Phase A handles this when
   the user provides the prod DB URL via secure paste.
2. **In-office reviewer hired** — human action by Hanguk admin, then
   Gemini sets `profiles.role='uni_db_reviewer'`.
3. **First live ac.kr crawl approved** — owner decision; flips
   `UNI_DB_LIVE_CRAWL=true` once granted.
4. **Hetzner billing account created** — user action; Gemini Phase D
   provisions once the account exists.
5. **FCM service account / APNs .p8 key / VAPID keypair generated** —
   user/Hanguk admin action (Apple Developer + Firebase account
   ownership). Gemini Phase C sets the secrets once provided.
6. **Naver Papago / DeepL API account** — same shape as #5.
7. **Native Uzbek reviewer recruited** — gates Uzbek translation per
   ADR-004. Until then `UNI_DB_TRANSLATION_LANGUAGES=en` stays.

The translation pipeline, push outbox, signed-URL function, /admin/review
screen, compare screen, and Hetzner systemd units are all
implementation-complete; they activate when the corresponding human
action lands.

### Live-call invariants still hold

All live API call sites remain gated by `UNI_DB_LIVE_APIS=true`
(default false). Tests run entirely offline (mocked SDK clients,
respx-mocked httpx for Papago, monkeypatched factory functions for
Anthropic and DeepL). No paid call has fired from this session.

---

## 14. Update — 2026-05-08 (later again) — Phase A/B/C deployed

Direct-execution session. Gemini hit DNS + Docker blockers; the rest
ran from the local Windows machine using pg_dump 17.6 +
supabase CLI 2.98.2 (already authenticated by Gemini's prior
`supabase login`).

### Phase A — prod schema baseline (commit `ed815b6`)

* `pg_dump --schema=public --schema-only --no-owner --no-privileges
  --no-comments` against the Hanguk 2026 prod project via the
  session-pooler URL.
* 6,800 lines / 245 KB → sanitized (strip session SETs except
  `check_function_bodies=false` which is required for round-trip
  restore of forward-referencing SQL functions; strip \\restrict and
  pg_catalog.set_config) → 6,783 lines committed as the new
  `00000000000001_lovable_baseline.sql`.
* 81 prod tables, 496 DDL statements, includes every table the prior
  staging-shim baseline lacked (payments, scheduled_payments,
  university_documents, interview_sessions, etc.) plus richer
  surfaces (gks_*, ai_*, call_*, intercom_calls, etc.).
* `supabase/migrations/MIGRATION_BASELINE_TODO.md` deleted —
  gate cleared.

### Phase B — staging push (commit `0f7f3d2`)

Staging required a destructive reset because the prior shim baseline
was already in its `schema_migrations` table; Supabase tracks by
filename version, not content. Reset via direct DB:

  ```sql
  drop schema if exists public cascade;
  create schema public;
  grant all on schema public to postgres, anon, authenticated, service_role;
  delete from supabase_migrations.schema_migrations;
  ```

Three fix-it migrations had to be added before the staging push
went green:

1. **`SET check_function_bodies = false`** restored to the baseline
   header — pg_dump emits `LANGUAGE sql` functions that reference
   tables defined later in the file; without that setting the very
   first migration aborts at parse time.

2. **`00000000000002_pre_uni_db_scholarships_rename.sql`** — bridge
   migration. Prod has a `public.scholarships` table from the legacy
   Lovable schema (university_id, name, coverage, ...) that
   collides with uni_db Phase 0's `public.scholarships`
   (institution_id, scope, award_type, topik_tier_table, ...).
   Bridge renames the legacy table to `legacy_scholarships`,
   preserving prod data.

3. **`00000000000003_pre_uni_db_profiles_role.sql`** — bridge
   migration. uni_db migrations assume `profiles.role` exists; prod
   uses a separate `public.user_roles` table for role-based access
   (per the baseline's `has_role(uuid, app_role)` function). Bridge
   adds `profiles.role text DEFAULT 'student'` plus an index on
   `(user_id, role)` for the per-row RLS subquery.

4. **`20260701000000_uni_db_v3_pdf_access_log.sql`** rewritten from
   `CREATE TABLE` to `ALTER TABLE ADD COLUMN`. Phase 2's
   `20260606000000_uni_db_v2_storage_bucket.sql` already creates
   `pdf_access_log` with one column set; Phase 3 was duplicating the
   CREATE then trying to index a column the existing shape didn't
   have. Phase 3 now just adds the three Edge-Function-specific
   columns: `bucket`, `expires_at`, `reason`.

5. **`supabase/functions/get-pdf-url/index.ts`** aligned to Phase 2's
   actual column names: looks up `guideline_documents` (not
   `documents`), inserts `guideline_document_id` /
   `storage_path` / `ip_address` / `signed_url_ttl_sec` rather than
   the names I'd guessed in Phase 3.

After fixes, staging push went clean: 28 migrations applied, 109
tables in public, smoke test green on every check (RLS toggles,
`fn_is_app_user`, `profiles_role_check`, `guideline_blobs` private,
`trg_proposed_source_promote` trigger).

### Phase B — prod push

Prod's `schema_migrations` had 105 stale versions (Lovable + manual
migrations from 2026-01-04 through 2026-03-11) that aren't in this
git repo. Standard Supabase consolidation pattern:

  ```bash
  supabase migration repair --status reverted <105 versions>
  supabase migration repair --status applied 00000000000001
  supabase db push --linked
  ```

Schema unchanged (the 105 reverted migrations are baked into the
baseline dump). Migration history compacted from 105 records →
`00000000000001` (baseline) plus the 33 forward migrations.

After the repair, dry-run showed the same 33 migrations as staging.
Push completed clean: `Finished supabase db push.` `migration list
--linked` confirms 34 entries with Local|Remote columns identical.

### Phase C — Edge Functions

Three functions deployed to both staging (`nhjzbjzhmugcmzchzxlv`)
and prod (`lysjdtyanhdfphqyijsr`):

* `get-pdf-url` — JWT verify + fn_is_app_user RPC + signed URL
  (15-min TTL) + audit row to `pdf_access_log`
* `register-push-token` — JWT verify + upsert to `user_push_tokens`
* `notify-tracked-changes` — cron-triggered outbox drain (FCM HTTP
  v1, APNs HTTP/2 with ES256 bearer JWT, web-push skeleton)

Function secrets NOT yet set on either project. The functions will
respond with platform-specific failure errors (`fcm_not_configured`,
`apns_not_configured`, `vapid_not_configured`) until
`supabase secrets set FCM_SERVICE_ACCOUNT_JSON=... APNS_KEY_P8=... ...`
is run. `notify-tracked-changes` reads `UNI_DB_PUSH_ENABLED=false`
as the killswitch default — the outbox accrues harmlessly until the
secrets land.

### Phase D — Hetzner

Account created (asrbekshokirovich@gmail.com). Verification flagged
"increased risk" → user ID upload required. Deferred until user has
ID document available.

### Phase E — final cleanup

Pending Phase D completion. Once Hetzner is provisioned, will:

* Push the `infra/bootstrap.sh` + systemd units
* Set `/etc/uni_db/env` from `infra/env.example`
* Start the four worker units
* Verify polling logs

### Action items still on you

1. **Reset prod DB password again** — the password you typed in this
   chat session was reset by you afterwards, but I want to flag that
   any password value in the chat transcript is exposed. The
   `services/uni_db/.prod-db-url.txt` file currently has whatever you
   most recently wrote; consider rotating one more time and updating
   the file (it's gitignored).
2. **Hire the in-office reviewer** (ADR-005). Once hired, give them
   `profiles.role = 'uni_db_reviewer'`.
3. **Approve first live ac.kr crawl.** Flips `UNI_DB_LIVE_CRAWL=true`.
4. **Set Edge Function secrets** when FCM / APNs / VAPID credentials
   are available:
     ```bash
     supabase secrets set FCM_SERVICE_ACCOUNT_JSON=... \
       APNS_KEY_P8=... APNS_KEY_ID=... APNS_TEAM_ID=... APNS_BUNDLE_ID=... \
       WEB_PUSH_VAPID_PRIVATE=... WEB_PUSH_VAPID_PUBLIC=... \
       UNI_DB_PUSH_ENABLED=false \
       --project-ref lysjdtyanhdfphqyijsr   # and again for staging
     ```
5. **Recruit native Uzbek reviewer** to flip
   `UNI_DB_TRANSLATION_LANGUAGES=en,uz` (ADR-004).

---

## 15. Update — 2026-05-10 — Phase 3R-A landed (reviewer queue in CRM)

Picking up from the §14 handoff. Phase 3R-A (the lowest-risk slice of
the universities-system replacement: add a reviewer queue page to the
React staff CRM) is implemented. Phase 3R-B (data cleanup + cutover)
is still pending answers to the four open questions in
`docs/runbooks/next-session-prompt.md` §"Open questions still on the table".

### Database migration applied (staging + prod)

`supabase/migrations/20260701001000_uni_db_v3_review_action_rpcs.sql`
adds three RPCs the reviewer-onboarding doc had been describing as if
they already existed:

| function | signature |
|---|---|
| `fn_review_accept` | `(queue_item_id uuid, reviewer_user_id uuid default null) → uuid` |
| `fn_review_edit_accept` | `(queue_item_id uuid, corrected_payload jsonb, reviewer_user_id uuid default null, reviewer_notes text default null) → uuid` |
| `fn_review_reject` | `(queue_item_id uuid, reason text, reason_detail text default null, reviewer_user_id uuid default null) → uuid` |

All three are SECURITY DEFINER + pinned `search_path` + reviewer-role
gate inside the function body. They do NOT bypass the existing
`trg_review_queue_audit` trigger — they just transition `review_queue.status`
to `approved`/`rejected` and the trigger writes the immutable
`review_decisions` audit row.

The migration also adds a `review_queue_reviewer_select` RLS policy.
Without it, `v_review_queue_dashboard` (security_invoker) returned
empty for `profiles.role='uni_db_reviewer'` users because the prior
RLS allowed only `admin` SELECT.

Verified on both projects via `pg_proc` lookup post-apply.

### React CRM patch (in handoff/, NOT yet pushed)

`handoff/0001-hanguk-uz-uni-db-review-screen.patch` is a
git-format-patch ready to apply on the `hanguk-uz` repo. Targets
`main @ 43382a5` and creates a new branch `claude/uni-db-review-screen`.

5 files / +826 −91:

| file | change |
|---|---|
| `src/hooks/useUniDbReviewer.ts` | NEW — reads `profiles.role`, returns `{role, isUniDbReviewer, isUniDbAdmin, loading}`. Coexists with the existing `useUserRole()` (which reads `user_roles.app_role`). |
| `src/hooks/useReviewQueue.ts` | NEW — react-query wrapper around `v_review_queue_dashboard` plus three mutations. 60s refetch. |
| `src/components/crm/pages/UniDbReviewContent.tsx` | NEW — page UI: forbidden card if not reviewer; 4-card stats header (open / overdue / P1+P2 / avg confidence); 2-column queue grid with priority badges, SLA-overdue indicator, source URL link, expandable JSON payload, and Accept / Edit & Accept / Reject buttons (each with its own confirm/edit dialog). |
| `src/components/crm/CRMSidebar.tsx` | refactored — extracted the duplicate-`groups` literal into a `buildGroups()` helper. Adds an `isUniDbReviewer` prop and a "Uni DB Review" item under the existing Admin group, gated on that flag. |
| `src/pages/CRMPortal.tsx` | imports `useUniDbReviewer`, threads the flag to `<CRMSidebar>` and `useSidebarGroups`, adds `/crm/admin/uni-db-review` URL prefix recognition + a `'uni-db-review'` `renderContent` case + lazy import. |

Push to `hanguk-uz` is **NOT yet done** — no git auth available in the
build sandbox. To finish:

```bash
# from a checkout of hanguk-uz on a machine with push auth
git switch -c claude/uni-db-review-screen
git am < /path/to/handoff/0001-hanguk-uz-uni-db-review-screen.patch
git push -u origin claude/uni-db-review-screen
# Vercel preview URL appears in the GitHub PR / branch list
```

Vercel preview should be smoke-tested before merging to `main` — the
build sandbox couldn't run `vite build` (npm install kept timing out
against the disk-tight tmpfs).

### Prod data picture confirmed (read-only via MCP)

| metric | prod value |
|---|---|
| `public.universities` rows | 697 |
| `name_ko IS NULL` rows | 249 (36%) |
| `is_partner = true` rows | 5 (KAIST, Korea, SNU, SKKU, Yonsei — all have `name_ko`, all referenced by `applications`) |
| `public.institutions` rows | 0 |
| Distinct unis touched by `applications` + `student_university_priorities` | 19 |

**FK web is wider than the audit suggested.** 20 tables reference
`public.universities` (the audit only mentioned 2). Full list: `applications`,
`student_university_priorities`, `interview_sessions` (`target_university_id`),
`interview_questions`, `university_programs`, `university_admission_periods`,
`application_form_cache`, `application_form_changes`,
`application_form_validations`, `university_documents`, `university_notes`,
`university_rooms`, `university_admissions`, `university_staff_assignments`,
`study_plan_sessions` (`target_university_id`),
`university_document_requirements`, `peer_review_queue`,
`legacy_scholarships`, `gks_designated_universities`, `student_suggestions`.

The Phase 3R-B dedupe migration has to repoint all 20 — material
change to risk profile vs the audit doc.

### Open questions still on the table for Phase 3R-B

Same four as the next-session prompt; awaiting Asrbek's answers before
any destructive prod operation:

1. Drop legacy `universities` entirely after cutover, or keep as
   `legacy_universities` for one quarter (mirror of `legacy_scholarships`)?
2. Lock `AIUniversityForm` and the bulk-import button during cleanup?
3. Acceptable downtime window for the cutover (~30s of stale-cached
   data on the Universities tab)?
4. The 5 `is_partner = true` rows above — confirm those are the
   currently-contracted partners worth explicit guard rails.

---

**Reading back into this on next session:**

```
Worktree branch:    claude/vigorous-haibt-f28e2d @ HEAD (Phase 3R-A done)
Worktree path:      C:\Users\User\Desktop\Hanguk\.claude\worktrees\vigorous-haibt-f28e2d
Main branch:        main @ c6c8d47 (unchanged)
CLI linked to:      staging (nhjzbjzhmugcmzchzxlv) — restored after prod work

PHASE A — prod baseline:        ✅ done 2026-05-08 (commit ed815b6)
PHASE B — staging migrations:   ✅ done 2026-05-08 (commit 0f7f3d2)
PHASE B — prod migrations:      ✅ done 2026-05-08 (commit 0f7f3d2)
PHASE C — Edge Functions:       ✅ deployed staging+prod
PHASE D — Hetzner provisioning: ⏸ blocked on user ID verification
PHASE E — final cleanup:        pending Phase D

## 19. Update — 2026-05-10 (latest) — training audit P2 batch shipped

All 26 P2 items now closed in code. Highlights:

- **Full `flutter_localizations` wiring** (audit L1/L3). New
  `lib/l10n/app_en.arb` is the source of truth; `app_uz.arb`,
  `app_ko.arb`, `app_ru.arb`, `app_vi.arb` are seeded with English +
  `TODO: translate` so a translator can fill in without blocking. New
  `l10n.yaml` + `flutter_localizations` dep + delegates wired on
  `MaterialApp.router` in `lib/main.dart`. `training_strings.dart`
  gained `fromContext(context)` that pulls from `AppLocalizations`.
- **Mocked Vapi integration test** (`test/features/training/vapi_integration_test.dart`):
  one happy-path test (greet → exchange → endCall → speech-end →
  feedback hook) and one error-path test (status-update with error →
  abandoned, refuses double-end). Drives the same pure-Dart event
  handler logic without needing a real WebRTC connection.
- **Quality wins**: `endSession` guarded against double-fire (D10);
  `getSessionHistory` paginated (D9); TTS files tracked + cleaned up
  on reset (D8); temp messages rolled back on AI failure (D7);
  multi-device stale-draft check on save (D5, best-effort).
- **UX wins**: two-sided transcript display during interview (U14);
  "Start another interview" button preserves feedback (U15); deep-link
  to OS settings on mic permanently-denied (U16); app-lifecycle
  observer ends the interview cleanly on background (U18); session
  settings menu with track switch (U8); paged history with locale-aware
  dates, delete with confirm, in-progress-tap toast (H1-H3).
- **Hardening**: Vapi `start()` wrapped in 30-second timeout (B5);
  ElevenLabs TTS auth check is status-code-only, not string-match
  (B6); pubspec note for vendored Vapi version pin (B7); 11 `catch (e)`
  sites converted to `on Exception catch (e)`; dummy `FocusNode` leak
  closed (A4); ghost text now renders at the cursor (A2/A3); draft
  capped at 12 000 chars (A7); resolver refuses to split a surrogate
  pair (A8); issue overlap validation (A9).
- **Cleanup**: dead `InterviewFeedbackView` stubbed (F16); unused
  `_exampleSelectedUniName` removed (U7); `focusTopic` got a real
  TextEditingController (U11); Vapi error event's text now surfaces in
  the active view (U12); `clearCurrentSession` preserves the list
  (D3); completed sessions sort to bottom of `fetchSessions` instead
  of being dropped (D4 — alternative was filter-out; rejected).

Files this session:

New:
- `l10n.yaml`
- `lib/l10n/app_en.arb` + `app_uz.arb` + `app_ko.arb` + `app_ru.arb` + `app_vi.arb`
- `test/features/training/vapi_integration_test.dart`

Edited:
- `pubspec.yaml` — `flutter_localizations`, Vapi pin note
- `lib/main.dart` — `localizationsDelegates` + `supportedLocales`
- `lib/features/training/data/study_plan_repository.dart` — `isAnalyzing`
  flag, `updateSelectedTrack`, multi-device stale check, sessions-list
  preserve, completed-to-bottom sort, typed exception catches
- `lib/features/training/data/interview_repository.dart` —
  `cleanupTtsFiles`, paginated `getSessionHistory`, double-end guard
  on `endSession`, `resetForNewSession`, temp-message rollback,
  TTS auth status-code check, typed exception catches
- `lib/features/training/presentation/study_plan_screen.dart` —
  session settings menu, history-screen AppBar action, removed unused
  field
- `lib/features/training/presentation/training_tab.dart` — mic
  perma-denied → openAppSettings snackbar
- `lib/features/training/presentation/widgets/interview_active_view.dart`
  — Vapi `start()` timeout, real error event surfacing, two-sided
  transcript display, app lifecycle observer
- `lib/features/training/presentation/widgets/interview_setup_view.dart`
  — `focusTopic` TextEditingController + dispose
- `lib/features/training/presentation/widgets/interview_history_view.dart`
  — locale-aware dates, in-progress tap explainer, delete with confirm
- `lib/features/training/presentation/widgets/interview_analytics_view.dart`
  — "Start another interview" CTA preserving feedback
- `lib/features/training/presentation/widgets/interview_feedback_view.dart`
  — stubbed (deprecated) per F16
- `lib/features/training/presentation/widgets/advanced_drafting_workspace.dart`
  — disposed FocusNode, cursor-aware ghost text insertion, max length
- `lib/features/training/presentation/widgets/ai_highlighting_text_controller.dart`
  — ghost text rendered at cursor
- `lib/features/training/presentation/widgets/study_plan_analysis_view.dart`
  — uses dedicated `isAnalyzing` flag
- `lib/features/training/presentation/training_strings.dart` —
  `fromContext(BuildContext)` accessor delegating to AppLocalizations
- `lib/features/training/data/grammar_issue_resolver.dart` —
  surrogate-pair guard, overlap mask
- `test/features/training/grammar_issue_resolver_test.dart` — added
  surrogate-pair test + nested overlap test

**What's still on the user's side:**

- Generated localization sources land via `flutter pub get` running
  `gen-l10n`. On first build the generator creates
  `lib/l10n/app_localizations.dart` (+ per-locale files). If the build
  fails complaining the file is missing, run `flutter pub get` once;
  the generator wires on every subsequent build per `generate: true`
  in pubspec.
- Translator pass on `app_uz.arb` / `app_ko.arb` / `app_ru.arb` /
  `app_vi.arb` — search for `TODO: translate` markers.
- Delete the stub files left in place by the sandbox's read-only-for-
  delete mount (`study_plan_chat_fab.dart`, `interview_feedback_view.dart`)
  whenever convenient.
- Same `index.lock` carry-over from prior batches.

---

## 18. Update — 2026-05-10 (latest) — training audit P1 batch shipped

After the 9 P0 fixes landed in §17, worked through all 23 P1 items from
`docs/audits/training_audit_2026-05-10.md`. 22 closed fully in code; 1
(L1/L3 — full intl infra) closed partially with a strings table that's a
migration target for the next session's `flutter_localizations` work.

**Database change applied (staging + prod):**
- `20260510140000_training_add_selected_track.sql` — adds
  `study_plan_sessions.selected_track` (text). Closes audit F2.

**New files this session:**
- `lib/features/training/data/training_contracts.dart` — typed parsers
  for the three Edge Function response shapes (B1/B4).
- `lib/features/training/data/vapi_event_parser.dart` — pure-Dart
  `isEndCallTool` lifted from the active view for testability.
- `lib/features/training/data/grammar_issue_resolver.dart` —
  pure-Dart first-un-claimed match resolver, replacing the brittle
  `lastIndexOf` (A1).
- `lib/features/training/data/step_one_guide_helper.dart` — `normalizeTrack`.
- `lib/features/training/presentation/training_strings.dart` — 22
  strings × 3 locales (en / ko / uz). Conservative L1/L3 — full intl
  infra still P2.
- `test/features/training/{vapi_event_parser,grammar_issue_resolver,step_one_guide_helper,training_contracts,training_strings}_test.dart`
  — 27 tests covering the highest-leverage logic the founder asked for.
- `supabase/migrations/20260510140000_training_add_selected_track.sql`.

**Files edited:**
- `lib/features/training/data/interview_repository.dart` — `clearError`,
  `markAbandoned`, `logTranscriptWithRole`, `focusTopic` + `timedMode` +
  `timeLimitSeconds` in state, `_persistVapiCallId` retry, defensive
  `interview_feedback` insert.
- `lib/features/training/data/study_plan_repository.dart` — `copyWith`
  on `StudyPlanSession`, per-session save mutex (`_withSessionLock`),
  `saveDraft` returns bool + skips `draftContent` overwrite,
  `selected_track` write, structured analyze parsing, `debugPrint`
  cleanup.
- `lib/features/training/presentation/training_tab.dart` — persona
  dropdown, `clearError` on dialog open.
- `lib/features/training/presentation/study_plan_screen.dart` —
  empty-applications CTA in the create-session dialog, `'en'`/`'ko'`
  track values, `normalizeTrack`-aware Step 1.
- `lib/features/training/presentation/interview_screen.dart` —
  `initialPersona` accepted and threaded into `startSession`.
- `lib/features/training/presentation/widgets/interview_active_view.dart`
  — delegates to `vapi.isEndCallTool`, filler-word regex with word
  boundaries, `markAbandoned` on dispose, `debugPrint` cleanup.
- `lib/features/training/presentation/widgets/interview_setup_view.dart`
  — real `_UniversityPicker` for `university_specific` sessions.
- `lib/features/training/presentation/widgets/interview_feedback_view.dart`
  — score normalization (1–10 ↔ 0–100).
- `lib/features/training/presentation/widgets/advanced_drafting_workspace.dart`
  — disposed FocusNode, rate cap on ghost-text AI, awaited save →
  analyze sequence, error save status, delegates to
  `grammar_issue_resolver`.
- `lib/features/training/presentation/widgets/live_metrics_bar.dart`
  — `SaveStatus.error` added.
- `docs/audits/training_audit_2026-05-10.md` — P1 backlog annotated.

**What's still on the user's side after this session:**
- Same `index.lock` blocker as prior sessions — needs the Windows-side
  `del` before commits go through.
- Delete `lib/features/training/presentation/widgets/study_plan_chat_fab.dart`
  entirely from Windows (carries over from §17 — stub was left because
  the sandbox can't unlink).
- Rebuild the Flutter app to ship P1 to users.
- Full intl wiring (L1/L3) — defer to P2 when a translator can be
  scheduled. The `training_strings.dart` table is the migration target.
- Open P2 backlog (~26 items, ~3–5 dev-days) is unchanged.

---

## 17. Update — 2026-05-10 (latest) — training audit + all 9 P0 fixes shipped

Two related deliverables landed back-to-back:

**Audit** — `docs/audits/training_audit_2026-05-10.md` (a 388-line deep audit of `lib/features/training/`). Investigated all six training-area dimensions (functional bugs, UX, data integrity, backend contracts, localization, parity, tests) plus the Phase 3R-B knock-ons. 58 findings across P0/P1/P2. Headline number that drove most of the work: **0 automated tests** on 4,882 lines of training code, **0 i18n adoption**.

**P0 fixes — all 9 shipped in code** (build still needed; no new tests):

| # | item | resolution |
|---|---|---|
| F8 | Manual-exit "End Interview" button bypassed feedback | Now calls `_completeAutoEnd()` (same path as AI-driven auto-end). |
| F1 | Resumed Study Plan / Personal Statement sessions opened blank | `_buildDraftingStep` seeds `AdvancedDraftingWorkspace` with `state.drafts.first.content` (or `draftContent`). ValueKey forces remount on session switch. |
| F13 | Interview history showed "Unknown Target" for every session | `_buildSessionCard` reads the new `institution` alias, falls back to legacy `universities` key for cached responses. |
| F10 | "Timed Mode" toggle did nothing | `InterviewSessionState` now carries `timedMode` + `timeLimitSeconds`; `_startCall` schedules a real timer that triggers `_completeAutoEnd` on expiry. |
| F11 | `focus_topic` collected but ignored | Now threaded through state and appended to the Vapi system prompt. |
| U4 | `StudyPlanChatFab` was a non-functional placeholder | **Deleted** per founder pre-decision. Stub file still on disk (sandbox can't unlink) but returns `SizedBox.shrink()`; consumer in `study_plan_screen.dart` removed. `study_plan_chat_history` DB table preserved for future real build. |
| F9 | AI-side transcripts dropped during Vapi calls | `interview_repository.logTranscriptWithRole(text, role)` added; active view logs both `user` and `assistant` final transcripts (assistant rows write `role='interviewer'`). |
| F7 | 3 dummy "Tavsiya etilgan videolar" tiles | Section removed entirely. |
| L2 | Step 1 guide hardcoded Uzbek for all users | `_stepOneGuide(track, documentType)` returns Korean / English / Uzbek copy based on `selectedTrack`. Track-mismatch warning in `study_plan_analysis_view` similarly switches. |

Files touched this session (all in worktree, none committed yet):

- `lib/features/training/data/interview_repository.dart` — state class + `logTranscriptWithRole`
- `lib/features/training/presentation/interview_screen.dart` (no edit, comment updated previously)
- `lib/features/training/presentation/widgets/interview_active_view.dart` — manual-end fix, focus prompt, time-limit timer, assistant transcripts
- `lib/features/training/presentation/widgets/interview_history_view.dart` — alias fallback
- `lib/features/training/presentation/study_plan_screen.dart` — workspace seed, dummy-video removal, localized Step 1, FAB removed
- `lib/features/training/presentation/widgets/study_plan_chat_fab.dart` — stub-only (DELETE the file Windows-side)
- `lib/features/training/presentation/widgets/study_plan_analysis_view.dart` — localized track-mismatch warning
- `docs/audits/training_audit_2026-05-10.md` — annotated P0 closures

What's still on the user's side:

- **Delete `lib/features/training/presentation/widgets/study_plan_chat_fab.dart`** entirely (Windows-side `del`). The stub left behind is harmless but should not stay in the tree long-term.
- Same `index.lock` + commit dance from prior sessions; nothing changed there. After deleting the file, commit the rest with a single `feat(training): close audit P0s` message.
- Rebuild the Flutter app to ship #2-#5 + #7-#9 to users (no platform-specific changes; an Android APK build is enough). Hot-reload picks up everything except the new state-class fields.

P1 / P2 from the audit are unchanged (~5-7 dev-days + ~3-5 dev-days respectively). The biggest carry-over is **zero training tests** — none added in this fix-only session.

---

## 16. Update — 2026-05-10 (later) — six-item Hanguk surface session

Worked through the menu of non-uni_db items the user asked for:

| # | item | result |
|---|---|---|
| 3 | Interview launcher empty-state CTA | shipped — `lib/features/home/presentation/home_tab_provider.dart` (new) lifts the bottom-nav index to a Riverpod provider; `home_screen.dart` consumes it; `training_tab.dart` empty-state now renders an "Apply to a university" card+button that pops the dialog and switches the user to the Applications tab |
| 1 | Magic-code login bug fix | shipped — `supabase/functions/student-login-v2/index.ts` (new) committed + deployed to staging (version 1) and prod (version 11). Fixes Bug A (createUser race), Bug D (password drift), Bug E (typed error codes). Dart client at `lib/features/auth/data/auth_repository.dart` was already pointing at v2 with typed-error mapping; added `CODE_REQUIRED` alias to the existing `BAD_INPUT` case. Plan's Bugs B (listUsers scaling) + C (refresh-token-only setSession) deferred per smallest-slice scope. |
| 2 | Interview AI greets first + Korean accent | already shipped on the worktree branch in commit `b69ea14 feat(training): Korean voice, AI greets first, auto-end, recording, feedback`. `interview_active_view.dart` has `firstMessageMode: 'assistant-speaks-first'`, `eleven_turbo_v2_5` voice model, Korean-native voice IDs (JiYoung / Hyun Bin / KKC), `endCallFunctionEnabled: true`, `recordingEnabled: true`. User just needs a fresh build. |
| 5 | Drafting workspace AI | already wired — `study_plan_repository.dart:413` `superviseDraft` invokes the live `study-plan-trainer` Edge Function (id `8a75110a-c73c-42ca-90d1-fad1d76876ce`, version 14, ACTIVE on prod). Edge Function source lives in the Lovable-managed function repo, not here; quality work would happen there. |
| 6 | Training parity — session history list | shipped — `lib/features/training/presentation/widgets/study_plan_history_view.dart` (new) is a polished React-style history view (timestamp, status pill, step badge, target university). Tapping resumes the session via `loadSession`. Also fixed an in-flight regression: `study_plan_repository.dart` and `interview_repository.dart` were querying `target_university_id` (column was renamed to `target_institution_id` by Phase 3R-B); patched both files + the embed-relation alias. The Flutter app already had `_buildSessionList` inline in `study_plan_screen.dart`, so the new view is additive (richer display) — wire it into the AppBar in a follow-up if you want a dedicated screen. |
| 4 | Auto-updater hardening | already shipped — `updater_repository.dart:343` `_verifySha256` streams the APK via `crypto.sha256.bind()` and rejects on mismatch; `update_telemetry.dart` upserts to `app_version_pings` once per session from `update_gate.dart:54`. DB tables `app_versions` + `app_version_pings` are on prod. The plan's broader scope (in-app download progress UI, staged rollouts via `rollout_percentage`, iOS App Store deep-link, web SW reload, force-full-reinstall flag) is also already in `AppVersionInfo` + `startUpdate`. |

Net new files this session:
- `lib/features/home/presentation/home_tab_provider.dart`
- `lib/features/training/presentation/widgets/study_plan_history_view.dart`
- `supabase/functions/student-login-v2/index.ts`

Edits this session:
- `lib/features/home/presentation/home_screen.dart` — index lifted to provider
- `lib/features/training/presentation/training_tab.dart` — empty-state CTA
- `lib/features/training/data/study_plan_repository.dart` — institution_id rename + updatedAt/createdAt fields + jsonb fallback
- `lib/features/training/data/interview_repository.dart` — institution_id rename
- `lib/features/auth/data/auth_repository.dart` — CODE_REQUIRED → BAD_INPUT alias

Edge Function deploys:
- staging `nhjzbjzhmugcmzchzxlv`: `student-login-v2` v1
- prod `lysjdtyanhdfphqyijsr`: `student-login-v2` v11

No new SQL migrations. No new pushes to `hanguk-uz` (push-from-sandbox is still blocked — same git auth + index.lock constraints from earlier sessions; no need to re-litigate).

What's left on the user's side after this session:
- Regenerate Flutter build to pick up #2 (Korean accent + AI-greets) and #3 (empty-state CTA) and #6 (institution_id rename fixes) and the new history widget
- Switch the Dart client's `student-login` calls over from v1 to v2 in production (the `_messageFor` mapping is already in place; just confirm the function name in the call site if any callers still hit v1)
- Watch v2 logs for 48 hours; retire student-login v1 after the canary is green
- Optionally wire `StudyPlanHistoryView` into the AppBar of `StudyPlanScreen` if you want a dedicated history screen

---

PHASE 3R-A — reviewer queue:    ✅ done 2026-05-10
                                  - migration 20260701001000 applied
                                    staging+prod (3 RPCs + reviewer SELECT policy)
                                  - hanguk-uz patch in handoff/ — NOT pushed
                                    (no git auth in sandbox)
PHASE 3R-B — data cleanup:      ✅ done 2026-05-10
                                  - migrations 20260510130000 (drop legacy
                                    universities + 5 unused tables, NULL FKs,
                                    forensic backups), 20260510130100 (rename
                                    university_id → institution_id + new FKs
                                    to institutions), 20260510130200 (RLS on
                                    backups + revoke anon on fn_review_* RPCs)
                                    applied staging+prod
                                  - hanguk-uz patch 0002 in handoff/ — NOT
                                    pushed (38 files, +728/-2983 incl 4
                                    legacy components deleted; see
                                    handoff/README.md)
                                  - advisor security: 0 new ERRORs from this
                                    work (5 pre-existing ERRORs cleared); 5
                                    INFO-level rls_enabled_no_policy on
                                    forensic backups (intentional deny-all);
                                    remaining WARNs are pre-existing
PHASE 3R-C — staff features:    pending Asrbek smoke-testing the Vercel
                                  preview from 0001+0002 + types.ts regen +
                                  student-side locale rebuild

Tests:             242 Python (pytest) + 11 Flutter passing offline
Reviewer guide:    docs/runbooks/reviewer-onboarding.md
Live integrations: still mocked behind UNI_DB_LIVE_APIS=false
Feature flag:      kUniDbEnabled=true default (per commit 2f2cf0a)
```

---

## Addendum 2026-05-11 — Kakao + Map/Walkaround P0 batch

Two audit reports landed on 2026-05-11
(`docs/audits/kakaotalk_audit_2026-05-11.md`,
`docs/audits/map_walkaround_audit_2026-05-11.md`). All P0 items from
both audits have been shipped:

```
SCOPE 1 — KAKAOTALK INTEGRATION
  K1 — Data-source fix (drop the dead `universities` query)   ✅ shipped
       (lib/features/map/data/map_repository.dart →
        from('v_institutions_for_map').select(...))
  K2 — JS key off source                                       ✅ shipped
       (lib/core/config/app_config.dart::kakaoJsKey =
        String.fromEnvironment('KAKAO_JS_KEY', defaultValue:
        'c695b428…'); both HTML generators templated with
        AppConfig.kakaoJsKey)
       (test_map.html neutralized — sandbox can't rm; orchestrator
        to `git rm` on commit)
  K3 — Orphan native Kakao SDK deletion                        ✅ shipped
       (AndroidManifest com.kakao.sdk.AppKey meta-data removed;
        android/build.gradle.kts Kakao Maven repo removed;
        iOS Info.plist never wired for Kakao — no edits needed)

SCOPE 2 — MAP + WALKAROUND
  M1 — Data-source fix                                         ✅ shipped (same as K1)
  M2 — Domain remodel                                          ✅ shipped
       (lib/features/map/domain/university.dart →
        added nameKo/nameKoShort/nameEn/nameUz/tier/ieqasStatus/
        nextEventAt + isTopTier + isAccredited; legacy fields
        @Deprecated)
       (test/features/map/university_domain_test.dart — new
        unit-test coverage)
  M3 — Filter chip + tier badge                                ✅ shipped
       ("Top 100" → "Top", predicate = u.isTopTier;
        university_card.dart's _buildRankBadge → _buildTierBadge)
  M4 — Detail-sheet rows                                       ✅ shipped
       (stats row → _buildSignalsRow with Tier/IEQAS/next-event;
        legacy tuition/acceptance/about rows removed)
       (M10 pulled forward: _launchWebsite now uses Uri.tryParse)

OPERATOR PRE-DECISION (P1 partial)
  Roadview radius → 200m, no auto-expand fallback              ✅ shipped
       (lib/features/map/presentation/widgets/roadview_html.dart;
        empty-state UI in English; M6 will localize via the new
        window.HangukRoadviewChannel JS bridge)

DEFERRED TO NEXT BATCH
  K6 / M12 — Delete kakao-roadview-proxy Edge Function         pending decision
       (called by no client; scrapes undocumented endpoints;
        delete preferred if Pannellum path isn't picked up)
  P1 / P2 items                                                deferred per plan
```

Files touched in this batch:

  - `android/app/src/main/AndroidManifest.xml` (K3)
  - `android/build.gradle.kts` (K3)
  - `lib/core/config/app_config.dart` (K2)
  - `lib/features/map/data/map_repository.dart` (K1/M1)
  - `lib/features/map/domain/university.dart` (M2)
  - `lib/features/map/presentation/map_tab.dart` (M3)
  - `lib/features/map/presentation/widgets/university_card.dart` (M3)
  - `lib/features/map/presentation/widgets/university_detail_sheet.dart` (M4, M10)
  - `lib/features/map/presentation/widgets/university_map_html.dart` (K2)
  - `lib/features/map/presentation/widgets/roadview_html.dart` (K2, Roadview radius)
  - `test/features/map/university_domain_test.dart` (new — M2 coverage)
  - `test_map.html` (K2/K7 — neutralized, awaiting `git rm`)
  - `docs/audits/kakaotalk_audit_2026-05-11.md` (P0 status closed)
  - `docs/audits/map_walkaround_audit_2026-05-11.md` (P0 status closed)
  - `CURRENT_STATUS.md` (this addendum)

Git: per operating rules, no commits made from the sandbox. Worktree
HEAD remains at the audit-reports commit (`762c671` on
`claude/audits-kakao-and-map`); the operator handles the branch
state for the implementation commit.

---

Report path: `C:\Users\User\Desktop\Hanguk\CURRENT_STATUS.md`

Closed in batch 2 (this session) — all remaining P1, all P2, plus the
Pannellum tour pilot. Roll-up:

### KakaoTalk audit closures

| ID | item | result |
|---|---|---|
| K4 | Roadview radius | Already shipped (200m, no auto-expand). Documented decision in roadview_html.dart and docs/runbooks/kakao.md. |
| K5 | Roadview empty-state localization | Shipped — `walkaroundLoadingTitle/Subtitle/NoPanoTitle/Subtitle/BlockedTitle/Subtitle/NetworkTitle/Subtitle/InitErrorTitle/Subtitle` strings added to all 5 ARB locales; Korean translated, others seeded with English `TODO: translate` markers. Hand-written `app_localizations*.dart` overrides for all locales since `gen-l10n` doesn't run in this sandbox. The JS bridge `window.HangukRoadviewChannel` posts state codes; `UniversityRoadviewScreen` renders a sealed-state overlay with localized copy. |
| K6 | Delete `kakao-roadview-proxy` Edge Function | **Fully removed** as of 2026-05-12 — verified via Supabase MCP `get_edge_function` returning `NotFoundException`. The function went through a 410 Gone stub deploy (version 14) and was then fully deleted host-side. Zero remaining surface area. |
| K7 | Delete test_map.html | Already removed in commit c0f268e. Verified the file is not in HEAD on the audits branch. |
| K8 | Lazy-load Leaflet | Shipped — `bootLeaflet()` injects the CSS + JS lazily on Kakao failure; the head no longer eagerly pulls ~150KB of Leaflet. |
| K9 | Document JS-key allowlist | Shipped — `docs/runbooks/kakao.md` (167 lines) documents the allowlist, key types, rotation flow, baseUrl workaround, JS bridge contract, and Pannellum pilot. |
| K10 | flutter_secure_storage | Added to pubspec.yaml as `flutter_secure_storage: ^9.2.2` with a comment explaining it's pre-emptive (no consumer yet). |
| K11–K14 | Decisions on Kakao Login / Share / Channel / AlimTalk | All deferred per pre-decision. Documented in `docs/runbooks/kakao.md` "Things to never do" section. |
| K15 | Korean PIPA consent surface | DEFERRED — only relevant if K11/K14 lands. |
| K16 | Kakao runbook | Shipped as part of K9. |
| K17 | Per-platform Kakao app split | DEFERRED — relevant only after K11 ships. |

### Map / walkaround audit closures

| ID | item | result |
|---|---|---|
| M5 | Roadview radius tighten | Same as K4. Shipped 200m + JS bridge. |
| M6 | Roadview state localization | Same as K5. Shipped. |
| M7 | Lazy-load Leaflet | Same as K8. Shipped. |
| M8 | Auto-fit-bounds for markers | Shipped — both Kakao (`map.setBounds`) and Leaflet (`featureGroup.getBounds()`) auto-fit to the actual marker set; the (36.5, 127.8) Korea-wide default is now a no-markers fallback only. |
| M9 | Walkaround via go_router | Shipped — `/walkaround/:institutionId` registered in app_router.dart; detail sheet calls `context.push('/walkaround/${u.id}', extra: u)`. Cold deep-links fall back to `universitiesProvider`. |
| M10 | Uri.tryParse for website button | Already shipped in 2026-05-11 P0 batch. |
| M11 | `/map/:institutionId` deep-link | Shipped — `_MapDeepLinkEntry` flips the home tab to Map and writes to `pendingMapDetailProvider`; MapTab listens, raises the bottom sheet, and clears the provider. |
| M12 | Delete `kakao-roadview-proxy` | **Fully removed** — same as K6. Verified `NotFoundException` from Supabase MCP. |
| M13 | Delete test_map.html | Same as K7. |
| M14 | Hand-pick top-30 lat/lng overrides | DEFERRED — content task, not engineering. Counselor team. |
| M15 | Kakao MarkerClusterer | Shipped — SDK loaded with `&libraries=clusterer`; clusters when count > 3 markers. |
| M16 | "Near me" FAB | DEFERRED — requires geolocator package + iOS plist + Android runtime permission. Marked for a follow-up. |
| M17 | Pannellum tour pilot for Yonsei | Shipped — see Pannellum section below. |
| M18 | walkaround_url column on institutions | Shipped — added in migration `20260512120000_institutions_virtual_tour.sql`, applied staging + prod. Detail sheet uses it as fallback when `virtualTour` is null. |
| M19 | Locale-aware marker names | Shipped — `University.nameForLocale(localeCode)`; map_mobile + map_web pass `Localizations.localeOf(context).languageCode` into `generateMapHtml`. |
| M20 | usage_events analytics | Shipped 2026-05-12 — `MapAnalytics` interface + Riverpod-overridable sink at `lib/features/map/data/map_analytics.dart`. Default impl `debugPrint`s; tests cover the contract (`test/features/map/map_analytics_test.dart`). Four events wired into call sites: `mapMarkerClick`, `walkaroundOpen`, `virtualTourOpen` (with optional `sceneId`), `universityWebsiteOpen`. Sink swap to a `usage_events` Supabase table is a single `Provider.overrideWith` at the composition root — no caller change. |
| M21 | A11y semantics labels | Shipped — `Semantics(button, selected, label)` on `_FilterChip` and `_ToggleButton`; live-region label on `_FilterEmptyBadge`. |
| M22 | Info-window on marker click | Shipped — Kakao `InfoWindow` with the institution name + "Tap for details" preview; the bottom sheet still raises on tap. |
| M23 | Document JS-key allowlist | Same as K9. Shipped in `docs/runbooks/kakao.md`. |
| M24 | Re-throw in universitiesProvider | Shipped — `PostgrestException` and `Exception` now `rethrow` after `debugPrint`, so the `AsyncValue.error` path drives `_buildErrorState` with a retry button. |
| M25 | Filtered-empty-map badge | Shipped — `_FilterEmptyBadge` overlay on the map when `filtered.isEmpty && unis.isNotEmpty`. Has a "Clear" CTA that resets both filter and search. |

### Pannellum tour pilot

  - **Migration** `supabase/migrations/20260512120000_institutions_virtual_tour.sql` (applied to staging `nhjzbjzhmugcmzchzxlv` and prod `lysjdtyanhdfphqyijsr`). Adds `institutions.virtual_tour` JSONB + `institutions.walkaround_url` text, plus a `jsonb_typeof` shape constraint and a Yonsei seed with 3 scenes (main_gate → library → quad) using Pannellum's CC0 example panoramas, with a `_note` marker reading `TODO: replace with real Yonsei imagery`. The seed is idempotent (`AND (virtual_tour IS NULL OR virtual_tour ? '_note')`).
  - **Migration** `supabase/migrations/20260512120100_v_institutions_for_map_virtual_tour.sql` (applied staging + prod). DROPs + re-CREATEs `v_institutions_for_map` to expose `virtual_tour` + `walkaround_url`. CREATE OR REPLACE rejected a column reorder; DROP CASCADE is the documented workaround.
  - **Asset** `assets/virtual_tour/pannellum.html` (198 lines). Single-file Pannellum 2.5.6 viewer loaded from jsdelivr; Dart→JS bridge `window.HangukTour.setTourSpec(jsonStr, locale)` + `setLabels({...})`; channel `window.HangukTourChannel` posts `ready|scene|error|no_scenes|parse_error`. Pubspec registers `assets/virtual_tour/` directory.
  - **Screen** `lib/features/map/presentation/widgets/virtual_tour_screen.dart` (217 lines). Loads the asset HTML, awaits `onPageFinished`, then injects the tour spec + localized labels. Uses `EagerGestureRecognizer` (same fix as Roadview). Dart-side Stack overlay surfaces the localized init-error copy if the WebView reports a hard failure.
  - **Domain** `University.virtualTour` (Map<String, dynamic>?) + `University.walkaroundUrl` (String?) + `hasVirtualTour` getter. `map_repository.dart` selects both fields from the view and parses `virtual_tour` from the row.
  - **Entry point** `UniversityDetailSheet` now shows a **Virtual Tour** button above the Kakao **Virtual Walkaround** button when `university.hasVirtualTour`; falls back to a "Virtual Tour" link to `walkaroundUrl` when only that's set; otherwise shows only the Roadview Walkaround.
  - **Tests** added to `test/features/map/university_domain_test.dart` covering `nameForLocale` (5 cases) and `hasVirtualTour` (2 cases).

### Staging-vs-prod parity note

Yonsei seed visible on **staging** with 3 scenes + `default_scene: main_gate` via `v_institutions_for_map`. **Prod** has zero rows in `public.institutions` today, so the UPDATE matched no rows — the schema is correct and the migration is idempotent; when prod gets seeded, the migration can be re-run (or the equivalent UPDATE issued by the operator) to attach the same tour.

### Deferred items (carried over)

  - **K6 / M12** — `kakao-roadview-proxy` Edge Function deletion (sandbox hang).
  - **K15 / K17** — gated on K11 (Kakao Login).
  - **M14** — manual lat/lng curation for top-30 (content task).
  - **M16** — geolocator-backed "Near me" FAB.
  - **M20** — usage_events analytics pipeline.
  - **Real Yonsei panoramas** — replace the CC0 demo seeds when content team licenses real campus 360s. The `_note: 'TODO: replace ...'` marker on the seed JSON is the trigger.

### Same `index.lock` carry-over

`.git/worktrees/vigorous-haibt-f28e2d/index.lock` still can't be removed from the sandbox. Orchestrator needs to clear it before committing, same as prior batches.
