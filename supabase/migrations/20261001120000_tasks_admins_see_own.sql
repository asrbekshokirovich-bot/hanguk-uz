-- Tasks: admins see only their own tasks (owner, 2026-10-01).
--
-- Before this, owners AND admins could read, edit and delete every task.
-- Now only owners keep that. An admin is treated like every other staff
-- member: they see, edit, complete and delete the tasks they created or that
-- are assigned to them, and they can still assign a task to anyone. One
-- admin's tasks are not visible to another admin.
--
-- Task comments follow the task: a comment is visible (and can be added) only
-- when its task is visible to the reader. The tasks policies apply inside the
-- subquery, so this needs no extra rule.

alter policy "Staff can view own or assigned tasks"
  on public.tasks
  using (
    has_role((select auth.uid()), 'owner'::app_role)
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  );

alter policy "Staff can update tasks"
  on public.tasks
  using (
    has_role((select auth.uid()), 'owner'::app_role)
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  );

alter policy "Staff can delete own or assigned tasks except synced"
  on public.tasks
  using (
    source <> 'command-center'
    and (
      has_role((select auth.uid()), 'owner'::app_role)
      or created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  );

alter policy "Staff can view task comments"
  on public.task_comments
  using (
    (
      has_role((select auth.uid()), 'owner'::app_role)
      or has_role((select auth.uid()), 'admin'::app_role)
      or has_role((select auth.uid()), 'call_operator'::app_role)
      or has_role((select auth.uid()), 'document_handler'::app_role)
    )
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );

alter policy "Staff can create comments"
  on public.task_comments
  with check (
    (
      has_role((select auth.uid()), 'owner'::app_role)
      or has_role((select auth.uid()), 'admin'::app_role)
      or has_role((select auth.uid()), 'call_operator'::app_role)
      or has_role((select auth.uid()), 'document_handler'::app_role)
    )
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );
