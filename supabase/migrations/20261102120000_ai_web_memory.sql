-- Hanguk AI 2.0 — 3- va 5-bosqich: internet manbalari va xotira (reja §8, PR-21).
--
--   ai_web_allowlist  rasmiy saytlar ro'yxati. Talaba / mehmon faqat shulardan
--                     o'qiydi; xodim boshqa saytni ham ochadi, lekin javobda
--                     "norasmiy" deb belgilanadi. CRM'dan (owner/admin) o'zgaradi.
--   ai_web_cache      ochilgan sahifa matni, 7 kun (bir sahifa qayta-qayta
--                     yuklanmaydi). Service role yozadi.
--   ai_memories       foydalanuvchi "eslab qol" degan faktlar (o'ziniki). Har
--                     suhbat boshida agentga beriladi; "unut" bilan o'chadi.

create table if not exists public.ai_web_allowlist (
  host text primary key,
  label text not null,
  kind text not null default 'official' check (kind in ('official', 'university', 'government')),
  created_at timestamptz not null default now()
);

alter table public.ai_web_allowlist enable row level security;
drop policy if exists ai_web_allowlist_read on public.ai_web_allowlist;
create policy ai_web_allowlist_read on public.ai_web_allowlist for select to authenticated using (true);
drop policy if exists ai_web_allowlist_write on public.ai_web_allowlist;
create policy ai_web_allowlist_write on public.ai_web_allowlist for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role) or public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role) or public.has_role((select auth.uid()), 'admin'::public.app_role));

insert into public.ai_web_allowlist (host, label, kind) values
  ('ac.kr', 'Koreya universitetlari (*.ac.kr)', 'university'),
  ('studyinkorea.go.kr', 'Study in Korea (NIIED)', 'government'),
  ('niied.go.kr', 'NIIED (GKS)', 'government'),
  ('hikorea.go.kr', 'HiKorea (immigratsiya)', 'government'),
  ('visa.go.kr', 'Korea Visa Portal', 'government'),
  ('immigration.go.kr', 'Korea Immigration Service', 'government'),
  ('moj.go.kr', 'Adliya vazirligi (MOJ)', 'government'),
  ('overseas.mofa.go.kr', 'Koreya elchixonalari (MOFA)', 'government'),
  ('mofa.go.kr', 'Koreya TIV (MOFA)', 'government'),
  ('topik.go.kr', 'TOPIK', 'government'),
  ('kosaf.go.kr', 'KOSAF', 'government'),
  ('adiga.kr', 'Adiga (KCUE)', 'government'),
  ('kcue.or.kr', 'KCUE', 'official'),
  ('moe.go.kr', 'Ta''lim vazirligi (MOE)', 'government')
on conflict (host) do nothing;

create table if not exists public.ai_web_cache (
  url text primary key,
  host text not null,
  title text,
  content text not null,
  fetched_at timestamptz not null default now()
);

alter table public.ai_web_cache enable row level security;
revoke all on public.ai_web_cache from anon, authenticated;

create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists ai_memories_user_idx on public.ai_memories (user_id, created_at desc);

alter table public.ai_memories enable row level security;
drop policy if exists ai_memories_own on public.ai_memories;
create policy ai_memories_own on public.ai_memories for all to authenticated
  using (user_id = (select auth.uid()) and not public.is_investor())
  with check (user_id = (select auth.uid()) and not public.is_investor());

-- At most 50 facts per person: the oldest goes when a new one comes.
create or replace function public.ai_memories_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from ai_memories
   where user_id = new.user_id
     and id in (select id from ai_memories where user_id = new.user_id order by created_at desc offset 50);
  return null;
end;
$$;

revoke all on function public.ai_memories_cap() from public, anon, authenticated;

drop trigger if exists ai_memories_cap on public.ai_memories;
create trigger ai_memories_cap after insert on public.ai_memories
  for each row execute function public.ai_memories_cap();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ai-web-cache-retention') then
    perform cron.unschedule('ai-web-cache-retention');
  end if;
end $$;

select cron.schedule(
  'ai-web-cache-retention',
  '41 3 * * *',
  $cron$ delete from public.ai_web_cache where fetched_at < now() - interval '7 days'; $cron$
);
