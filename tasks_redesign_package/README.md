# Tasks — complete redesign package (for Claude Code)

Turns the crowded Tasks page into a **calm, professional task workspace**.

## What changes
- The **five loud stat cards** → **one quiet summary bar** (progress ring + inline metrics).
- A slim header with a live one-line summary + a **Focus / Board** toggle + one **New task** button.
- An inline **quick-add** row.
- **Focus view**: tasks grouped into **Overdue · Today · Upcoming · Completed** with clean rows
  (checkbox-complete, priority bar, due chip, linked student, assignee avatar).
- **Board view**: **To do · In progress · Done** kanban cards.
- A refined **task detail drawer** (properties, linked student, description, comments timeline).

## What's inside
- **`KICKOFF_PROMPT.md`** ← paste into Claude Code FIRST (locates the package, makes it read the real
  code, plan, then build step by step).
- **`TASKS_REQUEST.md`** ← full spec mapped to the real `useTasks` model + components, with acceptance criteria.
- **`Tasks-Redesign-Preview.html`** ← open in any browser. Toggle Focus/Board, click a task for the
  drawer, Dark/Light top-right. Works offline.
- **`reference/tasks-module.jsx`** ← the exact mockup to match (+ `lib.jsx` helpers).

## How to use
1. Copy `tasks_redesign_package/` into the **hanguk-uz** repo (commit/push so the cloud agent sees it).
2. Paste **`KICKOFF_PROMPT.md`** into Claude Code → approve its plan → it builds.

> Visual/UX rebuild of the Tasks route only. It **reuses** `useTasks`, `TaskList`, `TaskKanbanBoard`,
> `TaskDetailSheet`, `TaskForm`, `TaskQuickAdd`, stats, view-mode persistence and comments — no data
> or business-logic changes.
