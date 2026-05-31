# Phase 3R-A + 3R-B handoff — hanguk-uz (the React staff CRM)

> Generated 2026-05-10 by the Phase 3R-A/3R-B build session.
> Apply order: db migrations FIRST (already applied to staging+prod —
> see "Database (already done)" below), then these two CRM patches.

## Database (already done — included for the record)

These three migrations were applied to **both** Supabase projects from
this session via `apply_migration` on the MCP. They are committed in
the hanguk_app worktree under `supabase/migrations/`:

| version | title | what it did |
|---|---|---|
| `20260701001000_uni_db_v3_review_action_rpcs.sql` | review action RPCs + reviewer SELECT policy | Adds `fn_review_accept` / `fn_review_edit_accept` / `fn_review_reject` (SECURITY DEFINER, role-gated). Adds `review_queue_reviewer_select` RLS policy on `public.review_queue` (the prior policy only allowed admin SELECT, so `v_review_queue_dashboard` returned empty for `uni_db_reviewer` users — silent bug fixed). |
| `20260510130000_uni_db_v3_drop_legacy_universities.sql` | drop legacy `public.universities` + 5 unused `university_*` tables | Forensic backups (`*_backup_20260510`), drops 20 FK constraints, deletes 7 fake `applications` rows, NULLs FK columns on the kept tables, drops `public.universities`, drops `university_admissions`/`_announcements`/`_events`/`_notes`/`_staff_assignments`, drops `fn_legacy_universities_present` + `fn_copy_legacy_universities_to_institutions`. |
| `20260510130100_uni_db_v3_rename_to_institution_id.sql` | rename `university_id` → `institution_id` + add FKs to `public.institutions` | Renames `university_id` (and `target_university_id`) on every kept table, adds new FKs to `public.institutions(id) ON DELETE SET NULL`, recreates the `room_members` RLS policy against the renamed columns, adds covering indexes on the new FK columns. |

Verified post-apply on prod: `to_regclass('public.universities') IS NULL`,
0 lingering `university_id` columns in live tables (only in `*_backup_*`
tables), 26 `institution_id` FKs + 2 `target_institution_id` FKs in place.

## CRM patches (apply on `hanguk-uz` repo, not yet pushed)

The build sandbox has no GitHub credential, so the two patches are
shipped as files. On a machine with push access to
`github.com/asrbekshokirovich-bot/hanguk-uz`:

```bash
cd /path/to/hanguk-uz                 # fresh clone or your existing checkout
git fetch origin main
git checkout main && git pull
git switch -c claude/uni-db-review-screen
git am < /path/to/handoff/0001-hanguk-uz-uni-db-review-screen.patch
git am < /path/to/handoff/0002-hanguk-uz-cutover-to-institutions.patch
git push -u origin claude/uni-db-review-screen
```

Vercel preview URL appears in the GitHub branch list. Smoke-test
checklist on the preview before merging to main:

1. Log in as Asrbek (already has `profiles.role='uni_db_reviewer'`).
2. Sidebar → **Admin** group → **Uni DB Review** entry should appear.
3. Click it → page renders the four stats cards (open / overdue / P1+P2
   / avg confidence). Review queue empty for now (no live crawl); the
   "queue is empty" copy is expected.
4. Sidebar → **Management** → **Universities** → page renders the
   four stats (total / partners / on map / with domain / with geo).
   Click "Add institution", fill the dialog, save — row appears.
5. CRM dashboard, students, applications, kakao map, finance — all
   should still load. Some student-facing display will show blanks
   for `name_uz` / city translations until the locale-shell rebuild
   in Phase 3R-C.

## Patch files in this directory

| file | size | what |
|---|---|---|
| `0001-hanguk-uz-uni-db-review-screen.patch` | 40 KB | Phase 3R-A — `/crm/admin/uni-db-review` page + `useUniDbReviewer` + `useReviewQueue` + sidebar entry. |
| `0002-hanguk-uz-cutover-to-institutions.patch` | 200 KB | Phase 3R-B — bulk-rename column refs, rewrite `useUniversities` to query `institutions`, replace `UniversitiesContent` with a clean version, delete the four legacy components, neuter `koreanUniversitiesApi`, surgical fixes to ~12 hooks/components. |
| `0001-0002-uni-db-cutover.patch` | 15 MB | **DO NOT APPLY.** Bad output from a `git format-patch -2` invocation. Safe to delete. |

The 15 MB file and the duplicate 40 KB file can't be deleted from the
build sandbox (mount is rw-but-no-unlink). On Windows side:
```
del C:\Users\User\Desktop\Hanguk\.claude\worktrees\vigorous-haibt-f28e2d\handoff\0001-0002-uni-db-cutover.patch
del C:\Users\User\Desktop\Hanguk\.claude\worktrees\vigorous-haibt-f28e2d\handoff\0001-hanguk-uz-uni-db-review-screen.patch
```

## Known follow-ups (Phase 3R-C scope)

1. **Regenerate Supabase types**: `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts` from a checkout linked to the prod project. Drops the now-fictional `Tables<'universities'>` definition; the patch leaves it intact intentionally so cutover compiles.
2. **Student-side locale rebuild**: many components in `src/components/student/` still read `.name_uz`, `.city_en`, etc. on rows that are now `institutions` shape — those return `undefined` and the UI shows blanks. Rebuild the student locale shell against `display_names` jsonb (`name_ko`, `name_en` plus `display_names->>'uz'` etc.).
3. **Re-implement AI add + bulk import**: `koreanUniversitiesApi` is currently neutered. Phase 3R-C should rebuild against `public.institutions` + `recruitment_units`, ideally using the discovery worker (`services/uni_db/`) as the single ingest path.
4. **Re-implement university calendar / announcements**: `useUniversityEvents` and `useUniversityAnnouncements` are stubbed. Re-route reads to `public.cycle_dates` (already powering VerifiedDeadlinesOverlay in the Flutter app) + `public.announcements` (uni_db).
5. **`/university-portal` route**: currently shows the no-assignment empty state. Either rewire against a new `institution_staff_assignments` table or delete the route.

## Worktree side housekeeping

* `index.lock` from a partial commit attempt is still in
  `.git/worktrees/vigorous-haibt-f28e2d/`. Windows side:
  `del C:\Users\User\Desktop\Hanguk\.git\worktrees\vigorous-haibt-f28e2d\index.lock`
* The new SQL migration files + this handoff/ + the CURRENT_STATUS
  update are not yet committed on the worktree branch. After clearing
  the index lock:
  ```
  git add supabase/migrations/20260510130000_uni_db_v3_drop_legacy_universities.sql \
          supabase/migrations/20260510130100_uni_db_v3_rename_to_institution_id.sql \
          supabase/migrations/20260701001000_uni_db_v3_review_action_rpcs.sql \
          handoff/ \
          CURRENT_STATUS.md
  git commit -m "feat(uni_db): Phase 3R-A + 3R-B — drop legacy universities, rewire to institutions"
  ```
