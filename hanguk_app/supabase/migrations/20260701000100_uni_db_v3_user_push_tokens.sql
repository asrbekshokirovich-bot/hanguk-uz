-- ============================================================================
--  uni_db v3 — user_push_tokens (per-device push registration)
--
--  Plan §I-Phase-3 + PHASE_3_DESIGN.md §4. The Flutter app upserts a
--  row here on each cold boot via the register-push-token Edge
--  Function. The notify-tracked-changes function joins through this
--  table when fanning out a change event to a user's devices.
--
--  Tokens rotate frequently on FCM / APNs / web-push. last_seen_at
--  drives a weekly GC that removes stale registrations (90+ days).
-- ============================================================================

create table if not exists public.user_push_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  platform        text not null check (platform in ('android', 'ios', 'web')),
  token           text not null,
  app_version     text,
  device_label    text,                       -- "iPhone 14, en-US, iOS 18.1"
  preferred_lang  text not null default 'en', -- payload localisation hint
  enabled         boolean not null default true,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (platform, token)
);

create index if not exists user_push_tokens_user_idx
  on public.user_push_tokens (user_id) where enabled;
create index if not exists user_push_tokens_last_seen_idx
  on public.user_push_tokens (last_seen_at) where enabled;

alter table public.user_push_tokens enable row level security;

drop policy if exists user_push_tokens_owner on public.user_push_tokens;
create policy user_push_tokens_owner on public.user_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role bypasses RLS; the notify-tracked-changes function reads
-- across all users without needing a separate policy.

comment on table public.user_push_tokens is
  'Per-device push registrations. Rotates on token refresh; weekly GC
   removes rows where last_seen_at is older than 90 days.';
