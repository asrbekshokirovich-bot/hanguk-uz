-- Telegram messages telegram-ingest could not take wait here for another try
-- (owner, 2026-10-15).
--
-- telegram-poll hands the company account's messages to telegram-ingest in
-- batches. A message that failed inside a batch was answered with 200 and an
-- `errors` entry, the poll saved its position past it, and the message never
-- reached the CRM. Now the poll keeps every such message here, sends it again
-- at the start of each run (one minute, then a little longer each time, 10
-- tries), and infra-health-check alerts while one is still waiting after 30
-- minutes.

create table if not exists public.telegram_ingest_failures (
  id            bigint generated always as identity primary key,
  account_label text not null,
  event_key     text not null,
  event         jsonb not null,
  error         text,
  attempts      int not null default 1,
  next_try_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (account_label, event_key)
);

create index if not exists telegram_ingest_failures_due_idx
  on public.telegram_ingest_failures (account_label, next_try_at)
  where resolved_at is null;

-- Written and read by the functions' service role only.
alter table public.telegram_ingest_failures enable row level security;
revoke all on public.telegram_ingest_failures from anon, authenticated;
