# `hanguk-uz` staff CRM — architecture + data-quality audit

> Phase 0 deliverable for the React-side migration. Read-only inspection
> of `asrbekshokirovich-bot/hanguk-uz` (the React/Lovable codebase that
> deploys to hanguk.uz) plus a quality scan of the manually-curated
> universities dataset that already lives in production.
>
> Scope: orient any future agent (or human) working on the React side
> so they don't reinvent patterns or duplicate data structures.
>
> Status: this is **planning intelligence only.** No code or data has
> been changed in this audit pass.

---

## 1. Stack & conventions (`hanguk-uz`)

| Layer | Choice |
|---|---|
| Framework | Vite + React 18 + TypeScript |
| Routing | `react-router-dom` v6 with `BrowserRouter` |
| State | `@tanstack/react-query` v5 + React Context for cross-cutting (Auth, StaffPresence, MentionNotifications, StudentData, Leads, Calls, Messages, Intercom voice) |
| UI primitives | shadcn/ui on top of Radix (`@radix-ui/react-*`) |
| Theme | `next-themes` |
| i18n | `react-i18next` (file under `@/lib/i18n`); UI ships in **uz / en / ru / ko** |
| Mobile | Capacitor 8 wrapper for Android + iOS |
| Server | `@supabase/supabase-js` v2 — singleton at `@/integrations/supabase/client.ts` |
| Auth | Custom `AuthContext` wrapping `supabase.auth.onAuthStateChange` |
| Role gate | `useUserRole()` hook reads `public.user_roles` and exposes `isStaff / isOwner / isAdmin / isCallOperator / isDocumentHandler / isUniversityStaff` |
| Form lib | `react-hook-form` with `@hookform/resolvers` |
| Build target | Vite production build deployed to Vercel from `main` |

### File layout

```
src/
├── App.tsx                          // BrowserRouter + global providers
├── main.tsx
├── pages/                           // Top-level routes
│   ├── Index.tsx                    // /
│   ├── Auth.tsx                     // /auth
│   ├── CRMPortal.tsx                // /crm/* (the staff CRM, 471 lines)
│   ├── StudentPortal.tsx            // /portal (student-facing)
│   ├── UniversityStaffPortal.tsx    // /university-portal
│   ├── InterviewPractice.tsx
│   ├── StudyPlanTrainer.tsx
│   └── ...
├── components/
│   ├── auth/ProtectedRoute.tsx      // login-only gate (no role check)
│   ├── crm/                         // CRM shell (Sidebar, SubNavigation, Dashboard, lists, pages/)
│   │   └── pages/                   // Lazy-loaded CRM panels
│   │       ├── UniversitiesContent.tsx      ← uni feature lives here today
│   │       ├── StaffContent.tsx
│   │       ├── ReportsContent.tsx
│   │       ├── LeadsContent.tsx
│   │       └── ...
│   ├── universities/                // The 4 university components
│   │   ├── UniversityList.tsx       (307 lines)
│   │   ├── UniversityDetailSheet.tsx(457 lines)
│   │   ├── UniversityForm.tsx       (402 lines, hand-edit form)
│   │   └── AIUniversityForm.tsx     (559 lines, LLM-search + add form)
│   └── ui/                          // shadcn/ui primitives
├── hooks/
│   ├── useAuth.ts (re-exports AuthContext)
│   ├── useUserRole.ts               // role check pattern
│   ├── useUniversities.ts           // CRUD on public.universities
│   └── useCRMData.ts                // composite loader
├── contexts/AuthContext.tsx
├── lib/
│   ├── i18n.ts
│   └── api/
│       ├── koreanUniversities.ts    // bulk import path
│       └── applicationForms.ts
└── integrations/supabase/
    ├── client.ts                    // export const supabase = createClient(...)
    └── types.ts                     // generated Database types
```

### Routing pattern

Top-level in `App.tsx`:

