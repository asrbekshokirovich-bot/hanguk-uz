-- Xodim boti 2.0, 0-bosqich (reja B0-2, B0-3, B0-5): AI jurnali, qayta urinish navbati, AI holati.
--
-- Muammo (prod loglari, 05.11): 24 soatda guruh tahlili 26 marta urinilgan, 13 tasi yo'qolgan —
-- Gemini 429/503, Claude 400 (temperature, #574 da tuzatilgan). Muvaffaqiyatsiz AI ishi qayta
-- urinilmas va hech kimga ko'rinmas edi.
--
--   bot_settings.ai_provider_order  provayder tartibi, standart «claude,gemini» (D1). UI'da yo'q,
--                                   kerak bo'lsa bazada o'zgartiriladi.
--   ai_calls     har AI urinishi: maqsad (group_analysis, report_split, ...), provayder, model, ok,
--                HTTP status, qisqa xato, vaqt, token, narx (Claude — rasmiy narx; Gemini — null).
--                staff-bot service_role bilan yozadi, faqat owner o'qiydi. 90 kun saqlanadi.
--   bot_jobs     provayderlar xatosi tufayli natija olinmagan ish (navbatga 5 daqiqadan keyin muddat bilan
--                tushadi). Cron `staff-bot-jobs` har 5 daqiqada `?action=jobs` chaqiradi: muddati kelgan ish
--                qayta bajariladi (attempts+1); xato → run_after +5 daqiqa; 3-xatodan keyin failed va
--                ownerlarga ogohlantirish.
--   bot_alerts   oxirgi AI ogohlantirishi vaqti (soatiga ko'pi bilan 1 ta).
--
--   RPC (faqat service_role): bot_job_enqueue, bot_job_claim, bot_job_finish, bot_report_apply_split,
--                             bot_ai_stats, bot_ai_alert_state, bot_ai_alert_claim, bot_ai_retention.
--   RPC (owner, CRM → Sozlamalar → Bot → «AI holati»): bot_ai_health.

insert into public.bot_settings (key, value) values ('ai_provider_order', 'claude,gemini')
on conflict (key) do nothing;

-- ── navbat ────────────────────────────────────────────────────────────────

create table if not exists public.bot_jobs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind ~ '^[a-z][a-z0-9_]{2,39}$'),
  -- bitta ish uchun bitta kutilayotgan qator (masalan «ga:<chat>:<xabar>», «rs:<hisobot id>»)
  dedupe_key  text,
  payload     jsonb not null default '{}'::jsonb,
  attempts    integer not null default 0,
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  run_after   timestamptz not null default now(),
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists bot_jobs_pending_key on public.bot_jobs (dedupe_key) where status = 'pending';
create index if not exists bot_jobs_due_idx on public.bot_jobs (run_after) where status = 'pending';
create index if not exists bot_jobs_updated_idx on public.bot_jobs (updated_at desc);

alter table public.bot_jobs enable row level security;
-- siyosat yo'q — faqat service_role (payload'da xabar/hisobot matni bor); CRM sonini bot_ai_health'dan oladi

-- ── AI jurnali ────────────────────────────────────────────────────────────

