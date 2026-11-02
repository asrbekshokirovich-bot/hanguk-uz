-- Asrbek (2026-11-02): 17:00 hisobot so'rovi va eslatmalar owner'larga kelmasin, faqat xodimlarga.
-- Shunga mos ravishda 18:15 xulosa va CRM «Kunlik hisobotlar» ham owner'larni «topshirmadi» deb sanamaydi.
-- Owner xohlasa «📝 Hisobot» tugmasi bilan baribir yoza oladi.

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
  where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id)
    and not public.has_role(l.user_id, 'owner'::public.app_role);
$$;

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
      and not public.has_role(ur.user_id, 'owner'::public.app_role)
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

create or replace function public.crm_daily_reports(p_date date)
returns table (
  user_id uuid, full_name text, is_linked boolean,
  report_id uuid, raw_text text, done text, blockers text, plan text,
  ai_parsed boolean, submitted_at timestamptz, updated_at timestamptz,
  completed_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select (select auth.uid()) as uid,
           public.has_role((select auth.uid()), 'owner'::public.app_role)
             or public.has_role((select auth.uid()), 'admin'::public.app_role) as is_manager
  ), b as (
    select (p_date::timestamp at time zone 'Asia/Tashkent') as d0
  ), s as (
    select distinct on (ur.user_id) ur.user_id
    from public.user_roles ur
    where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  )
  select s.user_id,
         coalesce(nullif(trim(p.full_name), ''), '—'),
         exists (select 1 from public.staff_telegram_links l where l.user_id = s.user_id and l.is_active),
         d.id, d.raw_text, d.done, d.blockers, d.plan, coalesce(d.ai_parsed, false), d.created_at, d.updated_at,
         (select count(*)::int from public.tasks t, b
           where t.assigned_to = s.user_id and t.status = 'completed'
             and t.completed_at >= b.d0 and t.completed_at < b.d0 + interval '1 day')
  from s
  cross join me
  left join public.profiles p on p.user_id = s.user_id
  left join public.daily_reports d on d.user_id = s.user_id and d.report_date = p_date
  where me.uid is not null
    and public.is_staff_user(me.uid)
    and (me.is_manager or s.user_id = me.uid)
    -- owner'lar ro'yxatda faqat o'zi hisobot yozgan bo'lsa ko'rinadi
    and (not public.has_role(s.user_id, 'owner'::public.app_role) or d.id is not null);
$$;
