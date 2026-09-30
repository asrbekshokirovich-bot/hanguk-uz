-- The "Moliya" section for one named person beyond the owners.
--
-- The owner's rule (2026-09-30): Odina (document_handler) sees and works the
-- whole finance section — all nine pages, bonuses included — exactly as an
-- owner does there. Nothing else about her role changes, and the other
-- document handler is not included.
--
--   * public.finance_access lists who, besides the owners, has the section.
--   * public.has_finance_access() is true for an owner or anyone listed.
--   * Every table the finance pages read or write gets one policy granting
--     that person full access. The owner-only and staff policies already there
--     are unchanged, and the restrictive investor denials still apply.

create table if not exists public.finance_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.finance_access enable row level security;

drop policy if exists "finance_access_read_own" on public.finance_access;
create policy "finance_access_read_own" on public.finance_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'owner'::public.app_role));

drop policy if exists "finance_access_owner_manage" on public.finance_access;
create policy "finance_access_owner_manage" on public.finance_access
  for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

create or replace function public.has_finance_access(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.has_role(p_uid, 'owner'::public.app_role)
      or exists (select 1 from public.finance_access fa where fa.user_id = p_uid)
$$;

revoke all on function public.has_finance_access(uuid) from public, anon;
grant execute on function public.has_finance_access(uuid) to authenticated, service_role;

-- One policy per finance table: full access for whoever has the section.
do $$
declare
  t text;
begin
  foreach t in array array[
    'payments',
    'payment_transactions',
    'expenses',
    'student_budgets',
    'monthly_payment_categories',
    'operational_fund_settings',
    'operational_fund_allocations',
    'income_distributions',
    'income_distribution_settings',
    'distribution_transfers',
    'distribution_transfer_items',
    'planned_transactions',
    'staff_bonuses'
  ] loop
    execute format('drop policy if exists "finance_access_all" on public.%I', t);
    execute format(
      'create policy "finance_access_all" on public.%I for all to authenticated '
      'using (public.has_finance_access((select auth.uid()))) '
      'with check (public.has_finance_access((select auth.uid())))',
      t
    );
  end loop;
end $$;

-- Odina.
insert into public.finance_access (user_id)
values ('3c67ee12-ca41-4293-a266-a85de37218b7')
on conflict do nothing;
