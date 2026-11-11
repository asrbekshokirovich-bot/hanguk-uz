-- hanguk.uz's objects that share a name with Hanguk Ish's (P48). Hanguk Ish
-- lives in hanguk.uz's Supabase project, in its own schema `ish`; the
-- migrations must apply next to these and leave them as they are. tests/run.sh
-- makes them on the plain PostgreSQL before the migrations (then hanguk.uz's
-- sign-up function from the repository root and its trigger); the Supabase
-- stack has no hanguk.uz. Shapes as in production on 2026-11-11, cut down to
-- what the checks (05_coexistence_test.sql) need.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  full_name text,
  preferred_language text not null default 'uz'
);
create table public.applications (id uuid primary key default gen_random_uuid(), student_id uuid, university text);
create table public.messages (id uuid primary key default gen_random_uuid(), body text);
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;

-- A hanguk.uz table with rights of its own: they must stay as they are.
create table public.main_canary (id int primary key, note text);
alter table public.main_canary enable row level security;
revoke all on public.main_canary from anon, authenticated;
grant select on public.main_canary to authenticated;
create policy main_canary_read on public.main_canary for select to authenticated using (true);
insert into public.main_canary values (1, 'hanguk.uz');

-- hanguk.uz's live updates: the Hanguk Ish tables join the same publication.
set client_min_messages = error;  -- (no logical replication on the test server: a warning only)
create publication supabase_realtime for table public.messages;
