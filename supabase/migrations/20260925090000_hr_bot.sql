-- HR bot: job applications collected in Telegram and reviewed in Telegram.
--
-- The owner asked (2026-09-25) for a hiring bot with no website and no CRM
-- page: candidates answer a short questionnaire in a chat with the bot, and
-- the people hiring review them, pick, reject and invite to an interview from
-- a chat with the same bot. Both tables are read and written only by the
-- `hr-bot` edge function with the service role.

create table if not exists public.hr_candidates (
  id               uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  chat_id          text not null,
  username         text,
  full_name        text,
  phone            text,
  district         text,
  -- 'study' | 'work' | 'both' | 'none'
  occupation       text,
  -- Free text, asked only when occupation is not 'none'.
  busy_hours       text,
  -- Where the candidate is in the questionnaire: full_name, phone, district,
  -- occupation, busy_hours, done.
  step             text not null default 'full_name',
  -- new -> selected -> invited -> confirmed | reschedule, or rejected.
  status           text not null default 'new',
  interview_info   text,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists hr_candidates_status_idx
  on public.hr_candidates (status, submitted_at desc);

-- A person becomes an HR admin by sending `/admin <password>` to the bot, so
-- adding one does not mean editing a secret. pending_action holds a
-- multi-message admin action in progress, e.g. {"action":"invite",
-- "candidate_id":"..."} while the bot waits for the interview time.
create table if not exists public.hr_admins (
  telegram_user_id text primary key,
  chat_id          text not null,
  name             text,
  pending_action   jsonb,
  created_at       timestamptz not null default now()
);

-- Service role only: nothing outside hr-bot touches these.
alter table public.hr_candidates enable row level security;
alter table public.hr_admins enable row level security;
