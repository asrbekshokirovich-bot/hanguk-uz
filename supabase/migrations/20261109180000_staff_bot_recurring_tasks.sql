-- Xodim boti B5-2 (oxirgi qism): takroriy vazifalar.
-- Talabaga bog'lash qismi allaqachon bajarilgan (20261106160000: bot_set_task_student, /talaba).
-- Bu yerda: xodim (yoki owner) "har kuni" yoki "har hafta <kunlar>" takrorlanadigan vazifa belgilaydi
-- (masalan soat 18:00 da); har kuni ertalab cron shu sana uchun kerakli vazifalarni tasks'ga yaratadi.
-- Yaratilgan vazifa haqida xabar mavjud trg_task_events + bot_notify_claim zanjiri orqali o'zi boradi
-- (kind='created', via='cron) — shu uchun recurring.ts alohida DM yubormaydi.

create table if not exists public.task_recurrences (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  assigned_to      uuid references auth.users(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  priority         text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  freq             text not null check (freq in ('daily', 'weekly')),
  -- ISO hafta kunlari vergul bilan ('1,3,5' = Du,Chor,Juma), faqat freq='weekly' uchun; daily'da bo'sh.
  weekdays         text,
  -- Toshkent vaqti 'HH:MM', bo'sh bo'lsa yangi vazifa muddatsiz (due_date = null).
  due_time         text,
  is_active        boolean not null default true,
  -- Oxirgi marta shu sanada vazifa yaratilgan (dublikat oldini olish uchun).
  last_created_date date,
  created_at       timestamptz not null default now()
);
create index if not exists task_recurrences_active_idx on public.task_recurrences (is_active) where is_active;

alter table public.task_recurrences enable row level security;
revoke all on public.task_recurrences from anon, authenticated;

-- ── RPC'lar (faqat service_role, boshqa bot_* namunasida) ─────────────────

create or replace function public.bot_recurring_create(
  p_actor uuid, p_assigned uuid, p_title text, p_description text,
  p_priority text, p_freq text, p_weekdays text, p_due_time text
)
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
  if not public.is_staff_user(p_assigned) then
    raise exception 'assignee is not staff' using errcode = '22023';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title required' using errcode = '22023';
  end if;
  if p_freq not in ('daily', 'weekly') then
    raise exception 'bad freq' using errcode = '22023';
  end if;
  if p_freq = 'weekly' and coalesce(trim(p_weekdays), '') = '' then
    raise exception 'weekdays required' using errcode = '22023';
  end if;
  if p_due_time is not null and p_due_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'bad due_time' using errcode = '22023';
  end if;

  insert into public.task_recurrences (title, description, assigned_to, created_by, priority, freq, weekdays, due_time)
  values (
    left(trim(p_title), 200), nullif(trim(coalesce(p_description, '')), ''), p_assigned, p_actor,
    case when p_priority in ('urgent', 'high', 'normal', 'low') then p_priority else 'normal' end,
    p_freq,
    case when p_freq = 'weekly' then regexp_replace(trim(p_weekdays), '\s+', '', 'g') else null end,
    nullif(trim(coalesce(p_due_time, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.bot_recurring_list(p_actor uuid)
returns table (
  id uuid, title text, assigned_to uuid, assignee_name text,
  priority text, freq text, weekdays text, due_time text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.assigned_to, coalesce(nullif(trim(p.full_name), ''), '—'),
         r.priority, r.freq, r.weekdays, r.due_time
  from public.task_recurrences r
  left join public.profiles p on p.user_id = r.assigned_to
  where r.is_active and (r.created_by = p_actor or r.assigned_to = p_actor)
  order by r.created_at desc;
$$;

create or replace function public.bot_recurring_cancel(p_actor uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from public.task_recurrences where id = p_id and is_active;
  if not found then
    return false;
  end if;
  if not (r.created_by = p_actor or public.has_role(p_actor, 'owner'::public.app_role)) then
    return false;
  end if;
  update public.task_recurrences set is_active = false where id = p_id;
  return true;
end;
$$;

-- Bugungi (yoki berilgan) Toshkent sanasiga mos faol yozuvlar uchun tasks'ga yangi qator. Nechta
-- yaratilganini qaytaradi. tasks INSERT mavjud trg_task_events orqali avtomatik task_events'ga yoziladi.
create or replace function public.bot_recurring_run(p_today date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Tashkent')::date);
  v_dow int := extract(isodow from v_today)::int; -- 1=Du ... 7=Yak
  r record;
  v_due timestamptz;
  v_n int := 0;
begin
  for r in
    select * from public.task_recurrences
    where is_active
      and (last_created_date is null or last_created_date <> v_today)
      and (
        freq = 'daily'
        or (freq = 'weekly' and string_to_array(coalesce(weekdays, ''), ',') @> array[v_dow::text])
      )
  loop
    v_due := null;
    if r.due_time is not null then
      v_due := (v_today::text || ' ' || r.due_time)::timestamp at time zone 'Asia/Tashkent';
    end if;

    perform set_config('app.task_via', 'cron', true);
    perform set_config('app.task_actor', coalesce(r.created_by::text, ''), true);

    insert into public.tasks (title, description, priority, status, due_date, assigned_to, created_by, source)
    values (r.title, r.description, r.priority, 'todo', v_due, r.assigned_to,
            coalesce(r.created_by, r.assigned_to), 'telegram');

    perform set_config('app.task_via', '', true);
    perform set_config('app.task_actor', '', true);

    update public.task_recurrences set last_created_date = v_today where id = r.id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke all on function public.bot_recurring_create(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.bot_recurring_list(uuid) from public, anon, authenticated;
revoke all on function public.bot_recurring_cancel(uuid, uuid) from public, anon, authenticated;
revoke all on function public.bot_recurring_run(date) from public, anon, authenticated;
grant execute on function public.bot_recurring_create(uuid, uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.bot_recurring_list(uuid) to service_role;
grant execute on function public.bot_recurring_cancel(uuid, uuid) to service_role;
grant execute on function public.bot_recurring_run(date) to service_role;

-- ── cron: har kuni ertalab 07:00 Toshkent (02:00 UTC) ──────────────────────

select cron.unschedule('staff-bot-recurring') where exists (
  select 1 from cron.job where jobname = 'staff-bot-recurring'
);

select cron.schedule(
  'staff-bot-recurring',
  '0 2 * * *',
  $c$
    select net.http_post(
      url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=recurring',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey',
        (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $c$
);
