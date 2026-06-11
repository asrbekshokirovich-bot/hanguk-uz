# KICKOFF — paste this into Claude Code FIRST (run in the `hanguk-uz` repo)

```
I've added a folder "season_intake_package" to this repo (from a zip — if it's still zipped, unzip it
to the repo root first). Set yourself up before coding:

STEP 1 — LOCATE & READ
  • Find season_intake_package/ (run: find . -iname "*season_intake*" -o -iname "*season*package*").
    Unzip if needed.
  • Read, in order, as the source of truth:
      1. season_intake_package/README.md
      2. season_intake_package/SEASON_REQUEST.md          ← full UI/UX plan + data model + acceptance
      3. season_intake_package/reference/season-demo.jsx  ← the EXACT target mockup
  • Open season_intake_package/Season-Switcher-Preview.html in a browser (light + dark). Click
    Spring ⇄ Fall and the year stepper to SEE how each season swaps to its own isolated dataset.
    This is the visual + behavioral contract.

STEP 2 — UNDERSTAND IT CORRECTLY
  • Hanguk runs TWO intakes per year: Spring and Fall. The CRM must show ONE active intake at a time,
    switch with ONE click, and keep every season's data COMPLETELY SEPARATE (students, applications,
    documents, finance, tasks, calendar — everything).
  • season-demo.jsx is a plain React + inline-style mockup. Do NOT copy its inline styles, hex, or demo
    data. Reproduce its switcher UI and the season-scoping BEHAVIOR using THIS repo's stack: shadcn/ui,
    Tailwind semantic tokens, lucide-react, real Supabase/react-query data, i18next strings.

STEP 3 — PLAN FIRST (reply, don't code yet)
  Give me a short PLAN covering:
    a) the IntakeContext/useActiveIntake provider (state + localStorage + URL persistence),
    b) exactly how every data query will receive the active-intake filter (the centralized approach),
    c) the DB change (intakes table + intake_id FK) as a FORWARD-ONLY migration with backfill,
    d) where the switcher mounts (top bar on every CRM page + portal headers),
    e) the list of screens/queries you'll scope.
  Then implement to match SEASON_REQUEST.md's ACCEPTANCE list.

GUARDRAILS:
  • Keep routing, Supabase/react-query, RLS/roles and i18n intact. This DOES add a global intake scope
    that filters reads + a forward-only migration — no data loss, no destructive changes.
  • Semantic tokens only (no hardcoded colors); Spring accent = lime, Fall = amber/warning tokens.
    Reuse shadcn/ui. Localize every string (uz/ru/en/ko, uz primary). Skeleton + EmptyState per season.
  • Verify light AND dark; run npm run build, npm run lint, npx tsc --noEmit — all clean — before done.

When finished show me: (a) IntakeContext + how queries get the filter, (b) the migration, (c) dark-mode
screenshots of Spring vs Fall on the Applications board proving the data differs.

After I approve the plan, proceed phase by phase: 1) intake schema + context + switcher in the shell,
2) scope Applications + Dashboard, 3) scope Students/Finance/Documents/Tasks/Calendar/Leads,
4) Manage-intakes screen + empty states + i18n, 5) QA in light/dark. Stop for review after each phase.
```
