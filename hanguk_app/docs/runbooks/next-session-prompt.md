# Next-session handoff prompt — full replacement of old universities system

> Copy everything between `=== BEGIN PROMPT ===` and `=== END PROMPT ===`
> below into a fresh Claude conversation. The prompt is self-contained:
> the next session does not need access to this chat.

---

=== BEGIN PROMPT ===

You are picking up the Hanguk uni_db deliverable mid-flight. The user
("Asrbek", asrbekshokirovich@gmail.com) wants you to **completely
remove the legacy `public.universities` system and replace it with the
new `public.institutions` system that's been built across the prior
Phase 0–3 sessions**, both at the database level and in the React
staff CRM at `hanguk.uz`.

---

## Cross-chat memory

**You cannot read prior Claude conversations.** Each chat is a fresh
context. To get up to speed, READ THESE FILES IN ORDER before doing
anything:

1. `C:\Users\User\Desktop\Hanguk\.claude\worktrees\vigorous-haibt-f28e2d\CURRENT_STATUS.md`
   — running snapshot of the project state. Newest section
   (`§14 — 2026-05-08 (later)`) covers what's been deployed.
2. `services/uni_db/PHASE_2_NOTES.md` — what landed in Phase 2.
3. `services/uni_db/PHASE_3_DESIGN.md` — Phase 3 design.
4. `docs/runbooks/hanguk-uz-staff-crm-architecture.md` — **the audit
   that scoped this work.** This is the most important file for you
   to read first. It documents:
   - The React/Lovable CRM stack (Vite + react-router + react-query + shadcn/ui + supabase-js)
   - The dual-codebase reality (Flutter `hanguk_app` student app, React `hanguk-uz` staff CRM)
   - The 697-row legacy `universities` data quality scan (181 dupe pairs, 249 missing Korean names, 0 rows in `institutions` on prod)
   - The proposed Phase 3R-A / 3R-B / 3R-C plan
5. `docs/decisions/` — 10 ADRs + 2 amendments (especially ADR-007 for
   internal-only mode and the migration order in PHASE_3_DESIGN).
6. `docs/runbooks/reviewer-onboarding.md` — covers SQL helpers
   (`fn_review_accept` / `_edit_accept` / `_reject`) and SLA targets.
7. `docs/runbooks/gemini-deploy-prompt.md` — historical artefact;
   the deploy work it describes was done already.

If anything is unclear after reading those, look at:

- `git log --oneline -50` from the worktree path below — the commit
  messages are detailed and tell the story of what was done.
- The migrations under `supabase/migrations/` — every DB change is
  there, named for what it does.

---

## Repo + working location

| Thing | Value |
|---|---|
| Active worktree | `C:\Users\User\Desktop\Hanguk\.claude\worktrees\vigorous-haibt-f28e2d` |
| Active branch | `claude/vigorous-haibt-f28e2d` (also fast-forwarded to `main`) |
| Remote (Flutter app) | `github.com/asrbekshokirovich-bot/hanguk_app` |
| Remote (React CRM) | `github.com/asrbekshokirovich-bot/hanguk-uz` (NOT auto-cloned; clone to `C:\Users\User\Desktop\.audit\hanguk-uz` when you need it) |
| Live CRM | `hanguk.uz` (deployed from `hanguk-uz` repo via Vercel) |
| Supabase prod | project ref `lysjdtyanhdfphqyijsr` ("Hanguk 2026", ap-northeast-2) |
| Supabase staging | project ref `nhjzbjzhmugcmzchzxlv` ("hanguk-staging", ap-northeast-2) |

Always operate against the worktree at the path above. The other
worktrees in `.claude/worktrees/*` are stale.

---

## Mission

Asrbek said:

> completely remove the old university system and place the new one we built there

That means:

1. **Database level:** delete `public.universities` (697 legacy rows)
   after migrating any salvageable data into `public.institutions`
   (uni_db's table). Update every FK reference (`applications.university_id`,
   `student_university_priorities.university_id`) to point at
   institution rows instead.
2. **React CRM level:** swap the staff-facing universities feature
   (`/crm/universities`, the 4 components in `src/components/universities/`,
   the `useUniversities` hook, the `UniversitiesContent` page) so they
   read/write `institutions` instead of `universities`. Keep the staff
   workflows working: browse, search, partner toggle, AI add, manual
   edit, map visibility.
3. **Add the reviewer queue** at a CRM route like `/crm/admin/uni-db-review`,
   reading `v_review_queue_dashboard` and calling `fn_review_accept` /
   `fn_review_edit_accept` / `fn_review_reject`. Asrbek already has
   `profiles.role = 'uni_db_reviewer'` set on prod (set 2026-05-10 via MCP).
4. **Cleanup:** drop unused `university_*` tables that were never
   populated (`university_admissions`, `university_announcements`,
   `university_events`, `university_notes`, `university_staff_assignments`).
   Keep `gks_designated_universities` (200 real rows), `university_programs`
   (104 rows — evaluate quality), `university_admission_periods` (5),
   `university_documents` (4), `university_rooms` (9, internal staff chat).

---

## What's already done (don't redo)

