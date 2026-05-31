-- ============================================================================
--  uni_db v1 — user_tracked_universities, user_alerts
--  Plan §C.14
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  user_tracked_universities
-- ----------------------------------------------------------------------------
create table if not exists public.user_tracked_universities (
  user_id                          uuid not null references auth.users(id) on delete cascade,
  institution_id                   uuid not null references public.institutions(id) on delete cascade,
  applicant_category               text,
  tracked_recruitment_units        uuid[] not null default array[]::uuid[],
  notify_on_calendar_change        boolean not null default true,
  notify_on_correction             boolean not null default true,
  notify_on_requirement_change     boolean not null default true,
  notify_on_scholarship_change     boolean not null default false,
  preferred_lang                   text not null default 'en',
  created_at                       timestamptz not null default now(),
  primary key (user_id, institution_id)
);

alter table public.user_tracked_universities enable row level security;
drop policy if exists user_tracked_universities_owner on public.user_tracked_universities;
create policy user_tracked_universities_owner on public.user_tracked_universities
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
--  user_alerts
-- ----------------------------------------------------------------------------
create table if not exists public.user_alerts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  change_event_id     uuid not null references public.change_events(id) on delete cascade,
  delivered_at        timestamptz,
  read_at             timestamptz,
  channel             text check (channel in ('push','in_app','email'))
);

create index if not exists user_alerts_user_delivered_idx
  on public.user_alerts (user_id, delivered_at desc);

alter table public.user_alerts enable row level security;
drop policy if exists user_alerts_owner on public.user_alerts;
create policy user_alerts_owner on public.user_alerts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
