-- Xodim boti 2.0, 1-bosqich (B1-1, B1-2): to'liq bildirishnomalar va muddat nazorati.
--
-- B1-1. Vazifa CRM'da berilsa/o'zgarsa ham kerakli odam Telegram'da xabar oladi.
--   task_events (trg_task_events yozadi) → trigger trg_task_events_notify → bot_notifications (outbox)
--   → shu zahoti net.http_post(staff-bot?action=notify); zaxira — cron staff-bot-notify.
--   Qoidalar (actor — o'zgartirgan odam; unga xabar bormaydi):
--     created  via crm            → mas'ul
--     assignee via crm            → yangi mas'ul («sizga biriktirildi») va eski mas'ul («sizdan olindi»)
--     status → in_progress (dm|group|crm) → beruvchi (created_by)
--     status → completed via crm  → beruvchi   (DM/guruhda yopilgani index.ts'da darhol yoziladi — takror yo'q)
--     status → cancelled via crm  → mas'ul
--     due      via crm            → mas'ul
--   via = system (Orbit importi va h.k.) va cron — HECH QACHON xabar emas. Test akkaunt
--   (fn_is_demo_user — oluvchi ham, o'zgartirgan ham) va xodim bo'lmagan oluvchi o'tkazib yuboriladi.
--   Bitta saqlashda (tranzaksiya) bitta vazifa bo'yicha bitta odamga bitta xabar
--   (masalan, mas'ul + muddat birga o'zgarsa — faqat «sizga biriktirildi»).
--   Trigger xatosi vazifani saqlashni hech qachon buzmaydi (warning bilan o'tib ketadi).
--
-- B1-2. Muddat nazorati: cron staff-bot-deadlines → staff-bot?action=deadlines (notify.ts):
--   due_soon (soati qo'yilgan, 60 daqiqa qoldi) → mas'ul; overdue → mas'ul va beruvchi;
--   escalation (2 kundan ortiq kechikdi, D6) → ownerlarga (bot_owner_chats) bitta yig'ma xabar.
--   Takror yo'q: task_reminders (task_id, kind, due_date) — muddat o'zgarsa yana ishlaydi.
--   Muddati o'tib bo'lgandan keyin yaratilgan vazifaga (eski sana bilan kiritilgan) «muddat o'tdi» yuborilmaydi;
--   escalation esa max(muddat, yaratilgan vaqt) + 2 kundan keyin.
--
-- Tungi soatlar 22:00–08:00 (Toshkent): xabar yuborilmaydi — cron'lar faqat 08:00–21:55 ishlaydi,
-- funksiya ham tunda navbatni ushlab turadi; ertalab birinchi chaqiruv yuboradi.
--
-- BOSHLANG'ICH BELGILASH: prod'da Orbit'dan ko'chirilgan, 100 kundan ortiq kechikkan eski vazifalar bor.
-- Birinchi ishga tushishda ular bo'yicha birdaniga xabar ketmasligi uchun migratsiya paytida allaqachon
-- kechikkan ochiq vazifalar task_reminders'ga overdue va escalation «yuborilgan» deb yoziladi
-- (note = 'baseline'). Faqat bundan keyin kechikadiganlar xabar oladi. Muddati keyin o'zgartirilsa —
-- yangi muddat bo'yicha odatdagidek ishlaydi.
--
-- Joylash tartibi: staff-bot funksiyasi (notify.ts bilan) avval joylansa yaxshi. Aks holda eski funksiya
-- ?action=notify|deadlines ga 403 qaytaradi (zararsiz), xabarlar navbatda kutadi; 24 soatdan eskisi
-- yuborilmaydi (stale).

-- ---------------------------------------------------------------- jadvallar

create table if not exists public.bot_notifications (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  event_id   uuid not null references public.task_events(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('created', 'assigned', 'unassigned', 'started', 'completed', 'cancelled', 'due_changed')),
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  error      text,
  attempts   integer not null default 0,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (event_id, recipient)
);
create index if not exists bot_notifications_pending_idx on public.bot_notifications (created_at) where status = 'pending';
create index if not exists bot_notifications_task_idx on public.bot_notifications (task_id, recipient);

create table if not exists public.task_reminders (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  kind     text not null check (kind in ('due_soon', 'overdue', 'escalation')),
  due_date timestamptz not null,
  sent_at  timestamptz not null default now(),
  note     text,  -- 'baseline' — migratsiyada belgilangan, aslida yuborilmagan
  primary key (task_id, kind, due_date)
);

-- Siyosat yo'q — faqat service_role (staff-bot).
alter table public.bot_notifications enable row level security;
alter table public.task_reminders enable row level security;
revoke all on table public.bot_notifications from anon, authenticated;
revoke all on table public.task_reminders from anon, authenticated;

-- ---------------------------------------------------------------- darhol yuborish

-- staff-bot?action=notify ni chaqiradi (bitta tranzaksiyada bir marta). Xato bo'lsa — warning,
-- xabar navbatda qoladi va zaxira cron yuboradi.
create or replace function public.bot_notify_kick()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.bot_notify_kicked', true), '') = '1' then
    return;
  end if;
  perform net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
  perform set_config('app.bot_notify_kicked', '1', true);
exception when others then
  raise warning 'bot_notify_kick: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------- task_events → navbat

create or replace function public.fn_task_events_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks%rowtype;
  v_open boolean;
  v_to text := new.payload->>'to';
  r uuid[] := '{}';
  k text[] := '{}';
  n integer := 0;
begin
  -- Tizim (Orbit importi va h.k.) va cron yozuvlari — hech qachon xabar emas.
  if new.via not in ('crm', 'dm', 'group') then
    return null;
  end if;
  -- Test akkaunt o'zgartirgan bo'lsa ham — xabar yo'q.
  if new.actor_user_id is not null and public.fn_is_demo_user(new.actor_user_id) then
    return null;
  end if;
  select * into t from public.tasks where id = new.task_id;
  if not found then
    return null;
  end if;
  v_open := t.status in ('todo', 'in_progress');

  if new.kind = 'created' then
    if new.via = 'crm' and v_open then
      r := r || t.assigned_to; k := k || 'created'::text;
    end if;
  elsif new.kind = 'assignee' then
    if new.via = 'crm' and v_open then
      r := r || nullif(v_to, '')::uuid || nullif(new.payload->>'from', '')::uuid;
      k := k || array['assigned', 'unassigned'];
    end if;
  elsif new.kind = 'status' then
    if v_to = 'in_progress' then
      r := r || t.created_by; k := k || 'started'::text;
    elsif v_to = 'completed' and new.via = 'crm' then
      r := r || t.created_by; k := k || 'completed'::text;
    elsif v_to = 'cancelled' and new.via = 'crm' then
      r := r || t.assigned_to; k := k || 'cancelled'::text;
    end if;
  elsif new.kind = 'due' then
    if new.via = 'crm' and v_open then
      r := r || t.assigned_to; k := k || 'due_changed'::text;
    end if;
  end if;

  if cardinality(k) = 0 then
    return null;
  end if;

  insert into public.bot_notifications (task_id, event_id, recipient, kind, payload)
  select new.task_id, new.id, c.recipient, c.kind,
         new.payload || jsonb_build_object('actor', new.actor_user_id, 'via', new.via)
    from unnest(r, k) as c(recipient, kind)
   where c.recipient is not null
     and c.recipient is distinct from new.actor_user_id
     and public.is_staff_user(c.recipient)
     and not public.fn_is_demo_user(c.recipient)
     -- bitta saqlash (tranzaksiya) — bitta vazifa bo'yicha bitta odamga bitta xabar
     and not exists (select 1 from public.bot_notifications b
                      where b.task_id = new.task_id and b.recipient = c.recipient and b.created_at = now())
  on conflict (event_id, recipient) do nothing;
  get diagnostics n = row_count;

  if n > 0 then
    perform public.bot_notify_kick();
  end if;
  return null;
exception when others then
  -- Bildirishnoma xatosi vazifani saqlashni buzmasin.
  raise warning 'fn_task_events_notify(%): %', new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_task_events_notify on public.task_events;
create trigger trg_task_events_notify
  after insert on public.task_events
  for each row execute function public.fn_task_events_notify();

-- ---------------------------------------------------------------- bot RPC'lari (faqat service_role)

-- Navbatdan yuboriladiganlarni band qilish (parallel chaqiruvlar bir-birini kutmaydi va takrorlamaydi).
-- Band qilingan, lekin 5 daqiqada yakunlanmagan xabar qayta olinadi; 5 urinishdan keyin — failed.
create or replace function public.bot_notify_claim(p_limit integer default 50)
returns table (
  id uuid, kind text, recipient uuid, payload jsonb, created_at timestamptz, attempts integer,
  dm_chat_id bigint,
  task_id uuid, title text, status text, priority text, due_date timestamptz,
  assigned_to uuid, created_by uuid,
  actor_name text, assignee_name text, from_name text, to_name text)
language sql
security definer
set search_path = public
as $$
  update public.bot_notifications
     set status = 'failed', error = coalesce(error, 'too many attempts'), claimed_at = null
   where status = 'pending' and attempts >= 5;

  with c as (
    select n.id
      from public.bot_notifications n
     where n.status = 'pending'
       and (n.claimed_at is null or n.claimed_at < now() - interval '5 minutes')
     order by n.created_at
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
     for update skip locked
  ), u as (
    update public.bot_notifications n
       set claimed_at = now(), attempts = n.attempts + 1
      from c
     where n.id = c.id
    returning n.id, n.kind, n.recipient, n.payload, n.created_at, n.attempts, n.task_id
  )
  select u.id, u.kind, u.recipient, u.payload, u.created_at, u.attempts,
         l.dm_chat_id,
         t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, t.created_by,
         nullif(trim(pa.full_name), ''), nullif(trim(pt.full_name), ''),
         nullif(trim(pf.full_name), ''), nullif(trim(pn.full_name), '')
    from u
    join public.tasks t on t.id = u.task_id
    left join public.staff_telegram_links l on l.user_id = u.recipient and l.is_active
    left join public.profiles pa on pa.user_id = nullif(u.payload->>'actor', '')::uuid
    left join public.profiles pt on pt.user_id = t.assigned_to
    left join public.profiles pf on pf.user_id = case when u.kind in ('assigned', 'unassigned')
                                                      then nullif(u.payload->>'from', '')::uuid end
    left join public.profiles pn on pn.user_id = case when u.kind in ('assigned', 'unassigned')
                                                      then nullif(u.payload->>'to', '')::uuid end
   order by u.created_at;
$$;

-- Muddat nazorati uchun nomzodlar: ochiq, muddati o'tgan yoki 60 daqiqa ichida keladigan vazifalar.
-- Qaysi eslatma kerakligini notify.ts hal qiladi (dueReminders); sent — shu muddat uchun yozilganlari.
-- Test akkauntga biriktirilgan vazifalar kirmaydi.
create or replace function public.bot_deadline_candidates(p_now timestamptz default now())
returns table (
  id uuid, title text, status text, priority text, due_date timestamptz,
  assigned_to uuid, created_by uuid,
  assignee_name text, assignee_chat bigint, assignee_ok boolean,
  creator_name text, creator_chat bigint, creator_ok boolean,
  created_at timestamptz, sent text[])
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, t.created_by,
         nullif(trim(pa.full_name), ''), la.dm_chat_id,
         t.assigned_to is not null and public.is_staff_user(t.assigned_to),
         nullif(trim(pc.full_name), ''), lc.dm_chat_id,
         public.is_staff_user(t.created_by) and not public.fn_is_demo_user(t.created_by),
         t.created_at,
         coalesce((select array_agg(r.kind order by r.kind)
                     from public.task_reminders r
                    where r.task_id = t.id and r.due_date = t.due_date), '{}'::text[])
    from public.tasks t
    left join public.profiles pa on pa.user_id = t.assigned_to
    left join public.profiles pc on pc.user_id = t.created_by
    left join public.staff_telegram_links la on la.user_id = t.assigned_to and la.is_active
    left join public.staff_telegram_links lc on lc.user_id = t.created_by and lc.is_active
   where t.status in ('todo', 'in_progress')
     and t.due_date is not null
     and t.due_date <= p_now + interval '60 minutes'
     and (t.assigned_to is null or not public.fn_is_demo_user(t.assigned_to))
   order by t.due_date
   limit 500;
$$;

revoke all on function public.bot_notify_kick() from public, anon, authenticated;
revoke all on function public.fn_task_events_notify() from public, anon, authenticated;
revoke all on function public.bot_notify_claim(integer) from public, anon, authenticated;
revoke all on function public.bot_deadline_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.bot_notify_claim(integer) to service_role;
grant execute on function public.bot_deadline_candidates(timestamptz) to service_role;

-- ---------------------------------------------------------------- boshlang'ich belgilash

-- Hozir allaqachon kechikkan ochiq vazifalar: overdue va escalation «yuborilgan» (xabar ketmaydi).
-- Kechikish qoidasi notify.ts overdueAt bilan bir xil: soatli — muddatning o'zi; faqat sana
-- (00:00 UTC yoki 00:00 Toshkent) — o'sha Toshkent kunining oxiri.
insert into public.task_reminders (task_id, kind, due_date, note)
select t.id, k.kind, t.due_date, 'baseline'
  from public.tasks t
 cross join (values ('overdue'), ('escalation')) as k(kind)
 where t.status in ('todo', 'in_progress')
   and t.due_date is not null
   and now() >= case
         when (t.due_date at time zone 'UTC')::time = time '00:00'
           or (t.due_date at time zone 'Asia/Tashkent')::time = time '00:00'
         then (((t.due_date at time zone 'Asia/Tashkent')::date + 1)::timestamp at time zone 'Asia/Tashkent')
         else t.due_date
       end
on conflict do nothing;

-- ---------------------------------------------------------------- cron (UTC; Toshkent = UTC+5)

-- Zaxira: navbat har 5 daqiqada, 08:00–21:55 Toshkent (asosiy yo'l — trigger darhol chaqiradi).
select cron.unschedule('staff-bot-notify') where exists (select 1 from cron.job where jobname = 'staff-bot-notify');
select cron.schedule('staff-bot-notify', '*/5 3-16 * * *', $c$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$c$);

-- Muddat nazorati: har 15 daqiqada, 08:00–21:45 Toshkent.
select cron.unschedule('staff-bot-deadlines') where exists (select 1 from cron.job where jobname = 'staff-bot-deadlines');
select cron.schedule('staff-bot-deadlines', '*/15 3-16 * * *', $c$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$c$);
