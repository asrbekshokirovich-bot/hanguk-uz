-- The "Application fee" section for named staff beyond the roles that have it.
--
-- The owner's rule (2026-10-26): Omina (call_operator) sees the Application
-- fee section and adds payments there, exactly as a document handler does —
-- WITHOUT being given the document_handler role, which would also open
-- Documents, University selection and the online/offline application pages.
--
--   * public.application_fee_access lists who, besides owner / admin /
--     document_handler, has the section.
--   * public.has_application_fee_access() is true for those roles or anyone
--     listed.
--   * public.can_edit_application_fees() — the function every
--     application_fee_payments policy already calls — now delegates to it, so
--     the existing read/write policies cover the listed people with no policy
--     change.
--
-- Who is listed is NOT decided here: the rows are added from the CRM's staff
-- page (owner/admin only) or by a one-off insert. Same shape as
-- 20260930180000_finance_access.sql.

create table if not exists public.application_fee_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now()
);

comment on table public.application_fee_access is
  'Staff who may use the CRM "Application fee" section without holding owner/admin/document_handler.';

alter table public.application_fee_access enable row level security;

-- A person may see their own row (the CRM reads it to show the menu item);
-- owners and admins see every row (the staff page shows the toggle).
drop policy if exists "application_fee_access_read" on public.application_fee_access;
create policy "application_fee_access_read" on public.application_fee_access
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

-- Only owners and admins grant or revoke.
drop policy if exists "application_fee_access_manage" on public.application_fee_access;
create policy "application_fee_access_manage" on public.application_fee_access
  for all to authenticated
  using (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  )
  with check (
    public.has_role((select auth.uid()), 'owner'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
  );

create or replace function public.has_application_fee_access(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.has_role(p_uid, 'owner'::public.app_role)
      or public.has_role(p_uid, 'admin'::public.app_role)
      or public.has_role(p_uid, 'document_handler'::public.app_role)
      or exists (select 1 from public.application_fee_access a where a.user_id = p_uid)
$$;

revoke all on function public.has_application_fee_access(uuid) from public, anon;
grant execute on function public.has_application_fee_access(uuid) to authenticated, service_role;

-- Kept argument-less: application_fee_payments_read / _write call it as is.
create or replace function public.can_edit_application_fees()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.has_application_fee_access(auth.uid());
$$;

revoke all on function public.can_edit_application_fees() from public, anon;
grant execute on function public.can_edit_application_fees() to authenticated;
