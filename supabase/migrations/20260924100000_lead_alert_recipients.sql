-- People who get the "Yangi lid" alerts in a private chat with the bot.
--
-- lead-sla-check always sent its alerts from the bot to one chat,
-- ALERT_TELEGRAM_CHAT_ID. The owner wants them in their own Telegram too
-- (2026-09-24), and adding a person should not mean editing a function
-- secret. Each row here is one more chat the bot sends every alert to; the
-- person must have pressed Start on the bot once, or Telegram refuses.
--
-- chat_id is the person's Telegram user id (for a private chat with a bot the
-- two are the same number).

create table if not exists public.lead_alert_recipients (
  chat_id    text primary key,
  label      text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

-- Service role only: read by lead-sla-check, nothing in the CRM touches it.
alter table public.lead_alert_recipients enable row level security;

insert into public.lead_alert_recipients (chat_id, label)
values ('1580805284', 'Asrbek Aka (@Asrbek6363)')
on conflict (chat_id) do nothing;
