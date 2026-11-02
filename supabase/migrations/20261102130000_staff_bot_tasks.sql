-- Xodim boti PR-3: DM'da vazifa berish / boshlash / bajarish, ertalabki ro'yxat.
-- Hammasi faqat service_role (staff-bot) uchun; bot har chaqiruvda xodimni o'zi aniqlaydi.
-- Vazifa voqealari trg_task_events orqali via='dm' (yoki 'cron') va to'g'ri aktor bilan yoziladi.

-- Vazifa berish uchun xodimlar ro'yxati (ulangan-ulanmaganidan qat'i nazar).
create or replace function public.bot_staff_list()
returns table (user_id uuid, full_name text, is_linked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (ur.user_id)
         ur.user_id,
         coalesce(nullif(trim(p.full_name), ''), '—') as full_name,
         exists (select 1 from public.staff_telegram_links l where l.user_id = ur.user_id and l.is_active) as is_linked
  from public.user_roles ur
  left join public.profiles p on p.user_id = ur.user_id
  where ur.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  order by ur.user_id;
$$;

-- Vazifa yaratish (bot DM). Natija: yangi vazifa id.
create or replace function public.bot_create_task(
  p_actor uuid, p_assignee uuid, p_title text, p_description text,
  p_due timestamptz, p_priority text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff_user(p_actor) then
    raise exception 'actor is not staff' using errcode = '42501';
  end if;
  if not public.is_staff_user(p_assignee) then
    raise exception 'assignee is not staff' using errcode = '22023';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title required' using errcode = '22023';
  end if;

  perform set_config('app.task_via', 'dm', true);
  perform set_config('app.task_actor', p_actor::text, true);

  insert into public.tasks (title, description, priority, status, due_date, assigned_to, created_by, source)
  values (left(trim(p_title), 200), nullif(trim(coalesce(p_description, '')), ''),
          case when p_priority in ('urgent', 'high', 'normal', 'low') then p_priority else 'normal' end,
          'todo', p_due, p_assignee, p_actor, 'telegram')
  returning id into v_id;

  perform set_config('app.task_via', '', true);
  perform set_config('app.task_actor', '', true);
  return v_id;
end;
$$;

-- Holatni o'zgartirish: mas'ul, beruvchi yoki owner.
-- Natija: ok | not_found | not_allowed | same
create or replace function public.bot_set_task_status(p_actor uuid, p_task uuid, p_status text)
returns table (result text, title text, created_by uuid, assigned_to uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  t record;
begin
  if p_status not in ('todo', 'in_progress', 'completed', 'cancelled') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::uuid; return;
  end if;
  if not (t.assigned_to = p_actor or t.created_by = p_actor
          or public.has_role(p_actor, 'owner'::public.app_role)) then
    return query select 'not_allowed'::text, t.title, t.created_by, t.assigned_to; return;
  end if;
  if t.status = p_status then
    return query select 'same'::text, t.title, t.created_by, t.assigned_to; return;
  end if;

  perform set_config('app.task_via', 'dm', true);
  perform set_config('app.task_actor', p_actor::text, true);
  update public.tasks
     set status = p_status,
         completed_at = case when p_status = 'completed' then now() else null end
   where id = p_task;
  perform set_config('app.task_via', '', true);
  perform set_config('app.task_actor', '', true);

  return query select 'ok'::text, t.title, t.created_by, t.assigned_to;
end;
$$;

-- Ertalabki ro'yxat: ulangan xodimlar va ularning muddati o'tgan / bugungi ochiq vazifalari soni.
create or replace function public.bot_morning_targets()
returns table (user_id uuid, full_name text, dm_chat_id bigint, overdue integer, today integer)
language sql
stable
security definer
set search_path = public
as $$
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
  group by l.user_id, p.full_name, l.dm_chat_id;
$$;

revoke all on function public.bot_staff_list() from public, anon, authenticated;
revoke all on function public.bot_create_task(uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.bot_set_task_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.bot_morning_targets() from public, anon, authenticated;
grant execute on function public.bot_staff_list() to service_role;
grant execute on function public.bot_create_task(uuid, uuid, text, text, timestamptz, text) to service_role;
grant execute on function public.bot_set_task_status(uuid, uuid, text) to service_role;
grant execute on function public.bot_morning_targets() to service_role;

-- Du–Sha 04:00 UTC = 09:00 Toshkent: ertalabki ro'yxat (faqat vazifasi borlarga).
select cron.unschedule('staff-bot-morning') where exists (select 1 from cron.job where jobname = 'staff-bot-morning');
select cron.schedule(
  'staff-bot-morning',
  '0 4 * * 1-6',
  $cron$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=morning',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)
  $cron$
);