- Phase 0/1/2/3 migrations applied to staging + prod (40+ migrations
  in `supabase_migrations.schema_migrations` on each).
- Three Edge Functions deployed to both projects (`get-pdf-url`,
  `register-push-token`, `notify-tracked-changes`) — verify_jwt=true.
- pg_cron schedule for `notify-tracked-changes` every minute on both
  projects. Service-role JWT in vault on prod (`uni_db_service_role_jwt`,
  219 chars). Staging vault still has placeholder; the user is OK with
  not enabling pushes.
- Three retention cron jobs (`fn_gc_pdf_access_log`,
  `fn_gc_change_event_outbox`, `fn_gc_user_push_tokens`) at 03:00/05/10
  UTC daily.
- 19 covering indexes on uni_db FK columns. Plus search_path pinned
  on 8 uni_db helper functions and 7 prod-app SECURITY DEFINER
  functions. Plus security_invoker=on on all 10 uni_db views. All
  Supabase advisor uni_db ERRORs cleared.
- 3 demo institutions on staging (SNU/Yonsei/KAIST) with full chain
  of admission_cycles + cycle_dates + tuition + requirements +
  scholarships + documents_required + guideline_documents.
  **Production has 0 institutions** — that's the gap this session
  closes.
- Flutter app has all the student-facing screens (institution detail,
  compare, tracker, notification settings) wired up + a misplaced
  `/admin/review` screen that was deleted in this session's plan
  (verify it's gone before re-adding to React).
- VAPID keys generated by Gemini (private in Gemini's session memory
  only — losing it means rotating; Apple .p8 + Firebase JSON not
  needed per Asrbek).
- Asrbek's role: `profiles.role = 'uni_db_reviewer'` on prod.

---

## Hard constraints

1. **Don't break hanguk.uz.** The live CRM serves the entire
   counselor team. Stage all changes on a Vercel preview deploy
   (push to a non-main branch on `hanguk-uz`) before merging to
   main. Every migration runs against staging first
   (`nhjzbjzhmugcmzchzxlv`) before prod (`lysjdtyanhdfphqyijsr`).
2. **Snapshot before destructive operations.** Before any DELETE
   or DROP on prod, do `create table <name>_backup_<date> as select
   * from <name>;` so it's reversible.
3. **Keep the FK chain intact.** `applications.university_id` and
   `student_university_priorities.university_id` reference
   `public.universities(id)`. Before dropping the legacy table you
   MUST repoint those FKs to `institutions(id)` AND update the rows.
4. **NEVER push to git remote, NEVER open PR, NEVER merge to main**
   on the `hanguk_app` repo from this session — the user will manage
   that. (You CAN push to `hanguk-uz` non-main branches for Vercel
   previews.)
5. **NEVER skip git hooks** (`--no-verify`, `--no-gpg-sign`) unless
   explicitly asked.
6. **Don't touch the 7 Flutter plugin auto-gen files** (`linux/`,
   `macos/`, `windows/` plugin registrants) that show up modified
   in `git status` — they're intentional local generations.
7. **Asrbek's preferences from prior sessions:** push notifications
   are deferred (no Apple/Firebase keys needed); Uzbek + Vietnamese
   + Mongolian translation are default-on without native reviewers
   (per ADR-004 amend 1 + amend 2); no Hetzner provisioning yet
   (account flagged for ID verification).

---

## Authorization scope

You may, without further confirmation:

- Apply migrations to staging via Supabase MCP `apply_migration`.
- Read prod data via `execute_sql` (read-only).
- Push to non-main branches on `hanguk_app`.
- Clone `hanguk-uz` to `C:\Users\User\Desktop\.audit\hanguk-uz`
  (read-only inspection).
- Use the Chrome MCP (browser device "Asrbek",
  deviceId 4b989db9-bad3-4a67-9bde-ac7a004dc5ba) for read-only
  navigation. Do NOT auto-click destructive UI actions.
- Take backup snapshots on prod (`create table ..._backup as ...`).
- Use the existing pg_dump 17.6 at
  `C:\Users\User\AppData\Local\Programs\PostgreSQL17\pgsql\bin\pg_dump.exe`.

You MUST ask before:

- Running DELETE/DROP/TRUNCATE on prod.
- Modifying `auth.users` rows.
- Pushing changes to the `hanguk-uz` `main` branch (auto-deploys to
  hanguk.uz).
- Generating new credentials or rotating existing ones.
- Installing system-level software.
- Activating any paid-API live call (Anthropic, Naver Papago, DeepL,
  EasyOCR live model). All adapters stay mocked behind
  `UNI_DB_LIVE_APIS=false` until explicitly flipped.

---

## Open questions still on the table

These four were surfaced in the audit (`docs/runbooks/hanguk-uz-staff-crm-architecture.md`)
and need user answers before the destructive cleanup phase. Ask
Asrbek up front:

1. **Drop legacy `universities` table entirely, or keep as
   `legacy_universities`** (mirror of how `legacy_scholarships` was
   handled in Phase 2)? Recommendation: keep as
   `legacy_universities` for one quarter, then drop. Cheap insurance.
