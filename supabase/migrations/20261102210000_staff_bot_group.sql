-- Xodim boti PR-7: xodimlar guruhi — xabarlarni saqlash (PR-8 AI tahlili uchun, soya rejimi)
-- va aniq buyruqlar: «#vazifa @odam matn» → vazifa; bot kartasiga «✅» javob → bajarildi.

-- Guruh xabarlari (faqat owner o'qiydi; muddati bot_settings.group_retention_days, standart 90 kun).
create table if not exists public.staff_group_messages (
  id                  bigserial primary key,
  chat_id             bigint not null,
  message_id          bigint not null,
  tg_user_id          bigint,
  user_id             uuid references auth.users(id) on delete set null,
  text                text,
  reply_to_message_id bigint,
  media               text,
  kind                text not null default 'message' check (kind in ('message', 'command', 'close')),
  task_id             uuid references public.tasks(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (chat_id, message_id)
);
create index if not exists staff_group_messages_created_idx on public.staff_group_messages (created_at desc);

alter table public.staff_group_messages enable row level security;
drop policy if exists staff_group_messages_select on public.staff_group_messages;
create policy staff_group_messages_select on public.staff_group_messages
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- Bot guruhga yuborgan vazifa kartalari: kartaga javob → qaysi vazifa.
create table if not exists public.bot_group_cards (
  chat_id    bigint not null,
  message_id bigint not null,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);
alter table public.bot_group_cards enable row level security;
-- siyosat yo'q — faqat service_role

-- @username → ulangan xodim
create or replace function public.bot_resolve_username(p_username text)
returns table (user_id uuid, full_name text, telegram_user_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id, coalesce(nullif(trim(p.full_name), ''), '—'), l.telegram_user_id
  from public.staff_telegram_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.is_active and lower(l.username) = lower(ltrim(p_username, '@'))
    and public.is_staff_user(l.user_id)
  limit 1;
$$;

-- bot_create_task / bot_set_task_status: manba (dm | group) parametri qo'shiladi.
drop function if exists public.bot_create_task(uuid, uuid, text, text, timestamptz, text);
create or replace function public.bot_create_task(
  p_actor uuid, p_assignee uuid, p_title text, p_description text,
  p_due timestamptz, p_priority text, p_via text default 'dm')
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
  if p_via not in ('dm', 'group') then
    raise exception 'bad via' using errcode = '22023';
  end if;

  perform set_config('app.task_via', p_via, true);
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

drop function if exists public.bot_set_task_status(uuid, uuid, text);
create or replace function public.bot_set_task_status(p_actor uuid, p_task uuid, p_status text, p_via text default 'dm')
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
  if p_via not in ('dm', 'group') then
    raise exception 'bad via' using errcode = '22023';
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

  perform set_config('app.task_via', p_via, true);
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

revoke all on function public.bot_resolve_username(text) from public, anon, authenticated;
revoke all on function public.bot_create_task(uuid, uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.bot_set_task_status(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bot_resolve_username(text) to service_role;
grant execute on function public.bot_create_task(uuid, uuid, text, text, timestamptz, text, text) to service_role;
grant execute on function public.bot_set_task_status(uuid, uuid, text, text) to service_role;

-- Eski guruh xabarlarini tozalash: har kuni 02:30 Toshkent (21:30 UTC).
select cron.unschedule('staff-bot-group-retention') where exists (select 1 from cron.job where jobname = 'staff-bot-group-retention');
select cron.schedule('staff-bot-group-retention', '30 21 * * *', $c$
  delete from public.staff_group_messages
   where created_at < now() - make_interval(days => coalesce(
     (select nullif(value, '')::int from public.bot_settings where key = 'group_retention_days'), 90))
$c$);
