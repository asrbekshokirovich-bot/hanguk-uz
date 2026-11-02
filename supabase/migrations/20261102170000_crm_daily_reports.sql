-- CRM «Kunlik hisobotlar» sahifasi (xodim boti PR-5).
-- Tanlangan kun uchun barcha xodimlar va ularning hisoboti (yo'q bo'lsa ham qator chiqadi).
-- Owner/admin hammani ko'radi, boshqa xodim — faqat o'zini.

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
    and (me.is_manager or s.user_id = me.uid);
$$;

revoke all on function public.crm_daily_reports(date) from public, anon;
grant execute on function public.crm_daily_reports(date) to authenticated, service_role;
