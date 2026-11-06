-- Xodim boti 2.0, 3-bosqich (reja B3-1, D8): kunlik guruh xulosasi.
--
-- Har ish kuni 21:30 (Toshkent) cron `staff-bot-group-summary` → staff-bot `?action=group_summary`:
-- o'sha kungi «Staff» guruhi xabarlari (matn, «🎤» ovoz transkripti, rasm izohi) AI qatlami orqali
-- (aiOps.structured, purpose 'group_summary') qisqa o'zbekcha xulosaga aylanadi va shu jadvalga yoziladi.
-- Dam olish kuni (bot_settings.workdays'da yo'q) — edge funksiya hech narsa qilmaydi.
-- Xabar 3 tadan kam bo'lsa — AI chaqirilmaydi, qator yozilmaydi.
-- Ertalabki 09:00 guruh digestida «💬 Kecha guruhda» bo'limi oxirgi ish kunining xulosasidan (D8).
--
--   group_daily_summaries  (chat_id, summary_date) bo'yicha bitta qator. summary — 3–6 band («• …», satrma-satr);
--                          topics / decisions / open_questions — matnlar massivi (jsonb). Yozish faqat
--                          service_role (staff-bot); o'qish — faqat owner (D3, Hanguk AI tool'i ham shu).
--   RPC (faqat service_role):
--     bot_group_day_messages(chat, date)  — o'sha kun (Toshkent) xabarlari: muallif nomi (ulangan xodim) yoki
--                                           «tashqi» (ulanmagan akkaunt); test akkauntlar (fn_is_demo_user) chiqarilgan.
--     bot_group_summary_save(...)         — upsert (qayta ishga tushirilsa yangilanadi).
--     bot_group_summary_get(chat, date)   — digest uchun bitta xulosa.
--   bot_settings.group_summary_enabled    — «false» bo'lsa xulosa yozilmaydi (standart true; UI'da hali yo'q).

-- ── jadval ────────────────────────────────────────────────────────────────

create table if not exists public.group_daily_summaries (
  chat_id         bigint not null,
  summary_date    date not null,
  summary         text not null,
  topics          jsonb not null default '[]',
  decisions       jsonb not null default '[]',
  open_questions  jsonb not null default '[]',
  message_count   int not null default 0,
  model           text,
  created_at      timestamptz not null default now(),
  primary key (chat_id, summary_date)
);

alter table public.group_daily_summaries enable row level security;
drop policy if exists group_daily_summaries_select on public.group_daily_summaries;
create policy group_daily_summaries_select on public.group_daily_summaries
  for select to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role));

revoke all on table public.group_daily_summaries from anon, authenticated;
grant select on table public.group_daily_summaries to authenticated;
grant all on table public.group_daily_summaries to service_role;

-- ── RPC ───────────────────────────────────────────────────────────────────

create or replace function public.bot_group_day_messages(p_chat bigint, p_date date)
returns table (message_id bigint, at timestamptz, author text, external boolean, text text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select m.message_id,
         m.created_at,
         case when m.user_id is null then 'tashqi'
              else coalesce(nullif(trim(p.full_name), ''), '—') end,
         m.user_id is null,
         m.text
    from public.staff_group_messages m
    left join public.profiles p on p.user_id = m.user_id
   where m.chat_id = p_chat
     and m.created_at >= (p_date::timestamp at time zone 'Asia/Tashkent')
     and m.created_at <  ((p_date + 1)::timestamp at time zone 'Asia/Tashkent')
     and nullif(trim(m.text), '') is not null
     and (m.user_id is null or not public.fn_is_demo_user(m.user_id))
   order by m.created_at, m.message_id
   limit 400;
$$;

create or replace function public.bot_group_summary_save(
  p_chat bigint, p_date date, p_summary text, p_topics jsonb, p_decisions jsonb,
  p_open_questions jsonb, p_message_count int, p_model text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.group_daily_summaries as g
    (chat_id, summary_date, summary, topics, decisions, open_questions, message_count, model)
  values (p_chat, p_date, p_summary, coalesce(p_topics, '[]'::jsonb), coalesce(p_decisions, '[]'::jsonb),
          coalesce(p_open_questions, '[]'::jsonb), coalesce(p_message_count, 0), p_model)
  on conflict (chat_id, summary_date) do update
    set summary = excluded.summary, topics = excluded.topics, decisions = excluded.decisions,
        open_questions = excluded.open_questions, message_count = excluded.message_count,
        model = excluded.model, created_at = now();
$$;

create or replace function public.bot_group_summary_get(p_chat bigint, p_date date)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object('summary', g.summary, 'decisions', g.decisions,
                            'open_questions', g.open_questions, 'message_count', g.message_count)
    from public.group_daily_summaries g
   where g.chat_id = p_chat and g.summary_date = p_date;
$$;

revoke all on function public.bot_group_day_messages(bigint, date) from public, anon, authenticated;
revoke all on function public.bot_group_summary_save(bigint, date, text, jsonb, jsonb, jsonb, int, text) from public, anon, authenticated;
revoke all on function public.bot_group_summary_get(bigint, date) from public, anon, authenticated;
grant execute on function public.bot_group_day_messages(bigint, date) to service_role;
grant execute on function public.bot_group_summary_save(bigint, date, text, jsonb, jsonb, jsonb, int, text) to service_role;
grant execute on function public.bot_group_summary_get(bigint, date) to service_role;

-- ── sozlama ───────────────────────────────────────────────────────────────

insert into public.bot_settings (key, value) values ('group_summary_enabled', 'true')
on conflict (key) do nothing;

-- ── cron ──────────────────────────────────────────────────────────────────

-- Har kuni 21:30 (Toshkent) = 16:30 UTC. Ish kuni tekshiruvi edge funksiyada (bot_settings.workdays),
-- shuning uchun jadval bot_apply_schedule'ga bog'liq emas. Xabar yuborilmaydi (faqat bazaga yozadi).
select cron.unschedule('staff-bot-group-summary') where exists (select 1 from cron.job where jobname = 'staff-bot-group-summary');
select cron.schedule('staff-bot-group-summary', '30 16 * * *', $c$
  select net.http_post(
    url := 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/staff-bot?action=group_summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$c$);