```
/                       → Index
/auth                   → Auth (login/signup)
/portal                 → StudentDataProvider → StudentPortal
/crm/*                  → CRMPortal (no ProtectedRoute wrapper — the
                          portal handles auth + role internally)
/interview-practice     → ProtectedRoute → InterviewPractice
/study-plan-trainer     → ProtectedRoute → StudyPlanTrainer
/university-portal      → ProtectedRoute → UniversityStaffPortal
/system-map             → SystemMap
```

Inside `CRMPortal`, navigation is **sidebar-driven**, not nested
React-Router routes. The sidebar (`useSidebarGroups`) returns groups
of items, each with a `url`, a `visible` flag computed from
`useUserRole`, and a content panel. Active panel is derived from
`location.pathname` via the URL prefix match. New uni_db screens
should:

1. Add a sidebar group entry in `useSidebarGroups` with the right
   `visible: isStaff && (isAdmin || hasRole('uni_db_reviewer'))` etc.
2. Drop a new `Content.tsx` under `src/components/crm/pages/`
3. Lazy-load it from `CRMPortal.tsx`

### Role gate pattern

`useUserRole()` reads `public.user_roles`. The existing app_role
ENUM on prod is:

```
'owner' | 'admin' | 'call_operator' | 'document_handler' | 'university_staff'
```

That ENUM does NOT include `uni_db_reviewer`. The bridge migration
I added in Phase 3 (`00000000000003_pre_uni_db_profiles_role.sql`)
put `role text` on `public.profiles` separately so uni_db's RLS can
look up reviewer status without disturbing the existing ENUM. So
the React side has two role systems that coexist:

| System | Where | Purpose |
|---|---|---|
| `user_roles.role` (`app_role` ENUM) | The CRM's existing gate | Owner / admin / call_operator / document_handler / university_staff |
| `profiles.role` (free text) | uni_db's RLS + the new reviewer surface | `student / contracted_student / counselor / admin / uni_db_reviewer` |

**For new uni_db screens in the CRM**, two patterns work:

- **Reviewer-only screens** (`/admin/uni-db-review`): gate via
  `profiles.role IN ('uni_db_reviewer', 'admin')` — read it via a
  one-shot supabase query alongside the existing `useUserRole`.
- **Staff-only screens** (browse / compare / scholarship lookup):
  gate via existing `useUserRole().isStaff`. All staff (counselors,
  admins) need browser access while advising students.

### Auth flow

`AuthContext` wraps `supabase.auth.onAuthStateChange`. Login paths:

| Method | Route | Storage |
|---|---|---|
| Username + password (staff) | `/auth` → `signInWithUsername` | Supabase auth.users (email = `{username}@hanguk.local`) |
| Magic code (contracted students) | `/auth` → `student-login-v2` Edge Function (already deployed) | Supabase session via `recoverSession` |
| Email + password (public guest) | `/auth` → `signInGuest` | `public.leads` table (NOT auth.users) — note this is a custom non-Supabase-auth flow used for paid lead acquisition |

**For uni_db reviewer access**: staff already log in via username + password.
Asrbek already has `profiles.role = 'uni_db_reviewer'` on prod (set via MCP
on 2026-05-10). The reviewer screen just checks that role.

### Component vocabulary

shadcn/ui primitives the CRM uses heavily:

```
Card / CardContent / CardHeader / CardTitle
Button / Badge / Input / Switch / Select
AlertDialog (confirmations)
Dialog (modals — used by AIUniversityForm)
Tabs / TabsContent / TabsTrigger / TabsList
ScrollArea
Tooltip
Toast (via @/components/ui/toaster + sonner)
Progress (the import progress bar)
```

Iconography: `lucide-react` (Search, MapPin, Globe, GraduationCap,
ExternalLink, Eye/EyeOff, Sparkles, AlertCircle, etc.).

### Data fetching pattern

`@tanstack/react-query` is configured but most CRM hooks
(`useUniversities`, `useCRMData`, `usePayments`) use a manual
`useState + useEffect + supabase.from(...).select()` pattern instead
of `useQuery`. **For new uni_db hooks, follow `useQuery`** — it's
the configured library and gives caching/staleness for free.

