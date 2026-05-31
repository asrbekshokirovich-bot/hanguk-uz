-- Auto-updater telemetry table — what version is each device on?
-- Upserted by the client on every app launch.
-- See: .claude/PRPs/plans/autoupdater-perfect.plan.md (Task 5)

begin;

create table if not exists public.app_version_pings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  platform text not null,
  version text not null,
  build int,
  locale text,
  channel text not null default 'stable',
  raw_user_agent text,
  last_seen_at timestamptz not null default now()
);

create index if not exists app_version_pings_platform_version_idx
  on public.app_version_pings (platform, version);
create index if not exists app_version_pings_last_seen_idx
  on public.app_version_pings (last_seen_at desc);

alter table public.app_version_pings enable row level security;

-- Users can only upsert their own row. No cross-user reads.
drop policy if exists "users upsert own ping" on public.app_version_pings;
create policy "users upsert own ping" on public.app_version_pings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner-side read view: aggregates without exposing per-user PII.
create or replace view public.version_distribution as
select platform,
       version,
       channel,
       count(*) as device_count,
       min(last_seen_at) as oldest_ping,
       max(last_seen_at) as latest_ping
from public.app_version_pings
group by 1, 2, 3
order by platform, version desc;

revoke all on public.version_distribution from public;
revoke all on public.version_distribution from anon;
revoke all on public.version_distribution from authenticated;
grant select on public.version_distribution to service_role;

comment on view public.version_distribution is
  'Counsellor/owner-facing view of app version distribution. service_role only — '
  'expose to staff via a SECURITY DEFINER function if needed for in-app dashboard.';

commit;