create table if not exists public.ai_calls (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  source        text not null default 'staff-bot',
  purpose       text not null check (purpose ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider      text not null,
  model         text,
  -- 1 — birinchi urinish, 2 — 429/503/529 dan keyingi qayta urinish
  attempt       smallint not null default 1,
  ok            boolean not null,
  http_status   integer,
  error         text,
  latency_ms    integer,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(12, 6),
  -- navbatdan bajarilgan bo'lsa
  job_id        uuid references public.bot_jobs(id) on delete set null
);
create index if not exists ai_calls_created_idx on public.ai_calls (created_at desc);

alter table public.ai_calls enable row level security;
drop policy if exists ai_calls_select on public.ai_calls;
create policy ai_calls_select on public.ai_calls
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- ── ogohlantirish vaqti ───────────────────────────────────────────────────

create table if not exists public.bot_alerts (
  kind    text primary key,
  sent_at timestamptz not null
);
alter table public.bot_alerts enable row level security;
-- siyosat yo'q — faqat service_role

-- ── navbat RPC'lari (service_role) ────────────────────────────────────────

-- Ishni navbatga qo'yish. Shu kalit bilan kutilayotgan ish bo'lsa — yangilanadi (urinishlar 0 dan).
create or replace function public.bot_job_enqueue(p_kind text, p_key text, p_payload jsonb, p_error text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.bot_jobs as j (kind, dedupe_key, payload, last_error, run_after)
  values (p_kind, nullif(trim(coalesce(p_key, '')), ''), coalesce(p_payload, '{}'::jsonb), left(p_error, 500),
          now() + interval '5 minutes')
  on conflict (dedupe_key) where status = 'pending'
  do update set payload = excluded.payload, last_error = excluded.last_error, attempts = 0,
                run_after = excluded.run_after, updated_at = now()
  returning j.id into v_id;
  return v_id;
end;
$$;

-- Muddati kelgan bitta ishni olish: urinish shu yerda sanaladi (attempts+1) va 10 daqiqalik «ijara»
-- qo'yiladi — parallel cron uni ikkinchi marta olmaydi. Jarayon uzilib qolsa (edge vaqt chegarasi),
-- ijara tugagach qayta olinadi; 3 urinishi ishlatib uzilgan ish failed bo'ladi (cheksiz aylanmaydi).
-- (3 — staff-bot/aiops.ts JOB_MAX_ATTEMPTS bilan bir xil.)
create or replace function public.bot_job_claim()
returns setof public.bot_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bot_jobs
     set status = 'failed', updated_at = now(),
         last_error = left(coalesce(last_error || ' · ', '') || 'jarayon uzildi', 500)
   where status = 'pending' and attempts >= 3 and run_after <= now();

  return query
  update public.bot_jobs j
     set attempts = j.attempts + 1, run_after = now() + interval '10 minutes', updated_at = now()
   where j.id = (select q.id from public.bot_jobs q
                  where q.status = 'pending' and q.run_after <= now()
                  order by q.run_after, q.created_at
                  limit 1
                  for update skip locked)
  returning j.*;
end;
$$;

-- Natija: muvaffaqiyat → done; xato → 5 daqiqadan keyin qayta; 3-urinish ham xato bo'lsa failed.
create or replace function public.bot_job_finish(p_id uuid, p_ok boolean, p_error text default null)
returns table (status text, attempts integer)
language sql
security definer
set search_path = public
as $$
  update public.bot_jobs j
     set status = case when p_ok then 'done' when j.attempts >= 3 then 'failed' else 'pending' end,
         run_after = case when p_ok or j.attempts >= 3 then j.run_after else now() + interval '5 minutes' end,
         last_error = case when p_ok then j.last_error else left(coalesce(p_error, 'xato'), 500) end,
         updated_at = now()
   where j.id = p_id and j.status = 'pending'
  returning j.status, j.attempts;
$$;

-- Navbatdan qayta ajratilgan hisobot: bot_save_report bilan bir xil tozalash (trim, bo'sh → null).
-- Faqat hisobot matni o'zgarmagan va hali ajratilmagan bo'lsa yoziladi (xodim qayta yuborgan bo'lsa tegilmaydi).
create or replace function public.bot_report_apply_split(
  p_report uuid, p_raw text, p_done text, p_blockers text, p_plan text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if coalesce(nullif(trim(coalesce(p_done, '')), ''), nullif(trim(coalesce(p_blockers, '')), ''),
              nullif(trim(coalesce(p_plan, '')), '')) is null then
    return false;
  end if;
  update public.daily_reports d
     set done = nullif(trim(coalesce(p_done, '')), ''),
         blockers = nullif(trim(coalesce(p_blockers, '')), ''),
         plan = nullif(trim(coalesce(p_plan, '')), ''),
         ai_parsed = true,
         updated_at = now()
   where d.id = p_report
     and d.raw_text = left(trim(coalesce(p_raw, '')), 8000)
     and not d.ai_parsed;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ── AI holati ─────────────────────────────────────────────────────────────

-- Oxirgi p_hours soat (1..2160): jami va maqsad/provayder kesimida chaqiruv, xato, o'rtacha ms,
-- token, narx; navbat (kutilmoqda — hammasi, bajarilmadi/bajarildi — shu davrda); oxirgi xato.
create or replace function public.bot_ai_stats(p_hours integer default 24)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with h as (
    select least(greatest(coalesce(p_hours, 24), 1), 24 * 90) as hours
  ), c as (
    select a.* from public.ai_calls a, h
     where a.created_at >= now() - make_interval(hours => h.hours)
  ), g as (
    select c.purpose, c.provider,
           count(*)::int as calls,
           (count(*) filter (where not c.ok))::int as errors,
           round(avg(c.latency_ms))::int as avg_ms,
           coalesce(sum(c.input_tokens), 0)::bigint as input_tokens,
           coalesce(sum(c.output_tokens), 0)::bigint as output_tokens,
           round(sum(c.cost_usd), 6) as cost_usd
      from c
     group by c.purpose, c.provider
  )
  select jsonb_build_object(
    'hours', h.hours,
    'calls', (select count(*) from c),
    'errors', (select count(*) from c where not c.ok),
    'avg_ms', (select round(avg(c.latency_ms))::int from c),
    'input_tokens', (select coalesce(sum(c.input_tokens), 0) from c),
    'output_tokens', (select coalesce(sum(c.output_tokens), 0) from c),
    'cost_usd', (select coalesce(round(sum(c.cost_usd), 6), 0) from c),
    'rows', coalesce((select jsonb_agg(to_jsonb(g) order by g.calls desc, g.purpose, g.provider) from g), '[]'::jsonb),
    'jobs', jsonb_build_object(
      'pending', (select count(*) from public.bot_jobs j where j.status = 'pending'),
      'failed', (select count(*) from public.bot_jobs j
                  where j.status = 'failed' and j.updated_at >= now() - make_interval(hours => h.hours)),
      'done', (select count(*) from public.bot_jobs j
                where j.status = 'done' and j.updated_at >= now() - make_interval(hours => h.hours))),
    'last_error', (select jsonb_build_object('at', x.created_at, 'purpose', x.purpose, 'provider', x.provider,
                                             'status', x.http_status, 'error', x.error)
                     from c x where not x.ok order by x.created_at desc limit 1))
  from h;
$$;

-- CRM kartasi uchun (faqat owner).
create or replace function public.bot_ai_health(p_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role((select auth.uid()), 'owner'::public.app_role) then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return public.bot_ai_stats(p_hours);
end;
$$;

-- Ogohlantirish uchun holat: oxirgi 60 daqiqadagi chaqiruv/xato, oxirgi ogohlantirishdan beri
-- (ko'pi bilan 24 soat) bajarilmay qolgan ishlar, oxirgi xato.
create or replace function public.bot_ai_alert_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with la as (
    select (select a.sent_at from public.bot_alerts a where a.kind = 'ai') as at
  ), c as (
    select x.ok from public.ai_calls x where x.created_at >= now() - interval '60 minutes'
  ), f as (
    select j.kind from public.bot_jobs j, la
     where j.status = 'failed'
       and j.updated_at > greatest(coalesce(la.at, '-infinity'::timestamptz), now() - interval '24 hours')
  )
  select jsonb_build_object(
    'last_alert_at', (select la.at from la),
    'calls', (select count(*) from c),
    'errors', (select count(*) from c where not c.ok),
    'failed_jobs', (select count(*) from f),
    'failed_kinds', coalesce((select jsonb_object_agg(k.kind, k.n)
                                from (select f.kind, count(*) as n from f group by f.kind) k), '{}'::jsonb),
    'last_error', (select jsonb_build_object('provider', x.provider, 'status', x.http_status, 'error', x.error,
                                             'at', x.created_at)
                     from public.ai_calls x
                    where not x.ok and x.created_at >= now() - interval '24 hours'
                    order by x.created_at desc limit 1));
$$;

-- Ogohlantirish yuborishga ruxsat: oxirgisidan 1 soat o'tgan bo'lsa true va vaqt belgilanadi (atomar).
create or replace function public.bot_ai_alert_claim()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bot_alerts as a (kind, sent_at) values ('ai', now())
  on conflict (kind) do update set sent_at = excluded.sent_at
   where a.sent_at < now() - interval '1 hour';
  return found;
end;
$$;

-- 90 kundan eski AI jurnali va yakunlangan ishlar.
create or replace function public.bot_ai_retention()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ai_calls where created_at < now() - interval '90 days';
  delete from public.bot_jobs where status in ('done', 'failed') and updated_at < now() - interval '90 days';
end;
$$;

revoke all on function public.bot_job_enqueue(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.bot_job_claim() from public, anon, authenticated;
revoke all on function public.bot_job_finish(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.bot_report_apply_split(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.bot_ai_stats(integer) from public, anon, authenticated;
revoke all on function public.bot_ai_alert_state() from public, anon, authenticated;
revoke all on function public.bot_ai_alert_claim() from public, anon, authenticated;
revoke all on function public.bot_ai_retention() from public, anon, authenticated;
grant execute on function public.bot_job_enqueue(text, text, jsonb, text) to service_role;
grant execute on function public.bot_job_claim() to service_role;
grant execute on function public.bot_job_finish(uuid, boolean, text) to service_role;
grant execute on function public.bot_report_apply_split(uuid, text, text, text, text) to service_role;
grant execute on function public.bot_ai_stats(integer) to service_role;
grant execute on function public.bot_ai_alert_state() to service_role;
grant execute on function public.bot_ai_alert_claim() to service_role;
grant execute on function public.bot_ai_retention() to service_role;
revoke all on function public.bot_ai_health(integer) from public, anon;
grant execute on function public.bot_ai_health(integer) to authenticated;

-- ── cron ──────────────────────────────────────────────────────────────────

-- Har 5 daqiqada: navbatdagi ishlar + AI holati ogohlantirishi (staff-bot ?action=jobs).
select cron.unschedule('staff-bot-jobs') where exists (select 1 from cron.job where jobname = 'staff-bot-jobs');
select cron.schedule('staff-bot-jobs', '*/5 * * * *', $c$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$c$);

-- Har kuni 02:40 (Toshkent): 90 kundan eski ai_calls va yakunlangan bot_jobs o'chiriladi.
select cron.unschedule('staff-bot-ai-retention') where exists (select 1 from cron.job where jobname = 'staff-bot-ai-retention');
select cron.schedule('staff-bot-ai-retention', '40 21 * * *', $c$ select public.bot_ai_retention() $c$);
