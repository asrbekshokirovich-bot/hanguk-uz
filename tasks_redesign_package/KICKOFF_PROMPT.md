# KICKOFF — paste into Claude Code FIRST (run in the `hanguk-uz` repo)

```
I'm sharing a folder "tasks_redesign_package" with this repo (from a zip — unzip to the repo root if
needed). Use it properly, step by step:

STEP 1 — LOCATE & READ
  • Find it: run  find . -iname "*tasks_redesign*"  (unzip if it's still a .zip).
  • Confirm it has: KICKOFF_PROMPT.md, TASKS_REQUEST.md, README.md, Tasks-Redesign-Preview.html,
    and reference/tasks-module.jsx.
  • Read, in order, as source of truth:
      1. tasks_redesign_package/README.md
      2. tasks_redesign_package/TASKS_REQUEST.md            ← full spec + acceptance criteria
      3. tasks_redesign_package/reference/tasks-module.jsx  ← the EXACT target mockup
  • Open tasks_redesign_package/Tasks-Redesign-Preview.html in a browser, in light AND dark. Toggle
    Focus/Board and click a task to open the drawer. That is the visual + behavioral contract.

STEP 2 — GROUND IN THE REAL CODE FIRST (reuse, don't rewrite)
  Read before changing anything:
    • src/components/crm/pages/TasksContent.tsx           (the page orchestrator)
    • src/components/tasks/TaskList.tsx, TaskKanbanBoard.tsx, TaskDetailSheet.tsx,
      TaskForm.tsx, TaskQuickAdd.tsx
    • src/hooks/useTasks.ts                                 (tasks, stats, CRUD, comments)
  The redesign is a NEW UI over these EXISTING hooks/components. Keep useTasks, the stats
  (total/inProgress/completed/overdue/myTasks), status set (todo/in_progress/completed), the
  view-mode persistence, the voice notification, TaskForm, and the comments flow. Only presentation changes.

STEP 3 — UNDERSTAND THE TARGET
  tasks-module.jsx is a plain React + inline-style mockup. Do NOT copy its inline styles, hex values,
  or demo data. Reproduce its layout + behavior with THIS repo's stack: shadcn/ui, Tailwind semantic
  tokens, lucide-react, the real useTasks data and i18next strings. The goal is CALM + PROFESSIONAL +
  NOT CROWDED: one summary bar instead of five stat cards, Focus (time buckets) + Board views.

STEP 4 — PLAN, THEN BUILD
  Reply with a short PLAN: which files you'll change, how Focus buckets + Board map onto useTasks
  data/stats, and how the drawer reuses TaskDetailSheet + comments. Then implement to match
  TASKS_REQUEST.md's ACCEPTANCE list.

GUARDRAILS
  • Keep all data/logic/hooks/components, routing, Supabase, RLS/roles and i18n intact. Presentation only.
  • Semantic Tailwind tokens only — no hardcoded colors. Reuse shadcn/ui primitives. Localize every
    string (uz/ru/en/ko, uz primary — normalize the current mixed English labels).
  • Add Skeleton loading + a shared EmptyState. Verify light AND dark.
  • Before reporting done: npm run build, npm run lint, npx tsc --noEmit — all clean.

When finished show me: (a) the files you changed, (b) confirmation useTasks + the existing task
components are reused, and (c) dark-mode screenshots of Focus + Board + an open task drawer.

Start with STEP 1 now, and reply with the PLAN (STEP 4) before making changes.
```