2. **Lock `AIUniversityForm` and the bulk-import button during
   cleanup?** Without this, staff can keep adding rows mid-dedup and
   re-corrupt the dataset. Recommendation: yes, hide both UI entry
   points behind a feature flag for the duration of cleanup.
3. **Acceptable downtime** for the cutover? Realistic worst case is
   ~30 seconds of stale-cached data on the Universities tab.
   Recommendation: schedule for late evening UTC and announce to
   staff.
4. **The 5 `is_partner = true` rows.** Confirm those are the actual
   currently-contracted partners worth preserving with explicit
   guard rails. Recommendation: SELECT them and show Asrbek the list
   before any dedup migration touches their FKs.

---

## Recommended first sequence

1. **Read the audit + CURRENT_STATUS first.** Don't skip this.
2. **Ask Asrbek the 4 open questions above.** Get explicit answers
   before any destructive op.
3. **Phase 3R-A first** (lowest risk, highest immediate value to
   Asrbek):
   - Clone `hanguk-uz` to `C:\Users\User\Desktop\.audit\hanguk-uz`.
   - Add a new `UniDbReviewContent.tsx` under
     `src/components/crm/pages/`.
   - Reads `v_review_queue_dashboard` via supabase-js + react-query.
   - Three buttons → `supabase.rpc('fn_review_accept' / '_edit_accept' / '_reject', ...)`.
   - Role gate: query `profiles.role` and require
     `IN ('uni_db_reviewer', 'admin', 'uni_db_admin')`.
   - Add a sidebar entry under the existing Admin group via
     `useSidebarGroups`.
   - Push to a feature branch on `hanguk-uz`, get Vercel preview URL,
     have Asrbek smoke-test on the preview.
   - Merge to main only after Asrbek approves.
4. **Phase 3R-B next** (the cleanup + cutover). Six steps (see audit
   §5), each as its own migration:
   - Backup snapshot
   - Schema cleanup (drop dupe `website` column, add unique constraint)
   - Deduplicate + rewire `applications.university_id` and
     `student_university_priorities.university_id` to point at the
     surviving rows
   - Run `fn_copy_legacy_universities_to_institutions()` — already
     in the schema from Phase 1
   - Repoint the React CRM hooks (useUniversities → useInstitutions)
   - Drop or rename legacy table per Asrbek's answer to question 1
5. **Phase 3R-C last** (the new staff features): browse with
   advanced filters, compare 2-3 universities side-by-side,
   scholarship lookup by TOPIK/category, document checklist by
   country.

Each phase is its own focused effort. Don't try to do all three at
once.

---

## Tools you have

- **Supabase MCP** (server id `2e0f78da-48ca-489d-815c-7908d1e266b1`):
  `apply_migration`, `execute_sql`, `list_tables`, `list_migrations`,
  `get_advisors`, `deploy_edge_function`, `get_logs`,
  `list_edge_functions`, `search_docs`. Use these for all DB and
  Edge Function work.
- **Chrome MCP** (already connected to "Asrbek" browser device).
  Use `mcp__Claude_in_Chrome__*` tools for read-only navigation —
  e.g. inspect the live `hanguk.uz` after a deploy. Don't bypass
  bot checks.
- **Bash** for git, pg_dump, npm, flutter, supabase CLI.
- **Read / Edit / Write** for files in the worktree.
- **TodoWrite** for tracking multi-step work.

The Supabase CLI is at
`C:\Users\User\AppData\Local\Programs\Supabase\supabase.exe` and is
already authenticated. Don't `supabase login` again unless it errors.

---

## Test/verification expectations

- Python tests: 244/244 passing today (`services/uni_db/.venv/Scripts/python.exe -m pytest services/uni_db -q`).
- Flutter tests: 11/11 passing (`flutter test test/features/uni_db`).
- Flutter analyze: 0 issues on `lib/features/uni_db`, `lib/main.dart`,
  `lib/core`.
- Don't regress these. Run before any commit that touches code.

For migrations, after applying, verify with a focused SELECT or
advisor re-run. The Supabase advisor's full output is too large to
read directly — query specific lints with SQL against `pg_constraint`,
`pg_proc`, `pg_class.reloptions`, etc.

---

## Communication style Asrbek likes

- Plain English, no jargon dumps.
- Tables for comparison.
- Show concrete numbers (rows affected, time spent, files touched).
- Skip speculation. If you don't know, ask.
- Confirm before destructive prod operations.
- After completing each phase, summarise: branch state, migration
  count, test count, what's still on his side, what's still mocked.

When unsure about Asrbek's intent, ask him directly. He prefers
fewer surprises over autonomous progress on ambiguous items.

=== END PROMPT ===

---

## How to use this prompt

1. Open a fresh Claude chat (any client — claude.ai web, Claude Code,
   etc.).
2. Copy everything between the BEGIN/END PROMPT markers above.
3. Paste it as your first message in the new session.
4. Optionally add a one-line steer like "go" or "start with phase 3R-A
   reviewer screen" to skip the question round.

The new session will read the audit + CURRENT_STATUS files from disk
(they're committed to the same repo at `f92f0c4`) and pick up
exactly where this one left off.
