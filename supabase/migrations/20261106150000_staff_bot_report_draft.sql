-- Xodim boti B4-1: hisobot QORALAMASI (kun davomidagi task_events/tasks asosida AI taklif qiladi,
-- xodim tahrirlab tasdiqlaydi — hozirgi bot_save_report oqimiga mos). Migratsiya diapazoni: report 150000-159999.
--
-- bot_report_draft_context(p_actor) — shu Toshkent kunida xodim bilan bog'liq faoliyat (sof ma'lumot,
-- AI promptga ketadi): bajargan vazifalar, boshlagan vazifalar, yozgan izohlar. AI yo'q/xato bo'lsa
-- report2.ts shu ma'lumotni oddiy ro'yxat qilib ko'rsatadi (fallback).
-- daily_reports.draft_text/draft_model — qaysi qoralama taklif qilingani (audit uchun; bot_save_report
-- saqlaganda ixtiyoriy p_draft/p_draft_model bilan yoziladi, berilmasa eskisi saqlanadi).

alter table public.daily_reports add column if not exists draft_text text;
alter table public.daily_reports add column if not exists draft_model text;

create or replace function public.bot_report_draft_context(p_actor uuid)
returns table (completed text[], started text[], comments text[])
language sql
stable
security definer
set search_path = public
as $function$
  with b as (
    select (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent') as d0
  )
  select
    coalesce((select array_agg(distinct t.title order by t.title) from public.tasks t, b
               where t.assigned_to = p_actor and t.status = 'completed' and t.completed_at >= b.d0), '{}'::text[]),
    coalesce((select array_agg(distinct t.title order by t.title) from public.tasks t, b
               where t.assigned_to = p_actor and t.status = 'in_progress' and t.updated_at >= b.d0), '{}'::text[]),
    coalesce((select array_agg(left(e.payload->>'text', 300) order by e.created_at) from public.task_events e, b
               where e.actor_user_id = p_actor and e.kind = 'comment' and e.created_at >= b.d0
                 and coalesce(e.payload->>'text', '') <> ''), '{}'::text[]);
$function$;

revoke all on function public.bot_report_draft_context(uuid) from public, anon, authenticated;
grant execute on function public.bot_report_draft_context(uuid) to service_role;

-- bot_save_report'ga ixtiyoriy qoralama ustunlari (mavjud chaqiruvlar named-arg bo'lgani uchun buzilmaydi).
-- Eski 6-argumentli funksiya o'chiriladi — aks holda 2 ta overload (6 va standart qiymatli 8) bir xil
-- named-chaqiruvda noaniqlik (ambiguous function) xatosini beradi.
drop function if exists public.bot_save_report(uuid, text, text, text, text, boolean);

create or replace function public.bot_save_report(
  p_actor uuid, p_raw text, p_done text, p_blockers text, p_plan text, p_ai boolean,
  p_draft text default null, p_draft_model text default null)
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
  insert into public.daily_reports (user_id, report_date, raw_text, done, blockers, plan, ai_parsed, source,
                                     draft_text, draft_model)
  values (p_actor, public.tashkent_today(), left(trim(p_raw), 8000),
          nullif(trim(coalesce(p_done, '')), ''), nullif(trim(coalesce(p_blockers, '')), ''),
          nullif(trim(coalesce(p_plan, '')), ''), coalesce(p_ai, false), 'telegram',
          nullif(trim(coalesce(p_draft, '')), ''), p_draft_model)
  on conflict (user_id, report_date) do update
    set raw_text = excluded.raw_text, done = excluded.done, blockers = excluded.blockers,
        plan = excluded.plan, ai_parsed = excluded.ai_parsed, updated_at = now(),
        draft_text = coalesce(excluded.draft_text, daily_reports.draft_text),
        draft_model = coalesce(excluded.draft_model, daily_reports.draft_model)
  returning daily_reports.id into v_id;
  return query select v_id, v_existed;
end;
$$;

revoke all on function public.bot_save_report(uuid, text, text, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.bot_save_report(uuid, text, text, text, text, boolean, text, text) to service_role;
