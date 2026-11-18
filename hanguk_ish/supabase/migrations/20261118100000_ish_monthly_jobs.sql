-- Hanguk Ish: monthly (long-term) jobs.
--
-- Besides one-day shifts the worker app lists jobs paid by the month (a café
-- hire, a warehouse job): no day or time slot, just the monthly pay, the days
-- a week and the place. Hanguk's staff add them (hanguk.uz CRM or SQL); a
-- worker sees the open ones and says «Qiziqaman» (a row in
-- monthly_applications) — the staff then call both sides, as with shifts that
-- come from outside the app.

create table ish.monthly_jobs (
  id uuid primary key default gen_random_uuid(),
  -- Written in Korean by the staff; translations are for workers.
  title text not null check (char_length(title) between 1 and 80),
  company text not null check (char_length(company) between 1 and 80),
  area text not null default '' check (char_length(area) <= 80),
  address text not null default '' check (char_length(address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  monthly_wage int not null check (monthly_wage > 0),
  days_per_week smallint check (days_per_week between 1 and 7),
  hours_per_day smallint check (hours_per_day between 1 and 16),
  description text not null default '' check (char_length(description) <= 1200),
  -- {"uz": {"title": …, "company": …, "description": …}, "ru": …}
  translations jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid default auth.uid() references ish.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index monthly_jobs_open_idx on ish.monthly_jobs (created_at desc) where status = 'open';

create table ish.monthly_applications (
  job_id uuid not null references ish.monthly_jobs (id) on delete cascade,
  worker_id uuid not null default auth.uid() references ish.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, worker_id)
);

alter table ish.monthly_jobs enable row level security;
alter table ish.monthly_applications enable row level security;

-- Workers (and everyone signed in) read the open jobs; the staff read and write all.
create policy monthly_jobs_read on ish.monthly_jobs
  for select to authenticated using (status = 'open' or ish.is_staff());
create policy monthly_jobs_staff_write on ish.monthly_jobs
  for all to authenticated using (ish.is_staff()) with check (ish.is_staff());

-- A worker sees, makes and withdraws only their own; the staff see all.
create policy monthly_applications_read on ish.monthly_applications
  for select to authenticated using (worker_id = auth.uid() or ish.is_staff());
create policy monthly_applications_make on ish.monthly_applications
  for insert to authenticated with check (
    worker_id = auth.uid()
    and exists (select 1 from ish.monthly_jobs j where j.id = job_id and j.status = 'open')
  );
create policy monthly_applications_withdraw on ish.monthly_applications
  for delete to authenticated using (worker_id = auth.uid());

revoke all on ish.monthly_jobs, ish.monthly_applications from public, anon, authenticated;
grant select, insert, update, delete on ish.monthly_jobs to authenticated;
grant select, insert, delete on ish.monthly_applications to authenticated;
