-- Which operator is behind a PBX extension.
--
-- Kept out of `profiles` on purpose: one operator can hold a different
-- extension on each provider (Mediateka 701, Asterisk 1001) and both run in
-- parallel during the switch. Retiring a person sets is_active=false instead of
-- clearing a column, so an extension that gets reissued to somebody else never
-- rewrites who older calls belonged to.
create table if not exists public.staff_extensions (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.profiles(user_id) on update cascade on delete cascade,
  extension   text not null,
  provider    text not null check (provider in ('mediateka', 'asterisk')),
  label       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One live owner per extension per provider; retired rows stay for history.
create unique index if not exists idx_staff_ext_active
  on public.staff_extensions (provider, extension) where is_active;

create index if not exists idx_staff_ext_staff on public.staff_extensions (staff_id);

alter table public.staff_extensions enable row level security;

drop policy if exists staff_extensions_staff_read on public.staff_extensions;
create policy staff_extensions_staff_read on public.staff_extensions
  for select to authenticated
  using (exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role in ('owner', 'admin', 'call_operator')
  ));

drop policy if exists staff_extensions_admin_write on public.staff_extensions;
create policy staff_extensions_admin_write on public.staff_extensions
  for all to authenticated
  using (exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role in ('owner', 'admin')
  ));
