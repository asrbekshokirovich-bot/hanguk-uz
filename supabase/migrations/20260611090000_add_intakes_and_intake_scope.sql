-- Seasons / Intakes: forward-only, additive, no data loss.
-- Adds an `intakes` table (two seasons per year) and a nullable `intake_id`
-- FK on every intake-specific table, backfills existing rows to Fall 2026,
-- indexes them, and stamps a default intake on insert as a safety net.
-- Existing tables, RLS policies and roles are NOT modified.

create table if not exists public.intakes (
  id uuid primary key default gen_random_uuid(),
  season text not null check (season in ('spring','fall')),
  year smallint not null,
  is_open boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season, year)
);
comment on table public.intakes is 'Admission intakes (two per year: spring/fall). The CRM scopes all pipeline data to one active intake.';

insert into public.intakes (season, year, is_open, is_default) values
  ('spring', 2026, true,  false),
  ('fall',   2026, true,  true),   -- current intake (backfill target)
  ('spring', 2027, false, false),
  ('fall',   2027, false, false)
on conflict (season, year) do nothing;

-- at most one default intake
create unique index if not exists intakes_one_default on public.intakes (is_default) where is_default;

create or replace function public.current_default_intake_id()
returns uuid
language sql
stable
set search_path = ''
as $$ select id from public.intakes where is_default order by year desc limit 1 $$;

-- add intake_id + backfill (Fall 2026) + index on every scoped table
do $$
declare t text;
declare bf uuid := (select id from public.intakes where season = 'fall' and year = 2026);
begin
  foreach t in array array[
    'applications','documents','payments','scheduled_payments',
    'tasks','leads','message_threads','student_budgets'
  ] loop
    execute format('alter table public.%I add column if not exists intake_id uuid references public.intakes(id)', t);
    execute format('update public.%I set intake_id = %L where intake_id is null', t, bf);
    execute format('create index if not exists %I on public.%I (intake_id)', t || '_intake_id_idx', t);
  end loop;
end $$;

-- safety net: stamp the default intake on insert when the app did not set one
-- (covers server-side inserts from edge functions, e.g. telegram-ingest leads)
create or replace function public.set_default_intake()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.intake_id is null then
    new.intake_id := public.current_default_intake_id();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'applications','documents','payments','scheduled_payments',
    'tasks','leads','message_threads','student_budgets'
  ] loop
    execute format('drop trigger if exists trg_set_default_intake on public.%I', t);
    execute format('create trigger trg_set_default_intake before insert on public.%I for each row execute function public.set_default_intake()', t);
  end loop;
end $$;

-- RLS for the new table only (existing tables/policies untouched)
alter table public.intakes enable row level security;

create policy "intakes_read_all" on public.intakes
  for select to authenticated using (true);

create policy "intakes_write_admin" on public.intakes
  for all to authenticated
  using (has_role(auth.uid(), 'owner'::app_role) or has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'owner'::app_role) or has_role(auth.uid(), 'admin'::app_role));

-- keep updated_at fresh on intakes
create or replace function public.touch_intakes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_touch_intakes on public.intakes;
create trigger trg_touch_intakes before update on public.intakes
  for each row execute function public.touch_intakes_updated_at();
