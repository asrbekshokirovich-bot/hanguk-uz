-- Botda vazifa holatini (boshladim / bajardim, guruhda ✅) faqat mas'ul o'zgartiradi.
-- Vazifani bergan odam va owner botda yopa olmaydi; CRM'dan yopish o'zgarmaydi (RLS bo'yicha).
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
  if t.assigned_to is distinct from p_actor then
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

revoke all on function public.bot_set_task_status(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bot_set_task_status(uuid, uuid, text, text) to service_role;
