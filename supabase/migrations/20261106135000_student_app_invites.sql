-- Ushlab qolish rejasi P13 (U5, QU8): a contracted student who never opened
-- the app is invited to it. With a Telegram identity the student gets a
-- message (the login code and the app link) through the userbot outbox; with
-- none, the student's consultant gets a CRM task to pass it on by phone.
--
-- * student_app_invites — each invite: channel, status, the outbox row or
--   task it made.
-- * fn_student_app_invite_targets(uuid[]) — students with a contract, not
--   demo, no phone in app_installs; their code, language, Telegram id, the
--   userbot account that knows that chat, lead link code and consultant.
-- * cron 06:10 UTC (11:10 Tashkent) — student-app-invite {auto:true}: new
--   contracts (last 14 days) not invited yet. The CRM button (P14) calls the
--   same function for one student or all.

create table if not exists public.student_app_invites (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null,
  channel     text not null check (channel in ('telegram', 'task')),
  status      text not null check (status in ('queued', 'task_created', 'failed')),
  outbox_id   uuid,
  task_id     uuid references public.tasks (id) on delete set null,
  error       text,
  auto        boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists student_app_invites_student_idx on public.student_app_invites (student_id, created_at desc);

alter table public.student_app_invites enable row level security;
drop policy if exists student_app_invites_staff_read on public.student_app_invites;
create policy student_app_invites_staff_read on public.student_app_invites
  for select to authenticated using (public.app_events_staff_can_read());

create or replace function public.fn_student_app_invite_targets(p_students uuid[] default null)
returns table (
  student_id uuid, full_name text, magic_code text, lang text, contract_date date,
  telegram_id text, account_label text, link_code text, consultant uuid, last_invite_at timestamptz)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select p.user_id, p.full_name, p.magic_code,
         coalesce(nullif(lower(left(p.preferred_language, 2)), ''), 'uz'),
         p.contract_date::date,
         tg.identifier, peer.account_label, ld.link_code, ld.assigned_to,
         (select max(i.created_at) from public.student_app_invites i
           where i.student_id = p.user_id and i.status <> 'failed')
    from public.profiles p
    left join lateral (select ci.identifier from public.communication_identities ci
                        where ci.student_id = p.user_id and ci.channel = 'telegram' and ci.identifier ~ '^[0-9]{5,15}$'
                        order by ci.updated_at desc nulls last limit 1) tg on true
    left join lateral (select pc.account_label from public.telegram_peer_cache pc
                        where pc.peer_id::text = tg.identifier order by pc.updated_at desc limit 1) peer on true
    left join lateral (select l.link_code, l.assigned_to from public.leads l
                        where l.converted_to_student_id = p.user_id order by l.updated_at desc limit 1) ld on true
   where p.contract_date is not null and coalesce(p.status, '') <> 'cancelled' and not coalesce(p.is_demo, false)
     and p.user_id is not null and p.magic_code is not null
     and not exists (select 1 from public.app_installs i where i.user_id = p.user_id)
     and (p_students is null or p.user_id = any (p_students));
$$;
revoke all on function public.fn_student_app_invite_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.fn_student_app_invite_targets(uuid[]) to service_role;

do $$
begin
  perform cron.unschedule('student-app-invite')
    where exists (select 1 from cron.job where jobname = 'student-app-invite');
end $$;
select cron.schedule('student-app-invite', '10 6 * * *', $cron$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/student-app-invite',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{"auto": true}'::jsonb, timeout_milliseconds := 60000)
$cron$);