---

## 2. Existing universities feature in the CRM

Lives at `/crm/universities` (resolved via sidebar). The
`UniversitiesContent` page composes:

- **`UniversityList`** — paginated card grid with search, partner
  toggle, map-visibility toggle, edit, delete. Data: `Tables<'universities'>` from
  the LEGACY `public.universities` table.
- **`UniversityForm`** — hand-edit modal. Lets staff fill name in
  4 languages + city + tuition + ranking + programs + requirements.
- **`AIUniversityForm`** — LLM-driven add: type a name, it calls the
  `search-university` Edge Function, returns 1+ candidates with
  pre-filled fields, staff click "Save".
- **`UniversityDetailSheet`** — read-only side panel.

There's also a "Background import" button that calls
`koreanUniversitiesApi.startBackgroundImport()` → invokes the
`import-korean-universities` Edge Function (already deployed) which
does a discovery phase + website-enrichment phase, polled via
`localStorage` job IDs.

**The CRUD is exclusively on `public.universities`. None of these
screens touch `public.institutions` (the uni_db table).**

---

## 3. Two parallel datasets — the core architectural mismatch

### Counts on prod (lysjdtyanhdfphqyijsr) as of 2026-05-10

| Table | Rows | Owner |
|---|---|---|
| `public.universities` (legacy CRM-managed) | **697** | The React CRM, manually + AI-form added |
| `public.institutions` (uni_db) | **0** | The Phase 0/1/2/3 pipeline (untouched on prod, 3 demo rows on staging) |
| `public.gks_designated_universities` | 200 | Korean GKS scholarship list |
| `public.university_programs` | 104 | CRM university programs feature |
| `public.student_university_priorities` | 33 | Per-student ranking |
| `public.applications` | 7 (`university_id` populated) | Student applications |
| `public.university_admission_periods` | 5 | Application cycle windows |
| `public.university_documents` | 4 | Per-uni document templates |
| `public.university_rooms` | 9 | Internal staff chat rooms keyed to a uni |
| `public.university_admissions / university_announcements / university_events / university_notes / university_staff_assignments` | 0 each | Defined but unused |

The CRM lives entirely on `universities`. The uni_db pipeline writes
to `institutions`. They share no foreign keys.

The Phase 1 `legacy_compat` migration created two helpers on the
schema:

- `fn_legacy_universities_present()` — returns true (697 rows)
- `fn_copy_legacy_universities_to_institutions()` — INSERTs into
  `institutions` and won't be invoked until a cleanup run is
  deliberately triggered

So the path forward is: clean the legacy dataset, then either
(a) call `fn_copy_legacy_universities_to_institutions()` to seed
institutions with the cleaned data, or (b) delete the legacy table
entirely and rebuild from a clean source via the discovery worker.

---

## 4. Data quality audit on `public.universities` (697 rows)

### Headline metrics

| Metric | Count | % of 697 | Severity |
|---|---|---|---|
| Total rows | 697 | 100% | — |
| Distinct names (Korean, lowercase) | 449 | 64% | — |
| Rows missing `name_ko` entirely | 249 | 36% | **HIGH** — orphan English-only rows |
| Cross-language dupe pairs (same `name_en`, different `city_en` spelling) | 181 pairs (~362 rows) | ~52% of rows in dupe pairs | **HIGH** — bilingual import duplicated |
| True exact dupes (same `name_en` + same `city_en`) | 0 | 0% | clean (good) |
| Rows with placeholder city ("South Korea" / "Korea") | 49 | 7% | MEDIUM |
| Rows missing `website` | 600 | 86% | **HIGH** |
| Rows missing `website_url` (second column) | 449 | 64% | HIGH |
| Rows missing geo (`latitude` or `longitude`) | 485 | 70% | HIGH |
| Rows missing `ranking` | 687 | 99% | LOW (mostly aspirational) |
| Rows missing `global_rank` | 448 | 64% | LOW |
| Rows never enriched (`enriched_at IS NULL`) | 452 | 65% | MEDIUM |
| Rows flagged `is_partner` | 5 | 0.7% | informational |
| Rows `is_visible_on_map` | 260 | 37% | informational |
| Rows missing `institution_type` | 0 | 0% | clean |
| Rows missing `name_ru` | 686 | 98% | LOW |

