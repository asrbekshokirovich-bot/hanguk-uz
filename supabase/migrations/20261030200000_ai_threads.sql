-- Hanguk AI page redesign (Asrbek, 2026-10-27): "Oxirgi suhbatlar", "Tarix",
-- "Davom etish" and pinning need separate conversations. Until now every
-- message of a user went into one endless stream in ai_conversations.
--
--   ai_threads                one row per conversation (title = first question,
--                             preview = latest answer, message count, pin)
--   ai_conversations.thread_id which conversation a message belongs to
--   ai_thread_touch()         keeps count / preview / updated_at in step
--
-- Existing staff messages become one "Oldingi suhbatlar" thread per user, so
-- nothing is lost. Messages without a thread (student app) work as before.

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_type text not null default 'staff',
  title text not null default '',
  pinned boolean not null default false,
  message_count integer not null default 0,
  last_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_threads_user_recent_idx
  on public.ai_threads (user_id, pinned desc, updated_at desc);

alter table public.ai_threads enable row level security;

drop policy if exists ai_threads_own_select on public.ai_threads;
drop policy if exists ai_threads_own_insert on public.ai_threads;
drop policy if exists ai_threads_own_update on public.ai_threads;
drop policy if exists ai_threads_own_delete on public.ai_threads;
create policy ai_threads_own_select on public.ai_threads for select to authenticated
  using (user_id = (select auth.uid()) and not public.is_investor());
create policy ai_threads_own_insert on public.ai_threads for insert to authenticated
  with check (user_id = (select auth.uid()) and not public.is_investor());
create policy ai_threads_own_update on public.ai_threads for update to authenticated
  using (user_id = (select auth.uid()) and not public.is_investor())
  with check (user_id = (select auth.uid()));
create policy ai_threads_own_delete on public.ai_threads for delete to authenticated
  using (user_id = (select auth.uid()) and not public.is_investor());

alter table public.ai_conversations
  add column if not exists thread_id uuid references public.ai_threads(id) on delete cascade;
create index if not exists ai_conversations_thread_idx
  on public.ai_conversations (thread_id, created_at);

create or replace function public.ai_thread_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.thread_id is not null then
    update ai_threads
       set message_count = message_count + 1,
           updated_at = greatest(updated_at, new.created_at),
           last_preview = case
             when new.role = 'assistant' then
               left(btrim(regexp_replace(regexp_replace(new.content, '[#*_`>|]+', '', 'g'), '\s+', ' ', 'g')), 220)
             else last_preview end
     where id = new.thread_id;
  end if;
  return new;
end;
$$;

revoke all on function public.ai_thread_touch() from public, anon, authenticated;

drop trigger if exists ai_conversations_thread_touch on public.ai_conversations;
create trigger ai_conversations_thread_touch
  after insert on public.ai_conversations
  for each row execute function public.ai_thread_touch();

-- Existing staff history → one thread per user.
with u as (
  select user_id, min(created_at) first_at, max(created_at) last_at, count(*) n
    from ai_conversations
   where user_type = 'staff' and thread_id is null
   group by user_id
), t as (
  insert into ai_threads (user_id, user_type, title, message_count, created_at, updated_at, last_preview)
  select u.user_id, 'staff', 'Oldingi suhbatlar', u.n, u.first_at, u.last_at,
         (select left(btrim(regexp_replace(regexp_replace(c.content, '[#*_`>|]+', '', 'g'), '\s+', ' ', 'g')), 220)
            from ai_conversations c
           where c.user_id = u.user_id and c.user_type = 'staff' and c.role = 'assistant'
           order by c.created_at desc limit 1)
    from u
   where exists (select 1 from auth.users au where au.id = u.user_id)
  returning id, user_id
)
update ai_conversations c
   set thread_id = t.id
  from t
 where c.user_id = t.user_id and c.user_type = 'staff' and c.thread_id is null;
