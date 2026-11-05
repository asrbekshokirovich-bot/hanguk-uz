-- Xavfsizlik (2026-11-05): guest-test-session cheksiz mehmon akkaunt ochardi.
-- Edge funksiya shu jadvalga har ochilishni yozadi va bitta IP'dan soatiga 20,
-- hammasi bo'lib kuniga 300 tadan ortig'ini rad etadi. IP o'zi saqlanmaydi,
-- faqat SHA-256 izi. Faqat service_role (edge funksiya) ishlatadi.
create table if not exists public.guest_session_throttle (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists guest_session_throttle_ip_time_idx
  on public.guest_session_throttle (ip_hash, created_at desc);
create index if not exists guest_session_throttle_time_idx
  on public.guest_session_throttle (created_at desc);

alter table public.guest_session_throttle enable row level security;
revoke all on public.guest_session_throttle from anon, authenticated;
grant select, insert, delete on public.guest_session_throttle to service_role;
