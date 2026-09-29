-- HR bot: every candidate card the bot posts to an admin chat.
--
-- Each press of a list button (🆕 Yangi arizalar, ⭐ Tanlanganlar) posts fresh
-- cards and leaves the earlier ones in the chat, so an invited or rejected
-- candidate kept showing up there as "Yangi". Recording each card lets the bot
-- delete every copy once the candidate is invited or rejected. Written and read
-- only by the `hr-bot` edge function with the service role.

create table if not exists public.hr_card_messages (
  id           bigint generated always as identity primary key,
  candidate_id uuid not null references public.hr_candidates (id) on delete cascade,
  chat_id      text not null,
  message_id   bigint not null,
  sent_at      timestamptz not null default now()
);

create index if not exists hr_card_messages_candidate_idx
  on public.hr_card_messages (candidate_id);

-- Service role only, like hr_candidates and hr_admins.
alter table public.hr_card_messages enable row level security;
