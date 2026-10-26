-- The Monday app report (plan v2, section 8 «Dushanba 09:30 hisoboti»):
-- weekly-app-report sends last week's five numbers to the boss
-- (lead_alert_recipients where watchdog) and to marketing; this keeps who
-- else gets it, which weeks went out, and calls it every Monday at 09:30
-- Tashkent (04:30 UTC).

-- Marketing's chats: they get the weekly report only — not the lead alerts
-- every lead_alert_recipients row receives. Service role only, like
-- lead_alert_recipients; a chat appears here once the person has written to
-- the bot.
create table if not exists public.app_report_recipients (
  chat_id    text primary key,
  label      text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_report_recipients enable row level security;

-- One row a week: the function claims the week before it sends, so a second
-- call in the same week does nothing; what was sent stays for the record.
create table if not exists public.app_weekly_reports (
  week_start date primary key check (extract(isodow from week_start) = 1),
  sent_at    timestamptz,
  numbers    jsonb,
  comment    text,
  recipients integer,
  created_at timestamptz not null default now()
);
alter table public.app_weekly_reports enable row level security;

-- Mondays 04:30 UTC = 09:30 Tashkent, with the project's secret key (same
-- wiring as translate-app-texts-30min).
select cron.schedule(
  'weekly-app-report',
  '30 4 * * 1',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/weekly-app-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)
  $cron$
);
