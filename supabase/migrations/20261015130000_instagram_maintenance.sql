-- Instagram upkeep: what the webhook misses is fetched, what failed is retried,
-- and "IG xxxxxx" names are asked for again (owner, 2026-10-15).
--
-- Every 15 minutes the instagram-maintenance job calls instagram-webhook with
-- x-maintenance-secret (instagram_app_config.verify_token, exactly like
-- instagram-token-refresh), and the function:
--
--   1. runs again the webhook events whose processing failed — Meta got its
--      200 and never sends them again; up to 5 tries each, for 3 days;
--   2. reads the conversations updated since its last good run (at most 48
--      hours back) from the Instagram API and stores every message the webhook
--      did not deliver, through the same code — a missed first message still
--      makes its lead;
--   3. asks again for the profiles of threads still named "IG xxxxxx" (15 a
--      run, once a day each, 7 times at most) and puts the real name on the
--      thread, its messages, the lead and the identity.

alter table public.instagram_webhook_events
  add column if not exists retries int not null default 0;

create table if not exists public.instagram_sync_state (
  id              text primary key,
  last_run_at     timestamptz,
  last_success_at timestamptz,
  last_error      text,
  updated_at      timestamptz not null default now()
);

create table if not exists public.instagram_profile_checks (
  igsid      text primary key,
  attempts   int not null default 0,
  found      boolean not null default false,
  checked_at timestamptz not null default now()
);

-- Written and read by the function's service role only.
alter table public.instagram_sync_state enable row level security;
alter table public.instagram_profile_checks enable row level security;
revoke all on public.instagram_sync_state from anon, authenticated;
revoke all on public.instagram_profile_checks from anon, authenticated;

select cron.unschedule('instagram-maintenance-15min')
 where exists (select 1 from cron.job where jobname = 'instagram-maintenance-15min');

select cron.schedule(
  'instagram-maintenance-15min',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/instagram-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-maintenance-secret', (select verify_token from public.instagram_app_config where id = 'main')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
  $job$
);