### Active-use scope

Only **20 distinct universities** are referenced by application
data (`applications.university_id` + `student_university_priorities.university_id`).
The other ~677 rows are catalogue noise.

### Top duplicate pattern (sampled)

```
name_en                            occurs    cities seen
─────────────────────────────────  ──────    ─────────────────────────
Ajou University                       2      "Suwon"  |  "수원시"
Andong National University            2      "Andong" |  "안동시"
Baekseok University                   2      "Cheonan"|  "천안시"
Catholic University of Korea          2      "Seoul"  |  "서울특별시"
Chung-Ang University                  2      "Seoul"  |  "서울특별시"
Chonbuk National University           2      "Jeonju" |  "전주시"
Chosun University                     2      "Gwangju"|  "광주광역시"
Yonsei / SNU / KAIST  etc            2 each  same Eng vs Korean city
```

**Diagnosis**: the bulk import was run twice — once with
English city locale, once with Korean. Both runs INSERTed (no
ON CONFLICT key existed). The English-only side is the 249 rows
that have empty `name_ko`. The Korean-side has Korean cities like
`서울특별시` etc.

### Schema duplication

The `universities` table has **two website columns**:

- `website` (86% null)
- `website_url` (64% null)

Likely artefact of an enrichment migration that didn't drop the
old column. Cleanup should: pick one, copy non-null from the other,
drop the loser.

### Suspect rows beyond duplicates

- **49 rows** use `'South Korea'` or `'Korea'` as `city_en` — useless for any city-level filter.
- **485 rows** have null geo — won't render on the Kakao map at all (only 260 are flagged `is_visible_on_map = true`, so 225 of the geo-missing are INTENTIONALLY hidden; the rest are misconfigured).
- **452 rows never enriched** — the import worker wrote the row but
  the `enriched_at` follow-up never ran or never finished. These
  are the lowest-quality rows.

---

## 5. Implications for the migration plan

### What changes from the original Phase 3+ plan

The **original plan** assumed I'd build new institution-browsing
screens in the React CRM that read from `public.institutions`. That
was wrong because:

1. The CRM already has working university screens for staff to use.
2. Staff have ~700 manually-curated rows that they actively
   reference (~20 in `applications`, more in lookup workflows).
3. `public.institutions` has 0 rows on prod; switching the React
   screens to read from it would show staff an empty list.

### What the new plan should be

**Phase 3R-A — Reviewer queue add** (lowest risk, highest value):

1. Add `UniDbReviewContent.tsx` under `src/components/crm/pages/`.
2. Reads `v_review_queue_dashboard` via supabase-js + react-query.
3. Three buttons → `supabase.rpc('fn_review_accept' / '_edit_accept' / '_reject', ...)`.
4. Role gate: `profiles.role IN ('uni_db_reviewer', 'uni_db_admin', 'admin')`.
5. Add sidebar item under the existing Admin group.
6. **No data changes.** Review queue is fed by the
   `notify-tracked-changes` outbox + the discovery worker; both will
   be empty until live crawl is approved.

**Phase 3R-B — Data cleanup of legacy `public.universities`**:

The mess is significant enough to warrant a dedicated migration.
Recommended sequence:

1. **Take a backup snapshot** — `create table universities_backup_20260510 as select * from public.universities;` so any cleanup is reversible.
2. **Schema cleanup migration**:
   - Drop the duplicate `website` column (after coalescing into `website_url`).
   - Add a unique constraint on `(lower(name_en), lower(name_ko))` to prevent future re-introduction of dupes.
