-- Xodim boti B1-3: vazifa kartasidan boshqarish — izoh, muddat, boshqa xodimga o'tkazish.
--
-- Guruhda bot kartasiga (bot_group_cards) yoki DM'da bot yuborgan vazifa kartasiga javob yozilsa
-- (staff-bot/cards.ts, card_actions.ts):
--   - vazifa bergan (created_by) yoki owner: «ertaga 15:00» → muddat, «@username» → boshqa xodimga;
--   - qolgan javob → izoh: CRM'dagi vazifa paneli «Faollik» bo'limi o'qiydigan task_comments
--     (muallif = xodim) + task_events(kind = 'comment').
-- Vazifani yopish qoidasi o'zgarmaydi (bot_set_task_status — faqat mas'ul).
--
-- Funksiyalar faqat service_role uchun (bot). Ular app.task_via / app.task_actor qo'yadi — shunda
-- trg_task_events (fn_task_events_log) 'due' / 'assignee' voqeasini to'g'ri manba (dm | group) va
-- aktor bilan yozadi. Natija kodi: ok | not_found | not_allowed | closed | same | past | bad_assignee.

-- ---------------------------------------------------------------- muddat
create or replace function public.bot_set_task_due(p_actor uuid, p_task uuid, p_due timestamptz, p_via text default 'dm')
returns table (result text, title text, created_by uuid, assigned_to uuid, status text, priority text,
               old_due timestamptz, new_due timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  t record;
begin
  if p_via not in ('dm', 'group') then
    raise exception 'bad via' using errcode = '22023';
  end if;
  if p_due is null then
    raise exception 'due required' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::uuid, null::text, null::text,
                        null::timestamptz, null::timestamptz;
    return;
  end if;
  -- muddatni vazifa bergan yoki owner o'zgartiradi
  if not public.is_staff_user(p_actor)
     or not coalesce(t.created_by = p_actor or public.has_role(p_actor, 'owner'::public.app_role), false) then
    return query select 'not_allowed'::text, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date, t.due_date;
    return;
  end if;
  if t.status in ('completed', 'cancelled') then
    return query select 'closed'::text, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date, t.due_date;
    return;
  end if;
  if t.due_date is not distinct from p_due then
    return query select 'same'::text, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date, t.due_date;
    return;
  end if;
  if p_due < now() then
    return query select 'past'::text, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date, t.due_date;
    return;
  end if;

  perform set_config('app.task_via', p_via, true);
  perform set_config('app.task_actor', p_actor::text, true);
  update public.tasks set due_date = p_due where id = p_task;
  perform set_config('app.task_via', '', true);
  perform set_config('app.task_actor', '', true);

  return query select 'ok'::text, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date, p_due;
end;
$$;

-- ---------------------------------------------------------------- boshqa xodimga o'tkazish
create or replace function public.bot_reassign_task(p_actor uuid, p_task uuid, p_assignee uuid, p_via text default 'dm')
returns table (result text, title text, created_by uuid, old_assignee uuid, new_assignee uuid, status text,
               priority text, due_date timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  t record;
begin
  if p_via not in ('dm', 'group') then
    raise exception 'bad via' using errcode = '22023';
  end if;
  if p_assignee is null then
    raise exception 'assignee required' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid, null::uuid, null::uuid, null::text, null::text,
                        null::timestamptz;
    return;
  end if;
  -- mas'ulni vazifa bergan yoki owner o'zgartiradi
  if not public.is_staff_user(p_actor)
     or not coalesce(t.created_by = p_actor or public.has_role(p_actor, 'owner'::public.app_role), false) then
    return query select 'not_allowed'::text, t.title, t.created_by, t.assigned_to, t.assigned_to, t.status, t.priority, t.due_date;
    return;
  end if;
  if not public.is_staff_user(p_assignee) then
    return query select 'bad_assignee'::text, t.title, t.created_by, t.assigned_to, t.assigned_to, t.status, t.priority, t.due_date;
    return;
  end if;
  if t.status in ('completed', 'cancelled') then
    return query select 'closed'::text, t.title, t.created_by, t.assigned_to, t.assigned_to, t.status, t.priority, t.due_date;
    return;
  end if;
  if t.assigned_to is not distinct from p_assignee then
    return query select 'same'::text, t.title, t.created_by, t.assigned_to, t.assigned_to, t.status, t.priority, t.due_date;
    return;
  end if;

  perform set_config('app.task_via', p_via, true);
  perform set_config('app.task_actor', p_actor::text, true);
  update public.tasks set assigned_to = p_assignee where id = p_task;
  perform set_config('app.task_via', '', true);
  perform set_config('app.task_actor', '', true);

  return query select 'ok'::text, t.title, t.created_by, t.assigned_to, p_assignee, t.status, t.priority, t.due_date;
end;
$$;

-- ---------------------------------------------------------------- izoh
create or replace function public.bot_add_task_comment(p_actor uuid, p_task uuid, p_content text, p_via text default 'dm')
returns table (result text, comment_id uuid, title text, created_by uuid, assigned_to uuid, status text,
               priority text, due_date timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  t record;
  v_id uuid;
  v_text text := left(trim(coalesce(p_content, '')), 4000);
begin
  if p_via not in ('dm', 'group') then
    raise exception 'bad via' using errcode = '22023';
  end if;
  if v_text = '' then
    raise exception 'content required' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::uuid, null::uuid, null::text, null::text,
                        null::timestamptz;
    return;
  end if;
  -- izohni mas'ul, vazifa bergan yoki owner qo'shadi
  if not public.is_staff_user(p_actor)
     or not coalesce(t.assigned_to = p_actor or t.created_by = p_actor
                     or public.has_role(p_actor, 'owner'::public.app_role), false) then
    return query select 'not_allowed'::text, null::uuid, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date;
    return;
  end if;

  perform set_config('app.task_via', p_via, true);
  perform set_config('app.task_actor', p_actor::text, true);
  insert into public.task_comments (task_id, user_id, content)
  values (p_task, p_actor, v_text)
  returning id into v_id;
  -- task_comments'da trigger yo'q — voqeani shu yerda yozamiz (matn task_comments'da, RLS bilan)
  insert into public.task_events (task_id, actor_user_id, kind, via, payload)
  values (p_task, p_actor, 'comment', p_via, jsonb_build_object('comment_id', v_id));
  perform set_config('app.task_via', '', true);
  perform set_config('app.task_actor', '', true);

  return query select 'ok'::text, v_id, t.title, t.created_by, t.assigned_to, t.status, t.priority, t.due_date;
end;
$$;

revoke all on function public.bot_set_task_due(uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.bot_reassign_task(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.bot_add_task_comment(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bot_set_task_due(uuid, uuid, timestamptz, text) to service_role;
grant execute on function public.bot_reassign_task(uuid, uuid, uuid, text) to service_role;
grant execute on function public.bot_add_task_comment(uuid, uuid, text, text) to service_role;
