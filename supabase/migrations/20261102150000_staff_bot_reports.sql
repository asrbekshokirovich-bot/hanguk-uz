-- Xodim boti PR-4: kunlik hisobot (17:00 so'rov, 17:30 / 18:00 eslatma, 18:15 ownerlarga xulosa).
-- Hisobot bir xodim uchun bir kunda bitta (qayta yozsa yangilanadi). Matn asl holida saqlanadi;
-- AI ajratgan qismlar (done/blockers/plan) qo'shimcha, AI ishlamasa bo'sh qoladi.

create table if not exists public.daily_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  raw_text    text not null,
  done        text,
  blockers    text,
  plan        text,
  ai_parsed   boolean not null default false,
  source      text not null default 'telegram' check (source in ('telegram', 'crm')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, report_date)
);
create index if not exists daily_reports_date_idx on public.daily_reports (report_date desc);

alter table public.daily_reports enable row level security;

-- O'qish: o'zi, owner va admin. Yozish faqat bot (service_role) orqali.
drop policy if exists daily_reports_select on public.daily_reports;
create policy daily_reports_select on public.daily_reports
  for select to authenticated
  using (user_id = (select auth.uid())
         or public.has_role((select auth.uid()), 'owner'::public.app_role)
         or public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Toshkent bo'yicha bugungi sana
create or replace function public.tashkent_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Tashkent')::date $$;

-- Hisobot saqlash (upsert). Natija: id va avval bor edimi.
create or replace function public.bot_save_report(
  p_actor uuid, p_raw text, p_done text, p_blockers text, p_plan text, p_ai boolean)
returns table (id uuid, was_update boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_existed boolean;
  v_id uuid;
begin
  if not public.is_staff_user(p_actor) then
    raise exception 'actor is not staff' using errcode = '42501';
  end if;
  if coalesce(trim(p_raw), '') = '' then
    raise exception 'report text required' using errcode = '22023';
  end if;
  select exists (select 1 from public.daily_reports d
                  where d.user_id = p_actor and d.report_date = public.tashkent_today())
    into v_existed;
  insert into public.daily_reports (user_id, report_date, raw_text, done, blockers, plan, ai_parsed, source)
  values (p_actor, public.tashkent_today(), left(trim(p_raw), 8000),
          nullif(trim(coalesce(p_done, '')), ''), nullif(trim(coalesce(p_blockers, '')), ''),
          nullif(trim(coalesce(p_plan, '')), ''), coalesce(p_ai, false), 'telegram')
  on conflict (user_id, report_date) do update
    set raw_text = excluded.raw_text, done = excluded.done, blockers = excluded.blockers,
        plan = excluded.plan, ai_parsed = excluded.ai_parsed, updated_at = now()
  returning daily_reports.id into v_id;
  return query select v_id, v_existed;
end;
$$;

-- Ulangan xodimlar va bugungi hisobot holati (so'rov/eslatma uchun).
create or replace function public.bot_report_targets()
returns table (user_id uuid, full_name text, dm_chat_id bigint, has_report boolean)
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id, coalesce(p.full_name, ''), l.dm_chat_id,
         exists (select 1 from public.daily_reports d
                  where d.user_id = l.user_id and d.report_date = public.tashkent_today())
  from public.staff_telegram_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id);
$$;

-- Ownerlarga xulosa: barcha xodimlar (ulanmaganlari ham), bugungi hisobot va bugun bajarilgan vazifalar soni.
create or replace function public.bot_report_summary()
returns table (user_id uuid, full_name text, is_linked boolean, has_report boolean,
               done text, blockers text, plan text, raw_text text, completed_today integer, overdue integer)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent') as d0
  ), s as (
    select distinct on (ur.user_id) ur.user_id
    from public.user_roles ur
    where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  )
  select s.user_id, coalesce(nullif(trim(p.full_name), ''), '—'),
         exists (select 1 from public.staff_telegram_links l where l.user_id = s.user_id and l.is_active),
         d.id is not null, d.done, d.blockers, d.plan, d.raw_text,
         (select count(*)::int from public.tasks t, b
           where t.assigned_to = s.user_id and t.status = 'completed' and t.completed_at >= b.d0),
         (select count(*)::int from public.tasks t, b
           where t.assigned_to = s.user_id and t.status in ('todo', 'in_progress')
             and t.due_date is not null and t.due_date < b.d0)
  from s
  left join public.profiles p on p.user_id = s.user_id
  left join public.daily_reports d on d.user_id = s.user_id and d.report_date = public.tashkent_today();
$$;

-- Xulosa oluvchilar: ulangan ownerlar.
create or replace function public.bot_owner_chats()
returns table (user_id uuid, dm_chat_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id, l.dm_chat_id
  from public.staff_telegram_links l
  where l.is_active and l.dm_chat_id is not null
    and public.has_role(l.user_id, 'owner'::public.app_role);
$$;

revoke all on function public.bot_save_report(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.bot_report_targets() from public, anon, authenticated;
revoke all on function public.bot_report_summary() from public, anon, authenticated;
revoke all on function public.bot_owner_chats() from public, anon, authenticated;
grant execute on function public.bot_save_report(uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.bot_report_targets() to service_role;
grant execute on function public.bot_report_summary() to service_role;
grant execute on function public.bot_owner_chats() to service_role;

-- Cron (UTC; Toshkent = UTC+5), Du–Sha:
-- 12:00 → 17:00 so'rov; 12:30 → 17:30 eslatma; 13:00 → 18:00 oxirgi eslatma; 13:15 → 18:15 ownerlarga xulosa.
do $$
declare
  j record;
begin
  for j in select * from (values
      ('staff-bot-report-ask',     '0 12 * * 1-6',  'ask'),
      ('staff-bot-report-remind1', '30 12 * * 1-6', 'remind'),
      ('staff-bot-report-remind2', '0 13 * * 1-6',  'remind'),
      ('staff-bot-report-summary', '15 13 * * 1-6', 'summary')) as v(name, sched, kind)
  loop
    perform cron.unschedule(j.name) where exists (select 1 from cron.job where jobname = j.name);
    perform cron.schedule(j.name, j.sched, format($c$
      select net.http_post(
        url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=report&kind=%s',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000)
    $c$, j.kind));
  end loop;
end $$;
