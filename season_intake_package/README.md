# Seasons / Intakes — package for Claude Code

Adds a **global Spring/Fall intake switcher** to the Hanguk CRM: one click to change season, with
**every season's data completely separated**.

## How it works
- Two intakes per year: **Spring** and **Fall**. The app shows **one active intake** at a time.
- A **switcher in the top bar** (segmented Spring|Fall + year stepper ‹2026›) changes it in one click.
- Switching re-scopes the **entire app** — students, applications, documents, finance, tasks,
  calendar — to that intake. Nothing mixes between seasons.
- The choice persists across refresh and is shareable by URL.

## What's inside
- **`KICKOFF_PROMPT.md`** ← paste this into Claude Code FIRST (it sets up + makes the agent plan).
- **`SEASON_REQUEST.md`** ← the full UI/UX plan, data model, per-screen behavior, acceptance criteria.
- **`Season-Switcher-Preview.html`** ← open in any browser. Click Spring ⇄ Fall (and the year arrows)
  to see each season load its own isolated data. Dark/Light toggle top-right. Works offline.
- **`reference/season-demo.jsx`** ← the exact mockup to match.

## How to use
1. Copy `season_intake_package/` into the **hanguk-uz** repo (commit/push).
2. Paste **`KICKOFF_PROMPT.md`** into Claude Code, approve its plan, then it builds in phases
   (using `SEASON_REQUEST.md` as the spec).

> This one DOES add a global intake scope + a forward-only DB migration (intakes table + intake_id
> FK, with backfill) — no data loss. Routing, auth, roles and i18n stay intact.
