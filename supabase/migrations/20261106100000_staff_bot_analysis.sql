-- Xodim boti: guruhdan to'liq qabul va tahlil 2.0 (reja B2-1, B2-2).
--   staff_group_messages.edited_at   — xabar tahrir qilingan vaqt (matn yangilanadi, AI qayta tahlil qilmaydi);
--   staff_group_reactions            — guruhdagi reaksiyalar (xabar + odam bo'yicha bitta qator; bot kartasiga — task_id);
--   bot_analyses                     — har AI tahlili natijasi (none ham): turlar, ishonch, sabab, taklif bo'ldimi;
--   bot_analysis_context(p_limit)    — tahlil uchun xodimlar va ochiq vazifalar (ko'pi bilan 40, test akkauntlarsiz);
--   bot_analysis_retention()         — bot_analyses 90 kun, reaksiyalar group_retention_days (standart 90);
--   cron staff-bot-analysis-retention (21:50 UTC = 02:50 Toshkent).
-- Qayta qo'llash xavfsiz (if not exists / or replace / unschedule).

-- ── tahrir ────────────────────────────────────────────────────────────────

alter table public.staff_group_messages add column if not exists edited_at timestamptz;

-- ── reaksiyalar ───────────────────────────────────────────────────────────

create table if not exists public.staff_group_reactions (
  chat_id     bigint not null,
  message_id  bigint not null,
  tg_user_id  bigint not null,
  user_id     uuid references auth.users(id) on delete set null,
  -- joriy reaksiyalar: emoji, «custom:<id>», «⭐» (bo'sh bo'lsa qator o'chiriladi)
  emojis      text[] not null default '{}',
  -- reaksiya bot vazifa kartasiga (bot_group_cards) qo'yilgan bo'lsa
  task_id     uuid references public.tasks(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (chat_id, message_id, tg_user_id)
);
create index if not exists staff_group_reactions_updated_idx on public.staff_group_reactions (updated_at);
create index if not exists staff_group_reactions_task_idx on public.staff_group_reactions (task_id) where task_id is not null;

alter table public.staff_group_reactions enable row level security;
drop policy if exists staff_group_reactions_select on public.staff_group_reactions;
create policy staff_group_reactions_select on public.staff_group_reactions
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- ── tahlil natijalari ─────────────────────────────────────────────────────

create table if not exists public.bot_analyses (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  chat_id     bigint not null,
  message_id  bigint not null,
  -- xabar muallifi
  user_id     uuid references auth.users(id) on delete set null,
  provider    text,
  model       text,
  -- tahlil paytidagi rejim: shadow | on
  mode        text,
  -- new_task | close_task | update_task | question | decision | none
  kinds       text[] not null default '{none}'
              check (kinds <@ array['new_task', 'close_task', 'update_task', 'question', 'decision', 'none']::text[]
                     and cardinality(kinds) > 0),
  -- eng yuqori ishonch (0–1)
  confidence  numeric(4, 3) check (confidence between 0 and 1),
  -- {findings: [{kind, confidence, reason, task_id, assignee_user_id, title, due, priority, proposed, skip}],
  --  proposals: [{kind, id | skip}], job_id}
  result      jsonb not null default '{}'::jsonb,
  unique (chat_id, message_id)
);
create index if not exists bot_analyses_created_idx on public.bot_analyses (created_at desc);
create index if not exists bot_analyses_kinds_idx on public.bot_analyses using gin (kinds);

alter table public.bot_analyses enable row level security;
drop policy if exists bot_analyses_select on public.bot_analyses;
create policy bot_analyses_select on public.bot_analyses
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- Yozish faqat service_role (bot). Ochiq rollar o'zgartira olmaydi.
revoke insert, update, delete, truncate on public.staff_group_reactions from anon, authenticated;
revoke insert, update, delete, truncate on public.bot_analyses from anon, authenticated;
revoke all on public.staff_group_reactions from anon;
revoke all on public.bot_analyses from anon;

-- ── tahlil konteksti ──────────────────────────────────────────────────────

create or replace function public.bot_analysis_context(p_limit integer default 40)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with staff as (
    select l.user_id, coalesce(nullif(trim(p.full_name), ''), '—') as name, l.username
      from public.staff_telegram_links l
      left join public.profiles p on p.user_id = l.user_id
     where l.is_active and public.is_staff_user(l.user_id) and not public.fn_is_demo_user(l.user_id)
  ), t as (
    select t.id, t.title, t.assigned_to, t.created_by, t.due_date, t.status,
           coalesce(nullif(trim(p.full_name), ''), '—') as assignee_name,
           coalesce(t.updated_at, t.created_at) as touched
      from public.tasks t
      left join public.profiles p on p.user_id = t.assigned_to
     where t.status in ('todo', 'in_progress')
       and t.assigned_to is not null
       and public.is_staff_user(t.assigned_to)
       and not public.fn_is_demo_user(t.assigned_to)
     order by coalesce(t.updated_at, t.created_at) desc, t.id
     limit least(greatest(coalesce(p_limit, 40), 1), 40)
  )
  select jsonb_build_object(
    'staff', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', s.name, 'username', s.username)
                                        order by s.name) from staff s), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'assignee', t.assigned_to,
                                        'assignee_name', t.assignee_name, 'created_by', t.created_by,
                                        'due_date', t.due_date, 'status', t.status)
                                        order by t.touched desc, t.id) from t), '[]'::jsonb)
  );
$$;

-- ── saqlash muddati ───────────────────────────────────────────────────────

create or replace function public.bot_analysis_retention()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bot_analyses where created_at < now() - interval '90 days';
  delete from public.staff_group_reactions
   where updated_at < now() - make_interval(days => coalesce(
     (select nullif(value, '')::int from public.bot_settings where key = 'group_retention_days'), 90));
end;
$$;

revoke all on function public.bot_analysis_context(integer) from public, anon, authenticated;
revoke all on function public.bot_analysis_retention() from public, anon, authenticated;
grant execute on function public.bot_analysis_context(integer) to service_role;
grant execute on function public.bot_analysis_retention() to service_role;

select cron.unschedule('staff-bot-analysis-retention')
 where exists (select 1 from cron.job where jobname = 'staff-bot-analysis-retention');
select cron.schedule('staff-bot-analysis-retention', '50 21 * * *', $c$ select public.bot_analysis_retention() $c$);
