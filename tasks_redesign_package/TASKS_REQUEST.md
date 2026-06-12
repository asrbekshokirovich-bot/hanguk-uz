# TASKS — complete redesign  (build in `hanguk-uz`)

Rebuild the Tasks section into a calm, professional task workspace. The current page is crowded
(five loud stat cards + quick-add + toggle stacked together). Replace it with: a **slim header**,
**one quiet summary bar** (progress ring + inline metrics), an inline **quick-add**, and a
**Focus** (time-bucketed list) + **Board** (kanban) view, plus a refined **detail drawer**.
Match the mockup `reference/tasks-module.jsx` — open `Tasks-Redesign-Preview.html` (toggle
Focus/Board, click a task, Dark/Light), light + dark.

> Rules: visual/UX rebuild of the Tasks route only. Keep ALL data + logic — `useTasks` (tasks,
> stats, createTask, updateTask, deleteTask, addComment, fetchComments), `TaskList`,
> `TaskKanbanBoard`, `TaskDetailSheet`, `TaskForm`, `TaskQuickAdd`, staff fetch, view-mode
> persistence, voice notification, Supabase/RLS, i18n. Reuse shadcn/ui. Semantic tokens only
> (no hardcoded hex). Verify light + dark; build + lint + `tsc --noEmit` clean.

## Keep the real model (don't change it)
- File: `src/components/crm/pages/TasksContent.tsx` (orchestrator) + `src/components/tasks/*`
  (`TaskList`, `TaskKanbanBoard`, `TaskDetailSheet`, `TaskForm`, `TaskQuickAdd`) + `src/hooks/useTasks.ts`.
- Status set already exists: **`todo` · `in_progress` · `completed`** (board columns map 1:1).
- `stats` from `useTasks`: **total, inProgress, completed, overdue, myTasks** — reuse as-is.
- Task fields used: title, description, status, priority, due_date, assignee (staff profile),
  related student (if linked), comments. `viewMode` persists to `localStorage('taskViewMode')`.
- All existing actions stay: quick-add, full form (create/edit), status change, delete, comments,
  add-task-for-status (board "+"), detail sheet, voice "task created" notification.

## What to build (match tasks-module.jsx)
1. **Slim header** — "Tasks" (30px/800) + a one-line live summary: `{overdue} overdue · {inProgress}
   in progress · {myTasks} assigned to you` (overdue in destructive when > 0). Right side: a
   **Focus / Board** segmented toggle (replaces the bordered button group) + a single **New task**
   (accent) button. Keep `viewMode` persistence — rename labels to Focus/Board (values stay list/kanban).
2. **Summary bar — ONE card** (replaces the 5 stat cards): left = a small **progress ring** (completed
   ÷ total %) with `completed / total` + "Completed this week"; a divider; then quiet inline metrics
   with colored dots: **Overdue** (destructive), **In progress** (warning), **To do** (info),
   **Assigned to me** (primary). Calm, low-contrast, lots of breathing room — no five competing cards.
3. **Inline quick-add** — a single row: dashed checkbox + "Add a task and press Enter…" input +
   Assign / Due ghost buttons + an Add button. Wire to the existing `TaskQuickAdd` / `handleQuickAdd`.
4. **FOCUS view (default)** — group active tasks into **Overdue · Today · Upcoming · Completed**
   buckets (by due_date vs today; completed last). Each bucket: colored dot + label + count, then a
   card holding **task rows**. **Row**: round checkbox (toggles complete), a priority color bar,
   title (strike-through when done), a meta line (category · linked student · comment count), an
   "In progress" badge when applicable, a **due chip** (red overdue / amber today / neutral), and the
   **assignee avatar**. Clicking the row opens the drawer. Empty buckets are hidden.
5. **BOARD view** — 3 columns **To do · In progress · Done** (colored dot + count + dashed "Add task").
   **Card**: priority badge + task id, title, linked student, footer with due chip + comment count +
   assignee avatar. Reuse `TaskKanbanBoard`'s DnD + `onStatusChange`/`onAddTask`; this is a restyle.
6. **Detail drawer** (restyle `TaskDetailSheet` as a right slide-over): header = id, big checkbox +
   title, **Mark done** + overflow (edit/delete); a **properties list** (Status, Priority, Due date,
   Assignee with avatar, Category) using badges; a **linked-student** card with "Open"; a
   **description**; and an **activity / comments** timeline (from `fetchComments`) with a comment box
   wired to `handleAddComment`. Keep Edit → opens `TaskForm`.
7. **States** — shadcn Skeleton while `loading`; a shared **EmptyState** ("No tasks yet — add your
   first task above") per bucket/column; localize all strings (uz/ru/en/ko, uz primary — normalize
   the current mixed English like "Overdue", "My Tasks", "Task deleted").

## ACCEPTANCE
- The 5 stacked stat cards are replaced by ONE calm summary bar (ring + inline metrics).
- Tasks has **Focus (time buckets) + Board (kanban)** with the persisted toggle (todo/in_progress/completed).
- Rows/cards show checkbox-complete, priority bar/badge, due chip, linked student, assignee avatar, comments.
- Clicking a task opens the restyled drawer with properties + linked student + description + comments;
  Mark done, Edit (TaskForm), Delete, and Add comment all still work via the existing hooks.
- All `useTasks` data/logic, voice notification and view-mode persistence preserved; no business-logic
  change; light + dark clean; lint + tsc clean.

When done show me: (a) files changed, (b) confirmation `useTasks` + the existing task components are
reused, and (c) dark-mode screenshots of Focus + Board + an open task drawer.
