-- Xodim boti (staff-bot) poydevori — reja: claude/xodim-boti-reja.md, PR-1.
--
-- Nima qo'shiladi:
--   staff_telegram_links   xodim ↔ Telegram akkaunti (bitta xodim — bitta Telegram)
--   staff_link_codes       CRM'dan beriladigan bir martalik ulash kodi (15 daqiqa)
--   bot_settings           bot sozlamalari (vaqtlar, guruh, siyosat)
--   bot_state              DM'dagi ko'p bosqichli oqim holati
--   telegram_updates_seen  Telegram takror yuborgan update'larni tashlab yuborish
--   task_events            vazifa o'zgarishlari jurnali (CRM, bot, cron — hammasi)
-- va RPC'lar: CRM uchun staff_telegram_link_code / staff_telegram_unlink,
-- bot uchun (faqat service_role) bot_link_telegram / bot_resolve_staff.

-- ---------------------------------------------------------------- jadvallar

create table if not exists public.staff_telegram_links (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id bigint not null,
  username         text,
  first_name       text,
  dm_chat_id       bigint,
  linked_at        timestamptz not null default now(),
  linked_via       text not null default 'deep_link',
  is_active        boolean not null default true,
  unlinked_at      timestamptz
);
-- Bitta Telegram akkaunti bir vaqtda faqat bitta faol xodimga.
create unique index if not exists staff_telegram_links_active_tg_idx
  on public.staff_telegram_links (telegram_user_id) where is_active;

create table if not exists public.staff_link_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists staff_link_codes_user_idx on public.staff_link_codes (user_id);

create table if not exists public.bot_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.bot_settings (key, value) values
  ('bot_username', ''),            -- setup paytida getMe'dan yoziladi
  ('group_chat_id', ''),           -- bot qo'shilgan birinchi guruh
  ('report_time', '17:00'),
  ('reminder_times', '17:30,18:00'),
  ('digest_time', '18:15'),
  ('morning_time', '09:00'),
  ('workdays', '1,2,3,4,5,6'),     -- ISO: 1 = dushanba
  ('auto_create_policy', 'confirm'),
  ('group_retention_days', '90'),
  ('digest_user_ids', '')
on conflict (key) do nothing;

