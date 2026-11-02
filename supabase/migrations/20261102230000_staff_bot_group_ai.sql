-- Xodim boti PR-8: guruh suhbatini AI tahlili — faqat TAKLIF, tasdiqsiz hech narsa yaratilmaydi.
-- Rejim (bot_settings.group_ai_mode): off | shadow (faqat yoziladi, guruhga chiqmaydi) | on (guruhga taklif kartasi).

insert into public.bot_settings (key, value) values ('group_ai_mode', 'shadow')
on conflict (key) do nothing;

create table if not exists public.bot_proposals (
  id                uuid primary key default gen_random_uuid(),
  chat_id           bigint not null,
  source_message_id bigint not null,
  kind              text not null check (kind in ('create', 'close')),
  author_user_id    uuid references auth.users(id) on delete set null,
  assignee_user_id  uuid references auth.users(id) on delete set null,
  task_id           uuid references public.tasks(id) on delete set null,
  title             text,
  due_date          timestamptz,
  priority          text,
  confidence        numeric(3,2),
  reason            text,
  mode              text not null check (mode in ('shadow', 'on')),
  status            text not null default 'pending'
                    check (status in ('pending', 'accepted', 'rejected', 'expired', 'shadow')),
  card_message_id   bigint,
  decided_by        uuid references auth.users(id) on delete set null,
  decided_at        timestamptz,
  created_task_id   uuid references public.tasks(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (chat_id, source_message_id, kind)
);
create index if not exists bot_proposals_created_idx on public.bot_proposals (created_at desc);

alter table public.bot_proposals enable row level security;
drop policy if exists bot_proposals_select on public.bot_proposals;
create policy bot_proposals_select on public.bot_proposals
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- Tahlil uchun kontekst: ulangan xodimlar va ularning ochiq vazifalari (eng ko'pi 15 tadan).
create or replace function public.bot_group_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', l.user_id,
           'name', coalesce(nullif(trim(p.full_name), ''), '—'),
           'username', l.username,
           'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.created_at desc), '[]'::jsonb)
                       from (select id, title, created_at from public.tasks
                              where assigned_to = l.user_id and status in ('todo', 'in_progress')
                              order by created_at desc limit 15) t)
         ) order by p.full_name), '[]'::jsonb)
  from public.staff_telegram_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.is_active and public.is_staff_user(l.user_id);
$$;

-- 24 soatdan eski tasdiqlanmagan takliflarni «expired» qilish (har soat).
select cron.unschedule('staff-bot-proposals-expire') where exists (select 1 from cron.job where jobname = 'staff-bot-proposals-expire');
select cron.schedule('staff-bot-proposals-expire', '7 * * * *', $c$
  update public.bot_proposals set status = 'expired', decided_at = now()
   where status = 'pending' and created_at < now() - interval '24 hours'
$c$);

revoke all on function public.bot_group_context() from public, anon, authenticated;
grant execute on function public.bot_group_context() to service_role;

-- Sozlamalar: group_ai_mode ham saqlanadi.
create or replace function public.bot_settings_save(p_values jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text; v text; t text;
  v_uid uuid := (select auth.uid());
begin
  if not public.has_role(v_uid, 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;

  for k, v in select key, value #>> '{}' from jsonb_each(p_values) loop
    v := trim(coalesce(v, ''));
    case k
      when 'report_time', 'digest_time', 'morning_time' then
        perform public.bot_cron_expr(v, '1');
      when 'reminder_times' then
        foreach t in array array_remove(string_to_array(replace(v, ' ', ''), ','), '') loop
          perform public.bot_cron_expr(t, '1');
        end loop;
        if coalesce(array_length(array_remove(string_to_array(replace(v, ' ', ''), ','), ''), 1), 0) > 3 then
          raise exception 'at most 3 reminders' using errcode = '22023';
        end if;
        v := replace(v, ' ', '');
      when 'workdays' then
        perform public.bot_cron_expr('09:00', v);
      when 'morning_enabled', 'report_enabled' then
        if v not in ('true', 'false') then
          raise exception 'bad boolean for %', k using errcode = '22023';
        end if;
      when 'group_ai_mode' then
        if v not in ('off', 'shadow', 'on') then
          raise exception 'bad group_ai_mode' using errcode = '22023';
        end if;
      when 'digest_user_ids' then
        if v <> '' and exists (
          select 1 from unnest(string_to_array(v, ',')) u
           where u !~ '^[0-9a-f-]{36}$' or not public.is_staff_user(u::uuid)) then
          raise exception 'bad digest user' using errcode = '22023';
        end if;
      else
        raise exception 'unknown setting %', k using errcode = '22023';
    end case;
    update public.bot_settings set value = v, updated_at = now(), updated_by = v_uid where key = k;
  end loop;

  perform public.bot_apply_schedule();
end;
$$;
