-- Test akkauntlar xodimlar ro'yxatida chiqmasin (Asrbek, 2026-11-05:
-- "ro'yxatdan chiqarib tashla").
--
-- 18:15 hisobot xulosasida "AI Eval Xodim" (ai-eval-staff@hanguk.local,
-- call_operator, profiles.is_demo) hisobot yozmagan xodimdek chiqardi —
-- "Topshirdi: 1 / 8". Akkaunt Hanguk AI eval testlari uchun kerak, o'chirilmaydi;
-- faqat bot va CRM ro'yxatlaridan chiqariladi: hisobot so'rovi/eslatma,
-- 18:15 xulosa, «Vazifa berish» hamkasblar ro'yxati, ertalabki xabar/brifing,
-- CRM «Kunlik hisobotlar».

create or replace function public.fn_is_demo_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select p.is_demo from public.profiles p where p.user_id = p_user limit 1), false);
$$;

revoke all on function public.fn_is_demo_user(uuid) from public, anon, authenticated;

create or replace function public.bot_brief_targets()
returns table (user_id uuid, full_name text, dm_chat_id bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.user_id, coalesce(p.full_name, ''), l.dm_chat_id
    from public.staff_telegram_links l
    left join public.profiles p on p.user_id = l.user_id
   where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id)
     and not public.fn_is_demo_user(l.user_id);
$function$;

create or replace function public.bot_morning_targets()
returns table (user_id uuid, full_name text, dm_chat_id bigint, overdue integer, today integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with b as (
    select (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent') as d0
  )
  select l.user_id, coalesce(p.full_name, ''), l.dm_chat_id,
         count(*) filter (where t.due_date < b.d0)::int,
         count(*) filter (where t.due_date >= b.d0 and t.due_date < b.d0 + interval '1 day')::int
  from public.staff_telegram_links l
  cross join b
  left join public.profiles p on p.user_id = l.user_id
  join public.tasks t on t.assigned_to = l.user_id and t.status in ('todo', 'in_progress')
                     and t.due_date is not null and t.due_date < b.d0 + interval '1 day'
  where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id)
    and not public.fn_is_demo_user(l.user_id)
  group by l.user_id, p.full_name, l.dm_chat_id;
$function$;

create or replace function public.bot_report_summary()
returns table (user_id uuid, full_name text, is_linked boolean, has_report boolean, done text, blockers text,
               plan text, raw_text text, completed_today integer, overdue integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with b as (
    select (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent') as d0
  ), s as (
    select distinct on (ur.user_id) ur.user_id
    from public.user_roles ur
    where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
      and not public.has_role(ur.user_id, 'owner'::public.app_role)
      and not public.fn_is_demo_user(ur.user_id)
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
$function$;

create or replace function public.bot_report_targets()
returns table (user_id uuid, full_name text, dm_chat_id bigint, has_report boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select l.user_id, coalesce(p.full_name, ''), l.dm_chat_id,
         exists (select 1 from public.daily_reports d
                  where d.user_id = l.user_id and d.report_date = public.tashkent_today())
  from public.staff_telegram_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id)
    and not public.has_role(l.user_id, 'owner'::public.app_role)
    and not public.fn_is_demo_user(l.user_id);
$function$;

create or replace function public.bot_staff_list()
returns table (user_id uuid, full_name text, is_linked boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select distinct on (ur.user_id)
         ur.user_id,
         coalesce(nullif(trim(p.full_name), ''), '—') as full_name,
         exists (select 1 from public.staff_telegram_links l where l.user_id = ur.user_id and l.is_active) as is_linked
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
    and not coalesce(p.is_demo, false)
  order by ur.user_id;
$function$;

create or replace function public.crm_daily_reports(p_date date)
returns table (user_id uuid, full_name text, is_linked boolean, report_id uuid, raw_text text, done text,
               blockers text, plan text, ai_parsed boolean, submitted_at timestamptz, updated_at timestamptz,
               completed_count integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
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
      and not public.fn_is_demo_user(ur.user_id)
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
    and (not public.has_role(s.user_id, 'owner'::public.app_role) or d.id is not null);
$function$;