create table if not exists public.bot_state (
  telegram_user_id bigint primary key,
  state            jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

create table if not exists public.telegram_updates_seen (
  bot       text not null,
  update_id bigint not null,
  seen_at   timestamptz not null default now(),
  primary key (bot, update_id)
);

create table if not exists public.task_events (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  kind          text not null check (kind in ('created','status','assignee','due','priority','title','comment','reminder','notified')),
  via           text not null default 'system' check (via in ('crm','dm','group','cron','system')),
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists task_events_task_idx on public.task_events (task_id, created_at);

-- ---------------------------------------------------------------- RLS

alter table public.staff_telegram_links  enable row level security;
alter table public.staff_link_codes      enable row level security;
alter table public.bot_settings          enable row level security;
alter table public.bot_state             enable row level security;
alter table public.telegram_updates_seen enable row level security;
alter table public.task_events           enable row level security;

-- Ulanish holati: o'zi, owner va admin ko'radi. Yozish faqat RPC/service orqali.
drop policy if exists staff_telegram_links_select on public.staff_telegram_links;
create policy staff_telegram_links_select on public.staff_telegram_links
  for select to authenticated
  using (user_id = (select auth.uid())
         or public.has_role((select auth.uid()), 'owner'::public.app_role)
         or public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists staff_link_codes_select on public.staff_link_codes;
create policy staff_link_codes_select on public.staff_link_codes
  for select to authenticated
  using (user_id = (select auth.uid())
         or public.has_role((select auth.uid()), 'owner'::public.app_role)
         or public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Sozlamalar: xodimlar o'qiydi, faqat owner o'zgartiradi.
drop policy if exists bot_settings_select on public.bot_settings;
create policy bot_settings_select on public.bot_settings
  for select to authenticated using (public.is_non_investor_staff());
drop policy if exists bot_settings_update on public.bot_settings;
create policy bot_settings_update on public.bot_settings
  for update to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- Voqealar: vazifani ko'ra oladigan (tasks RLS) hamma ko'radi; yozish faqat trigger/service.
drop policy if exists task_events_select on public.task_events;
create policy task_events_select on public.task_events
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_events.task_id));

-- bot_state va telegram_updates_seen: siyosat yo'q — faqat service_role.

-- ---------------------------------------------------------------- vazifa voqealari triggeri
-- Bot va cron RPC orqali yozganda `app.task_via` / `app.task_actor` ni o'rnatadi;
-- CRM'dan to'g'ridan-to'g'ri yozilsa via='crm', aktor auth.uid().

create or replace function public.fn_task_events_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_via   text := coalesce(nullif(current_setting('app.task_via', true), ''),
                           case when auth.uid() is null then 'system' else 'crm' end);
  v_actor uuid := coalesce(nullif(current_setting('app.task_actor', true), '')::uuid, auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (new.id, coalesce(v_actor, new.created_by), 'created', v_via,
            jsonb_build_object('title', new.title, 'assigned_to', new.assigned_to,
                               'due_date', new.due_date, 'priority', new.priority,
                               'status', new.status, 'source', new.source));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (new.id, v_actor, 'status', v_via, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (new.id, v_actor, 'assignee', v_via, jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (new.id, v_actor, 'due', v_via, jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (new.id, v_actor, 'priority', v_via, jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.title is distinct from old.title then
    insert into public.task_events (task_id, actor_user_id, kind, via, payload)
    values (new.id, v_actor, 'title', v_via, jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_events on public.tasks;
create trigger trg_task_events
  after insert or update of status, assigned_to, due_date, priority, title
  on public.tasks
  for each row execute function public.fn_task_events_log();

-- ---------------------------------------------------------------- yordamchi

-- Xodim rollari (talaba va investor emas).
create or replace function public.is_staff_user(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_uid
      and role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  );
$$;

-- 10 belgili kod: o'xshash harflar (0/O, 1/I/L) yo'q; Telegram start parametriga mos.
create or replace function public.staff_link_code_gen()
returns text
language sql
volatile
set search_path = public
as $$
  with b as (select extensions.gen_random_bytes(10) as r)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b.r, i) % 31), 1), '' order by i)
  from b, generate_series(0, 9) as i;
$$;

-- ---------------------------------------------------------------- CRM uchun RPC

-- Ulash havolasi: o'ziga — har kim; boshqaga — owner/admin. Eski ishlatilmagan kodlar bekor bo'ladi.
create or replace function public.staff_telegram_link_code(p_user_id uuid default auth.uid())
returns table (code text, deep_link text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_caller uuid := auth.uid();
  v_code   text;
  v_bot    text;
  v_exp    timestamptz := now() + interval '15 minutes';
begin
  if v_caller is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if p_user_id is distinct from v_caller
     and not (public.has_role(v_caller, 'owner'::public.app_role) or public.has_role(v_caller, 'admin'::public.app_role)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not public.is_staff_user(p_user_id) then
    raise exception 'not a staff account' using errcode = '22023';
  end if;

  select value into v_bot from public.bot_settings where key = 'bot_username';

  update public.staff_link_codes
     set expires_at = now()
   where user_id = p_user_id and used_at is null and staff_link_codes.expires_at > now();

  loop
    v_code := public.staff_link_code_gen();
    begin
      insert into public.staff_link_codes (code, user_id, created_by, expires_at)
      values (v_code, p_user_id, v_caller, v_exp);
      exit;
    exception when unique_violation then
      null; -- juda kam; qayta urinadi
    end;
  end loop;

  return query
    select v_code,
           case when coalesce(v_bot, '') = '' then null
                else 'https://t.me/' || v_bot || '?start=' || v_code end,
           v_exp;
end;
$$;

-- Uzish: o'zi, owner yoki admin. Bot shu zahoti javob bermay qo'yadi.
create or replace function public.staff_telegram_unlink(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_tg     bigint;
begin
  if v_caller is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if p_user_id is distinct from v_caller
     and not (public.has_role(v_caller, 'owner'::public.app_role) or public.has_role(v_caller, 'admin'::public.app_role)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.staff_telegram_links
     set is_active = false, unlinked_at = now()
   where user_id = p_user_id and is_active
   returning telegram_user_id into v_tg;

  if v_tg is not null then
    delete from public.bot_state where telegram_user_id = v_tg;
    update public.staff_link_codes set expires_at = now()
     where user_id = p_user_id and used_at is null and expires_at > now();
    return true;
  end if;
  return false;
end;
$$;

-- CRM Xodimlar sahifasi uchun holat (RLS so'rovchi nomidan).
create or replace view public.v_staff_telegram
with (security_invoker = true) as
select
  ur.user_id,
  l.telegram_user_id,
  l.username,
  l.first_name,
  l.linked_at,
  coalesce(l.is_active, false) as is_linked,
  (select max(c.expires_at) from public.staff_link_codes c
    where c.user_id = ur.user_id and c.used_at is null and c.expires_at > now()) as pending_code_expires_at
from (select distinct user_id from public.user_roles
       where role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')) ur
left join public.staff_telegram_links l on l.user_id = ur.user_id;

-- ---------------------------------------------------------------- bot uchun RPC (faqat service_role)

-- Deep link kodi bilan ulash. Natija: linked | invalid | expired | used | not_staff | tg_taken
create or replace function public.bot_link_telegram(
  p_code text, p_telegram_user_id bigint, p_username text, p_first_name text, p_dm_chat_id bigint)
returns table (status text, user_id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r record;
begin
  select c.* into r from public.staff_link_codes c where c.code = upper(trim(p_code));
  if not found then
    return query select 'invalid'::text, null::uuid, null::text; return;
  end if;
  if r.used_at is not null then
    return query select 'used'::text, null::uuid, null::text; return;
  end if;
  if r.expires_at <= now() then
    return query select 'expired'::text, null::uuid, null::text; return;
  end if;
  if not public.is_staff_user(r.user_id) then
    return query select 'not_staff'::text, null::uuid, null::text; return;
  end if;
  if exists (select 1 from public.staff_telegram_links l
              where l.telegram_user_id = p_telegram_user_id and l.is_active and l.user_id <> r.user_id) then
    return query select 'tg_taken'::text, null::uuid, null::text; return;
  end if;

  update public.staff_link_codes set used_at = now() where code = r.code;

  insert into public.staff_telegram_links (user_id, telegram_user_id, username, first_name, dm_chat_id, linked_via)
  values (r.user_id, p_telegram_user_id, p_username, p_first_name, p_dm_chat_id, 'deep_link')
  on conflict (user_id) do update
    set telegram_user_id = excluded.telegram_user_id,
        username = excluded.username,
        first_name = excluded.first_name,
        dm_chat_id = excluded.dm_chat_id,
        linked_at = now(),
        linked_via = 'deep_link',
        is_active = true,
        unlinked_at = null;

  delete from public.bot_state where telegram_user_id = p_telegram_user_id;

  return query
    select 'linked'::text, r.user_id, coalesce(p.full_name, '') from public.profiles p where p.user_id = r.user_id
    union all
    select 'linked'::text, r.user_id, ''::text where not exists (select 1 from public.profiles p where p.user_id = r.user_id);
end;
$$;

-- Telegram id → xodim (faol ulanish va xodim roli bo'lsa).
create or replace function public.bot_resolve_staff(p_telegram_user_id bigint)
returns table (user_id uuid, full_name text, roles text[], dm_chat_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id,
         coalesce(p.full_name, ''),
         (select coalesce(array_agg(ur.role::text order by ur.role::text), '{}') from public.user_roles ur where ur.user_id = l.user_id),
         l.dm_chat_id
  from public.staff_telegram_links l
  left join public.profiles p on p.user_id = l.user_id
  where l.telegram_user_id = p_telegram_user_id
    and l.is_active
    and public.is_staff_user(l.user_id);
$$;

revoke all on function public.bot_link_telegram(text, bigint, text, text, bigint) from public, anon, authenticated;
revoke all on function public.bot_resolve_staff(bigint) from public, anon, authenticated;
revoke all on function public.staff_link_code_gen() from public, anon, authenticated;
grant execute on function public.bot_link_telegram(text, bigint, text, text, bigint) to service_role;
grant execute on function public.bot_resolve_staff(bigint) to service_role;
grant execute on function public.staff_telegram_link_code(uuid) to authenticated;
grant execute on function public.staff_telegram_unlink(uuid) to authenticated;
grant execute on function public.is_staff_user(uuid) to authenticated, service_role;
grant select on public.v_staff_telegram to authenticated;
