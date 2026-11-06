-- Xodim boti B4-2 (intizom kuzatuvi) va B4-3 (KPI paneli). Migratsiya diapazoni: report 150000-159999.
--
-- bot_report_discipline() — owner uchun: har xodim bo'yicha oxirgi hisobot sanasi va shundan beri
--   o'tgan ish kunlari soni (workdays bo'yicha, bot_settings.workdays — kun raqamlari ISO: 1=Du..7=Yak,
--   bo'sh bo'lsa har kuni). 2 ish kundan ortiq topshirmagan bo'lsa discipline.ts owner'ga xabar beradi
--   (report_alerts bilan dublikat oldi olinadi).
-- bot_kpi_weekly(p_from, p_to) — owner uchun: har xodim bo'yicha bajarilgan/kechikkan vazifalar va
--   hisobot topshirish foizi berilgan oraliqda (standart — oxirgi 7 kun, Toshkent sanasi bilan).
-- report_alerts — bitta xodim uchun bitta kunda bitta intizom ogohlantirishi (owner'larga).

create table if not exists public.report_alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  alert_date date not null,
  missed     integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, alert_date)
);
alter table public.report_alerts enable row level security;
revoke all on table public.report_alerts from anon, authenticated;

-- Toshkent bo'yicha ish kuni sonini sanash (ikki sana orasida, workdays bo'yicha; ikkisi kiritilmaydi).
create or replace function public.fn_workdays_between(p_from date, p_to date, p_workdays text)
returns integer
language sql
immutable
as $function$
  select count(*)::int
  from generate_series((p_from + 1)::timestamp, (p_to - 1)::timestamp, interval '1 day') as g(d)
  where coalesce(p_workdays, '') = ''
     or extract(isodow from g.d)::text = any (string_to_array(p_workdays, ','));
$function$;

revoke all on function public.fn_workdays_between(date, date, text) from public, anon, authenticated;
grant execute on function public.fn_workdays_between(date, date, text) to service_role;

create or replace function public.bot_report_discipline(p_workdays text default '')
returns table (user_id uuid, full_name text, dm_chat_id bigint, last_report_date date, missed_workdays integer)
language sql
stable
security definer
set search_path = public
as $function$
  select l.user_id, coalesce(nullif(trim(p.full_name), ''), '—'), l.dm_chat_id,
         (select max(d.report_date) from public.daily_reports d where d.user_id = l.user_id),
         public.fn_workdays_between(
           coalesce((select max(d.report_date) from public.daily_reports d where d.user_id = l.user_id),
                     public.tashkent_today() - 14),
           public.tashkent_today() + 1, p_workdays)
  from public.staff_telegram_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.is_active and l.dm_chat_id is not null and public.is_staff_user(l.user_id)
    and not public.has_role(l.user_id, 'owner'::public.app_role)
    and not public.fn_is_demo_user(l.user_id)
  order by 5 desc, 2;
$function$;

revoke all on function public.bot_report_discipline(text) from public, anon, authenticated;
grant execute on function public.bot_report_discipline(text) to service_role;

-- Band qilish (bir xodim — bir kunda bitta ogohlantirish): notify.ts/task_reminders bilan bir xil andoza.
create or replace function public.bot_report_alert_claim(p_user uuid, p_missed integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.report_alerts (user_id, alert_date, missed)
  values (p_user, public.tashkent_today(), p_missed)
  on conflict (user_id, alert_date) do nothing;
  return found;
end;
$function$;

revoke all on function public.bot_report_alert_claim(uuid, integer) from public, anon, authenticated;
grant execute on function public.bot_report_alert_claim(uuid, integer) to service_role;

-- KPI: oraliq standart — oxirgi 7 kun (bugun kiritilmaydi — kun tugamagan).
create or replace function public.bot_kpi_weekly(p_from date default null, p_to date default null)
returns table (user_id uuid, full_name text, completed integer, overdue_now integer,
               reports_submitted integer, workdays integer, report_rate numeric)
language sql
stable
security definer
set search_path = public
as $function$
  with rng as (
    select coalesce(p_from, public.tashkent_today() - 7) as d_from,
           coalesce(p_to, public.tashkent_today() - 1) as d_to
  ), s as (
    select l.user_id, coalesce(nullif(trim(p.full_name), ''), '—') as full_name
    from public.staff_telegram_links l
    left join public.profiles p on p.user_id = l.user_id
    where l.is_active and public.is_staff_user(l.user_id)
      and not public.has_role(l.user_id, 'owner'::public.app_role)
      and not public.fn_is_demo_user(l.user_id)
  )
  select s.user_id, s.full_name,
         (select count(*)::int from public.tasks t, rng
           where t.assigned_to = s.user_id and t.status = 'completed'
             and t.completed_at >= (rng.d_from::timestamp at time zone 'Asia/Tashkent')
             and t.completed_at < ((rng.d_to + 1)::timestamp at time zone 'Asia/Tashkent')),
         (select count(*)::int from public.tasks t
           where t.assigned_to = s.user_id and t.status in ('todo', 'in_progress')
             and t.due_date is not null and t.due_date < now()),
         (select count(*)::int from public.daily_reports d, rng
           where d.user_id = s.user_id and d.report_date between rng.d_from and rng.d_to),
         (select greatest(rng.d_to - rng.d_from + 1, 1)::int from rng),
         round(
           (select count(*)::numeric from public.daily_reports d, rng
             where d.user_id = s.user_id and d.report_date between rng.d_from and rng.d_to)
           / (select greatest(rng.d_to - rng.d_from + 1, 1)::numeric from rng) * 100, 0)
  from s
  order by 2;
$function$;

revoke all on function public.bot_kpi_weekly(date, date) from public, anon, authenticated;
grant execute on function public.bot_kpi_weekly(date, date) to service_role;