3. **Deduplication migration**:
   - For each cross-language dupe pair, keep the row with the Korean city (`name_ko` is set + `city_en` matches the Korean spelling), update its FKs from references in `applications` and `student_university_priorities` so they all point to the kept row, then delete the English-only twin.
   - Update placeholder cities (`'South Korea'` / `'Korea'`) by joining against `kakao` geo lookup or leaving as null.
4. **Migration to canonical `institutions`**:
   - Run `fn_copy_legacy_universities_to_institutions()` (already
     written in Phase 1) to seed `institutions` with the cleaned set.
   - Spot-check by joining the seeded rows against `gks_designated_universities` for sanity.
5. **CRM cutover**:
   - Once `institutions` is the source of truth, swap `useUniversities` to read from `institutions` (or from the `universities` view that uni_db Phase 2 created which already wraps `institutions` — see plan §I).
   - Drop the legacy `universities` physical table.

**Phase 3R-C — Deeper staff features** (browser, compare, scholarship lookup):

After the cleanup is in place, build the new staff-facing screens
described in the original plan. They'll work because they'll read
from a canonical `institutions` table that has accurate, deduped
data.

### Estimated effort

| Phase | Estimate | Risk |
|---|---|---|
| 3R-A (reviewer screen in CRM) | 3–4 hours | low |
| 3R-B Step 1 (backup) | 1 minute via MCP | trivial |
| 3R-B Step 2 (schema cleanup) | 1 hour, single migration | low |
| 3R-B Step 3 (dedupe + FK rewire) | 3 hours, careful migration with verifications | **medium** — touches application + priorities FKs |
| 3R-B Step 4 (copy to institutions) | 1 hour, runs `fn_copy_legacy_universities_to_institutions` then verifies | low |
| 3R-B Step 5 (CRM cutover) | 1 day, swaps every read site | medium |
| 3R-C (browse, compare, scholarship) | 2–3 days | medium |

Total: roughly a focused week of work, almost all of which lands
on the React side and not Flutter.

### What this audit didn't cover

- I didn't read `UniversityForm.tsx`, `UniversityDetailSheet.tsx`,
  `useCRMData.ts` line-by-line. The audit focused on patterns and
  data quality, not full code review. The implementation phase
  should still cover those files when porting.
- I didn't check what `university_programs` (104 rows) actually
  is — could be programmatic enrichment, could be more manual
  noise. Should be evaluated as part of 3R-B.
- I didn't check the existing `student-university-priorities`
  semantics — they may need different handling during the FK
  rewire step.
- The Capacitor mobile build path is unexplored; whatever changes
  ship to the React CRM will also need an Android/iOS rebuild via
  `cap sync`.

---

## 6. Open questions for the owner

1. **Drop legacy `universities` table after cutover?** Or keep it
   read-only as `legacy_universities` for archive (mirroring how
   we treated `legacy_scholarships`).
2. **Disable `AIUniversityForm` and `koreanUniversitiesApi.startBackgroundImport`** in the CRM during cleanup? Otherwise staff can keep adding rows mid-cleanup and corrupt the dedup pass.
3. **Acceptable downtime for the cutover?** The dedupe migration
   is destructive. A 30-second window where the Universities tab
   shows stale-cached data is the worst case.
4. **Confirm**: are the 5 `is_partner` rows the actual current
   contracted partners we'd want to preserve at all costs? If yes,
   they need explicit guard rails in the dedupe migration.

---

## 7. Where this audit lives

This document is committed to `hanguk_app/docs/runbooks/` because:

- The Phase 0–3 work is tracked in this repo's git history.
- The `hanguk-uz` repo is owned by the user; we don't add
  cross-cutting docs there without explicit permission.
- A future agent picking up the React work can reach this audit
  via the existing CURRENT_STATUS reading-back snapshot.

When the React-side implementation phase begins, copy or symlink
this file into the `hanguk-uz` repo so that codebase carries its
own copy of the architecture record.
