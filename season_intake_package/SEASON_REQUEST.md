# SEASONS (Intakes) — UI/UX plan + Claude Code request

Hanguk runs **two intakes per academic year: Spring and Fall** (2 seasons / year). The CRM must show
**one season at a time**, switch with **one click**, and keep **every season's data completely
separate** — students, applications, documents, finance, tasks, calendar, everything.

Reference mockup: `reference/season-demo.jsx` — open `Season-Switcher-Preview.html` and click
**Spring ⇄ Fall** (and the year ‹ 2026 ›) to see each season swap to its own isolated dataset, in
light + dark.

> Rules: visual/UX + data-scoping change. Keep routing, Supabase/react-query, RLS/roles, i18n.
> This DOES introduce a global "active intake" scope that filters reads — implement it cleanly,
> no destructive migrations. Semantic tokens only. Verify light + dark. Build + lint + tsc clean.

---

## 1. The model
- An **intake (season)** = `{ season: 'Spring' | 'Fall', year: number }`, e.g. "Spring 2026".
- Exactly **two seasons per year**. The app always has **one active intake**.
- **Total data isolation:** every record (student application, document, payment, task, calendar
  event, lead, message thread tied to an application) belongs to exactly one intake. When an intake
  is active, the user sees ONLY that intake's data, everywhere. Switching seasons reloads the whole
  workspace scoped to the new intake.

## 2. The switcher (one click)
- A **global control in the CRM top bar** (and the portals' headers), present on every page.
- Layout (see mockup `SeasonSwitcher`): a **segmented Spring | Fall** toggle (one click switches) +
  a compact **year stepper** `‹ 2026 ›`. Spring = sun glyph in lime; Fall = flag/leaf glyph in amber.
  Disable a season that doesn't exist for the selected year.
- Selecting a season **instantly re-scopes the entire app**. Persist the choice (localStorage +
  URL query, e.g. `?intake=spring-2026`) so refreshes and deep links keep the season. Default to the
  current open intake.

## 3. Global scoping (the important part)
- Create a single **IntakeContext / useActiveIntake()** provider at the app root holding
  `{ season, year, intakeId }` + a setter. The switcher writes to it; persist to localStorage + URL.
- **Every data read is filtered by the active intake.** Add an `intake_id` (or `season` + `year`)
  filter to every relevant Supabase query: students-in-pipeline, applications, documents, payments/
  finance, tasks, calendar, leads, dashboard aggregates. Centralize this — e.g. a `useIntakeQuery`
  wrapper or a shared `.eq('intake_id', activeIntakeId)` applied in the data layer — so no screen can
  forget it. Counts, kanban, charts, tables: all reflect ONLY the active intake.
- **Schema:** if the DB doesn't already model intakes, add an `intakes` table
  (`id, season, year, is_open`) and an `intake_id` FK on applications (and on any
  intake-specific child records). Provide a forward-only migration; backfill existing rows to the
  current intake. DO NOT delete or rewrite existing data. (If you can't migrate, derive the season
  from an existing field and filter on that — but flag it.)
- **Writes inherit the active intake:** creating a student application / payment / task while
  "Spring 2026" is active stamps that intake_id automatically.
- **Roles/RLS unchanged** — just add the intake filter alongside existing policies.

## 4. Per-screen behavior
- **Top bar:** the switcher + a subtle active-intake label. A one-line banner on the Applications/
  Dashboard pages: "You're viewing {Season} {Year}. All data is separated per intake." with a
  "Manage intakes" action (open/close a season, set the default).
- **Dashboard:** all stats, charts and lists scoped to the active intake; the title/subtitle name the season.
- **Applications (university kanban):** shows only universities/students in the active intake.
- **Students:** shows students who have an application in the active intake (a student applying in
  both Spring and Fall appears under each, with that intake's applications only).
- **Finance / Documents / Tasks / Calendar / Leads:** all scoped to the active intake.
- **Empty state per season:** a new/planning intake shows a friendly "No data yet for {Season}
  {Year}" with a primary action, not a blank screen.
- **Manage intakes** screen: list seasons by year, mark open/closed, set which one is the default
  landing intake, create the next year's Spring/Fall.

## 5. States, i18n, theming
- shadcn Skeleton while a season's data loads; shared EmptyState per empty season/column.
- Localize all new strings (uz/ru/en/ko; uz primary): "Spring", "Fall", "intake", "Open", "Planning",
  "Manage intakes", the banner copy, etc.
- Semantic tokens only; Spring accent = lime, Fall accent = warning/amber (use existing tokens).
  Verify light + dark.

## ACCEPTANCE (all true)
- A global Spring|Fall + year switcher sits in the top bar on every CRM page; one click changes season.
- Switching seasons re-scopes the ENTIRE app; no screen ever mixes two seasons' data.
- The active intake persists across refresh and is shareable via URL.
- New records created under an active season are stamped with that intake.
- A student with applications in two seasons shows the right data under each, never combined.
- Roles/RLS intact; forward-only migration (no data loss); light + dark clean; lint + tsc clean.

When done, show me: (a) the IntakeContext + how queries get the filter, (b) the migration, and
(c) screenshots of Spring vs Fall on the Applications board (dark mode) proving the data differs.
