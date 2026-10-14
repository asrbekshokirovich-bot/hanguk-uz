-- Document approval for one named person beyond the owners.
--
-- The owner's rule (2026-10-14): only Odina (document_handler) and the owners
-- approve documents, and only they upload, replace or delete a student's file
-- from the CRM's Hujjatlar page. The other document handler and the admins see
-- the pack read-only. 20261014090000 wrongly gave this to owner/admin; this
-- replaces it.
--
--   * public.document_approvers lists who, besides the owners, approves.
--   * public.can_approve_documents() is true for an owner or anyone listed.
--   * The documents trigger now checks can_approve_documents().
-- Same shape as public.finance_access (20260930180000).

create table if not exists public.document_approvers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.document_approvers enable row level security;

drop policy if exists "document_approvers_read_own" on public.document_approvers;
create policy "document_approvers_read_own" on public.document_approvers
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'owner'::public.app_role));

drop policy if exists "document_approvers_owner_manage" on public.document_approvers;
create policy "document_approvers_owner_manage" on public.document_approvers
  for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

create or replace function public.can_approve_documents(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.has_role(p_uid, 'owner'::public.app_role)
      or exists (select 1 from public.document_approvers da where da.user_id = p_uid)
$$;

revoke all on function public.can_approve_documents(uuid) from public, anon;
grant execute on function public.can_approve_documents(uuid) to authenticated, service_role;

create or replace function public.enforce_admin_document_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved')
     and auth.uid() is not null
     and not public.can_approve_documents(auth.uid())
  then
    raise exception 'Only an approver can approve documents'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Odina.
insert into public.document_approvers (user_id)
values ('3c67ee12-ca41-4293-a266-a85de37218b7')
on conflict do nothing;
