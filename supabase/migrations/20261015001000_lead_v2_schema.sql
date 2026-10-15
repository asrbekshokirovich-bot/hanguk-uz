-- Lead module v2 (spec "HANGUK Lid bo'limi TT", 2026-10-05) — part 2 of 5: schema.
--
-- What this file does (spec §15):
--   * new columns on `leads` (stage, owner, the 10-minute timer, the call
--     ladder, waiting, lost, objections, referral, ad attribution, ...);
--   * new tables: lead_contacts, lead_events, call_attempts, lead_promises,
--     lead_drafts, social_comments, reactivation_queues, lead_settings,
--     lead_merge_suggestions, plus the view lead_identities;
--   * the settings seed (working hours, ladder, auto-reply, forbidden words,
--     lost reasons -> reactivation queues, allowed offers, templates);
--   * the pure helper functions (working hours, due time, ladder);
--   * row level security for the new visibility rules (spec §13):
--       operator          the pool (no owner) + own leads; Baza (old) read
--       lead_senior       everything
--       owner / admin     everything
--       document_handler  leads that became students
--
-- It does NOT change behaviour by itself: no trigger or job is installed here.
-- The state machine is 20261015002000_lead_v2_engine.sql; the old leads are
-- re-labelled by 20261015004000_lead_v2_migrate_old_leads.sql.
--
-- Spec deviations, on purpose:
--   * `stage` is text + CHECK rather than a Postgres enum: values can be
--     renamed without ALTER TYPE, and the rest of `leads` (status, source) is
--     text too.
--   * `lead_identities` is a VIEW over communication_identities, not a second
--     table: the spec says to extend the existing table, and two copies of an
--     identity would drift.
--   * the 5 mandatory fields are stored in existing columns: goal ->
--     education_level, certificate -> cert_level, age -> age (+ study_year),
--     region -> city, decider -> decider (new).

----------------------------------------------------------------------
-- 1. leads: new columns
----------------------------------------------------------------------

alter table public.leads
  add column if not exists stage text not null default 'new',
  -- 'old' = lived in the previous CRM (kept for before/after comparison);
  -- existing rows get 'old', everything inserted from now on is 'new'.
  add column if not exists crm_generation text not null default 'old',
  add column if not exists owner_id uuid references auth.users (id) on delete set null,

  -- the 10-minute rule
  add column if not exists first_contact_at timestamptz,
  add column if not exists timer_kind text,            -- first | reply | ladder | callback
  add column if not exists timer_start_at timestamptz, -- when the row shows in HOZIR
  add column if not exists due_at timestamptz,         -- the breach time
  add column if not exists last_escalated_at timestamptz,
  add column if not exists escalation_count integer not null default 0,
  add column if not exists last_client_msg_at timestamptz,
  add column if not exists answered_at timestamptz,
  add column if not exists answered_by uuid,
  add column if not exists answer_kind text,           -- call | call_attempt+chat | call_attempt | chat | comment

  -- the no-answer ladder
  add column if not exists attempt_no integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists ladder_state text not null default 'idle', -- idle | running | stopped | exhausted

  -- what happens next (BUGUN / KEYIN)
  add column if not exists next_action_at timestamptz,
  add column if not exists next_action_kind text,      -- callback | followup | wait_end | reactivation | task
  add column if not exists next_action_note text,

  -- Kutish / Yo'qotildi
  add column if not exists wait_until date,
  add column if not exists wait_reason text,
  add column if not exists lost_reason text,
  add column if not exists lost_competitor text,
  add column if not exists lost_at timestamptz,
  add column if not exists lost_by uuid,

  -- the card
  add column if not exists objection text,
  add column if not exists competitor text,
  add column if not exists decider text,               -- self | parent | relative
  add column if not exists study_year text,
  add column if not exists language text,              -- uz | ru
  add column if not exists preferred_channel text,
  add column if not exists preferred_time_text text,
  add column if not exists campaign_name text,
  add column if not exists adset_name text,
  add column if not exists ad_name text,
  add column if not exists form_name text,
  add column if not exists utm jsonb,
  add column if not exists referral_type text,         -- student | alumni | parent | partner | other
  add column if not exists referral_name text,
  add column if not exists product_fit text,
  add column if not exists asked_price boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid,
  add column if not exists merged_into_id uuid references public.leads (id) on delete set null,
  add column if not exists matched_student_id uuid,
  add column if not exists ai_brief_at timestamptz,
  add column if not exists ai_brief_msg_at timestamptz,
  add column if not exists reactivation_queue text,
  add column if not exists stage_changed_at timestamptz,
  add column if not exists last_operator_msg_at timestamptz,
  -- the first deadline the lead ever had: "answered within 10 minutes" is
  -- answered_at <= first_due_at (so a night lead is judged from 09:00, not 23:00)
  add column if not exists first_due_at timestamptz;

-- Everything inserted from now on is the new generation.
alter table public.leads alter column crm_generation set default 'new';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_stage_check') then
    alter table public.leads add constraint leads_stage_check
      check (stage in ('new', 'contacted', 'interested', 'offer', 'contract', 'student', 'waiting', 'lost'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_crm_generation_check') then
    alter table public.leads add constraint leads_crm_generation_check
      check (crm_generation in ('old', 'new'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_timer_kind_check') then
    alter table public.leads add constraint leads_timer_kind_check
      check (timer_kind is null or timer_kind in ('first', 'reply', 'ladder', 'callback'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_answer_kind_check') then
    alter table public.leads add constraint leads_answer_kind_check
      check (answer_kind is null or answer_kind in ('call', 'call_attempt+chat', 'call_attempt', 'chat', 'comment'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_ladder_state_check') then
    alter table public.leads add constraint leads_ladder_state_check
      check (ladder_state in ('idle', 'running', 'stopped', 'exhausted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_decider_check') then
    alter table public.leads add constraint leads_decider_check
      check (decider is null or decider in ('self', 'parent', 'relative'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_next_action_kind_check') then
    alter table public.leads add constraint leads_next_action_kind_check
      check (next_action_kind is null or next_action_kind in ('callback', 'followup', 'wait_end', 'reactivation', 'task'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_referral_type_check') then
    alter table public.leads add constraint leads_referral_type_check
      check (referral_type is null or referral_type in ('student', 'alumni', 'parent', 'partner', 'other'));
  end if;
end $$;

-- Desk queries: HOZIR (timer), BUGUN / KEYIN (next action), own leads.
create index if not exists idx_leads_v2_due on public.leads (due_at) where due_at is not null;
create index if not exists idx_leads_v2_next_action on public.leads (next_action_at) where next_action_at is not null;
create index if not exists idx_leads_v2_owner on public.leads (owner_id) where owner_id is not null;
create index if not exists idx_leads_v2_stage on public.leads (stage);
create index if not exists idx_leads_v2_generation on public.leads (crm_generation);
create index if not exists idx_leads_v2_merged on public.leads (merged_into_id) where merged_into_id is not null;
create index if not exists idx_leads_v2_wait_until on public.leads (wait_until) where wait_until is not null;

-- A Meta lead-form submission is stored once (source_id = the leadgen id).
create unique index if not exists uq_leads_meta_form on public.leads (source_id) where source = 'meta_form';

----------------------------------------------------------------------
-- 2. New tables
----------------------------------------------------------------------

create table if not exists public.lead_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  role text not null default 'parent' check (role in ('student', 'parent', 'relative')),
  name text,
  phone text,
  relation text,
  preferred_time text,
  is_decider boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lead_contacts_lead on public.lead_contacts (lead_id);

create table if not exists public.lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  at timestamptz not null default now(),
  actor_id uuid,
  kind text not null check (kind in (
    'created', 'answered', 'call', 'message_in', 'message_out', 'stage', 'wait', 'lost',
    'merge', 'promise', 'escalation', 'draft', 'claim', 'reassign', 'pin', 'field',
    'reactivation', 'comment', 'ladder', 'student_match', 'reopen'
  )),
  payload jsonb not null default '{}'::jsonb
);
create index if not exists idx_lead_events_lead on public.lead_events (lead_id, at desc);
create index if not exists idx_lead_events_kind on public.lead_events (kind, at desc);

create table if not exists public.call_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  operator_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  result text not null check (result in ('talked', 'no_answer', 'busy', 'wrong_number')),
  attempt_no integer,
  note text,
  duration_seconds integer,           -- phase 3 (PBX)
  pbx_call_id text,                   -- phase 3 (PBX)
  call_id uuid,                       -- link to calls.id once telephony fills it
  created_at timestamptz not null default now()
);
create index if not exists idx_call_attempts_lead on public.call_attempts (lead_id, started_at desc);
create index if not exists idx_call_attempts_operator on public.call_attempts (operator_id, started_at desc);

create table if not exists public.lead_promises (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  operator_id uuid,
  kind text not null default 'discount' check (kind in ('discount', 'installment', 'other')),
  text text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_promises_lead on public.lead_promises (lead_id);
create index if not exists idx_lead_promises_pending on public.lead_promises (created_at) where status = 'pending';

create table if not exists public.lead_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null check (kind in (
    'followup_d1', 'followup_d3', 'followup_d7', 'ladder_dm', 'wait_reminder', 'ai_reply', 'reactivation'
  )),
  channel text,
  text text not null,
  due_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  dedupe_key text,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
-- Not partial: NULLs are distinct in a unique index anyway, and a partial one
-- cannot be the target of ON CONFLICT (which PostgREST upserts need).
create unique index if not exists uq_lead_drafts_dedupe on public.lead_drafts (dedupe_key);
create index if not exists idx_lead_drafts_lead on public.lead_drafts (lead_id) where status = 'pending';
create index if not exists idx_lead_drafts_due on public.lead_drafts (due_at) where status = 'pending';

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram',
  post_id text,
  post_label text,
  comment_id text,
  author_username text,
  author_id text,
  text text,
  created_at timestamptz not null default now(),
  lead_id uuid references public.leads (id) on delete set null,
  replied_at timestamptz,
  replied_by uuid,
  reply_text text
);
create unique index if not exists uq_social_comments_comment on public.social_comments (platform, comment_id);
create index if not exists idx_social_comments_open on public.social_comments (created_at desc) where replied_at is null;

create table if not exists public.reactivation_queues (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  queue_key text not null,           -- hanbox | no_risk | next_intake | other_center | no_contact | price | parents
  reason text,                       -- the lost reason that put the lead here
  offer_key text,
  channel text not null default 'call' check (channel in ('call', 'dm')),
  due_at timestamptz,                -- null = waits for somebody to start the queue
  status text not null default 'waiting' check (status in ('waiting', 'ready', 'moved', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  moved_at timestamptz
);
create unique index if not exists uq_reactivation_open on public.reactivation_queues (lead_id, queue_key, channel)
  where status in ('waiting', 'ready');
create index if not exists idx_reactivation_queue on public.reactivation_queues (queue_key, status, due_at);

create table if not exists public.lead_merge_suggestions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  other_id uuid not null references public.leads (id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'merged', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (lead_id, other_id)
);

-- Telegram messages waiting to go out: escalations ("everyone"), boss alerts
-- (discount asked, "director" in a chat, contract / payment, a student wrote)
-- and the TV warning feed. SQL enqueues (testable, transactional); the edge
-- function lead-alert-dispatch delivers. Service role only: no policies.
create table if not exists public.lead_alert_outbox (
  id bigint generated always as identity primary key,
  lead_id uuid references public.leads (id) on delete cascade,
  kind text not null check (kind in ('escalation', 'promise', 'keyword', 'contract', 'student', 'report')),
  audience text not null default 'everyone' check (audience in ('everyone', 'boss')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists idx_lead_alert_outbox_pending on public.lead_alert_outbox (created_at) where sent_at is null;
alter table public.lead_alert_outbox enable row level security;

-- The spec's lead_identities: the identities of every lead, as a view over the
-- table the webhooks already maintain.
create or replace view public.lead_identities
with (security_invoker = true) as
select ci.lead_id,
       ci.channel,
       ci.identifier,
       ci.identifier_label as username,
       ci.confidence,
       ci.source
  from public.communication_identities ci
 where ci.lead_id is not null;

-- Telegram directory for escalations and reports (spec §4, §14): who gets what.
alter table public.lead_alert_recipients
  add column if not exists staff_user_id uuid,
  add column if not exists escalate boolean not null default true,
  add column if not exists boss_alerts boolean not null default false,
  add column if not exists reports_daily boolean not null default false,
  add column if not exists reports_weekly boolean not null default false;

----------------------------------------------------------------------
-- 3. Settings seed (spec §3.7, §4, §8, §9, §10, §11)
----------------------------------------------------------------------

insert into public.lead_settings (key, value) values
  -- 09:00–22:00 Monday–Saturday, Sunday off (the owner, 2026-10-14; the spec's
  -- 1.3 had Sunday as a working day).
  ('work_hours', '{"start":"09:00","end":"22:00","days":[1,2,3,4,5,6]}'),
  ('timer_minutes', '10'),
  ('escalation_repeat_minutes', '10'),
  ('ladder', '{"steps":[
      {"kind":"minutes","value":15},
      {"kind":"minutes","value":120},
      {"kind":"next_day","at":"10:00"},
      {"kind":"days","value":2,"at":"10:00"}
    ],"window_days":7,"dm_after_attempt":2}'),
  ('auto_reply', jsonb_build_object(
      -- {when} is filled with the next working morning: Bugun / Ertaga / Dushanba kuni ...
      'uz', 'Assalomu alaykum! Xabaringizni oldik. Ish vaqtimiz: dushanba–shanba, 09:00–22:00. {when} 09:00–09:30 oralig''ida qo''ng''iroq qilamiz. Qulay vaqtni yozib qo''ysangiz, shu vaqtda bog''lanamiz.',
      'ru', 'Здравствуйте! Мы получили ваше сообщение. Мы работаем с понедельника по субботу, 09:00–22:00. {when} с 09:00 до 09:30 мы вам позвоним. Напишите удобное время — свяжемся в это время.')),
  ('forbidden_words', '["kafolat","100%","bepul noutbuk","bitta narx","sertifikatsiz Koreya"]'),
  ('boss_alert_words', '["qaytar","pul","sud","shikoyat","direktor","rahbar","вернит","жалоб","директор"]'),
  ('queue_daily_limit', '15'),
  ('chat_answers_phone_leads', 'false'),
  ('control_line_10min', 'true'),
  ('tv_warning', 'true'),
  ('hanbox_group_date', '"2026-10-26"'),
  ('hanbox_announced', 'true'),
  ('no_risk_announced', 'false'),
  ('lost_reasons', '[
      {"key":"no_certificate","label":"Sertifikat yo''q","queue":"hanbox"},
      {"key":"docs_finance","label":"Hujjat / moliya","queue":"no_risk"},
      {"key":"next_year","label":"Keyingi yil / qabul","queue":"next_intake"},
      {"key":"other_center","label":"Boshqa markaz","queue":"other_center"},
      {"key":"no_contact","label":"Aloqa yo''q","queue":"no_contact"},
      {"key":"price","label":"Narx","queue":"price"},
      {"key":"parents_against","label":"Ota-ona qarshi","queue":"parents"},
      {"key":"not_fit","label":"Mos emas (yosh / ta''lim)","queue":null},
      {"key":"spam_duplicate","label":"Spam / dublikat","queue":null},
      {"key":"not_interested","label":"Qiziqmaydi","queue":null}
    ]'),
  ('objections', '[
      {"key":"price","label":"Narx"},
      {"key":"docs_finance","label":"Hujjat / moliya"},
      {"key":"certificate","label":"Sertifikat"},
      {"key":"parents","label":"Ota-ona"},
      {"key":"trust","label":"Ishonch"},
      {"key":"time","label":"Vaqt"},
      {"key":"nothing","label":"Hech narsa"}
    ]'),
  ('competitors', '["Bright Future","ON201","Global Consult","Forward","Boshqa"]'),
  ('offers', '{
      "standart": {"title":"Standart","text":"2 mln + 5 mln vizadan keyin","needs_boss":false},
      "premium": {"title":"Premium","text":"3 mln + 10 mln vizadan keyin","needs_boss":false},
      "no_risk": {"title":"NO RISK","text":"$5 000; viza rad etilsa to''liq qaytariladi (o''zi voz kechmasa)","needs_boss":true},
      "hanbox": {"title":"Hanbox","text":"$2 000 yoki $400 + 10×$200 ($2 400) yoki nasiya; birinchi dars bepul; kontrakt, bank ko''chirmasi, viza, aviabilet, yashash alohida","needs_boss":false},
      "kasbiy": {"title":"Kasbiy ta''lim","text":"Narx — rahbardan","needs_boss":true},
      "gks": {"title":"GKS","text":"GKS shartlari (TOPIK 3 / IELTS 5.5) + Standart/Premium; xizmat narxi — rahbardan","needs_boss":true}
    }'),
  ('templates', '[
      {"key":"greeting","group":"salom","uz":"Assalomu alaykum, {ism}! HANGUK Consulting. Koreyada qaysi yo''nalish qiziqtiradi — bakalavr, magistr, til yoki Hanbox?","ru":"Здравствуйте, {ism}! HANGUK Consulting. Какое направление в Корее вас интересует — бакалавриат, магистратура, язык или Hanbox?"},
      {"key":"price","group":"narx","uz":"{ism}, {tarif} bo''yicha narx: {narx}. Batafsil shartlarni qo''ng''iroqda tushuntiramiz. Qulay bo''lsa, raqamingizni qoldiring — 10 daqiqada qo''ng''iroq qilamiz.","ru":"{ism}, по тарифу {tarif} стоимость: {narx}. Подробные условия объясним по телефону. Оставьте номер — перезвоним в течение 10 минут."},
      {"key":"called","group":"qongiroq","uz":"{ism}, siz bilan bog''lanmoqchi bo''ldik, lekin ko''tarmadingiz. Qachon qo''ng''iroq qilsak qulay?","ru":"{ism}, мы пытались вам дозвониться, но вы не ответили. Когда вам удобно, чтобы мы позвонили?"},
      {"key":"confirm_phone","group":"raqam","uz":"{ism}, raqamingizni tasdiqlang, iltimos — qo''ng''iroq qilishda xatolik chiqdi.","ru":"{ism}, подтвердите, пожалуйста, номер — при звонке возникла ошибка."},
      {"key":"wait_reminder","group":"kutish","uz":"{ism}, eslatib o''tamiz: {sana} kuni gaplashishga kelishgan edik. Qulay vaqtni yozib qo''ysangiz bo''ladi.","ru":"{ism}, напоминаем: мы договорились поговорить {sana}. Напишите удобное время."},
      {"key":"hanbox","group":"hanbox","uz":"Hanbox: 1 yil onlayn, maqsad — TOPIK 2. $2 000 yoki $400 + 10×$200. Birinchi dars bepul ({sana}).","ru":"Hanbox: 1 год онлайн, цель — TOPIK 2. $2 000 или $400 + 10×$200. Первый урок бесплатный ({sana})."},
      {"key":"followup_d1","group":"kuzatuv","uz":"{ism}, savolingizga to''liq javob: {tarif}. Yana savol bo''lsa yozing — yordam beraman.","ru":"{ism}, полный ответ на ваш вопрос: {tarif}. Если есть ещё вопросы — пишите."},
      {"key":"followup_d3","group":"kuzatuv","uz":"{ism}, bizning talabalarimiz natijalari: qabul xatlari va hikoyalar. Xohlasangiz, ko''rsatib beraman.","ru":"{ism}, результаты наших студентов: письма о зачислении и истории. Если хотите — покажу."},
      {"key":"followup_d7","group":"kuzatuv","uz":"{ism}, {sana} gacha hujjat topshirish muddati — shu sanagacha ulgurish uchun hozir boshlash kerak.","ru":"{ism}, срок подачи документов — до {sana}. Чтобы успеть, нужно начать сейчас."},
      {"key":"reactivation_check","group":"qayta","uz":"{ism}, qanday ketyapti? Ta''lim rejangiz qanday o''zgardi?","ru":"{ism}, как дела? Как продвигаются ваши планы на учёбу?"},
      {"key":"comment_reply","group":"izoh","uz":"Assalomu alaykum! Batafsil ma''lumotni shaxsiy xabarda yozamiz.","ru":"Здравствуйте! Подробности напишем в личные сообщения."}
    ]')
on conflict (key) do nothing;

----------------------------------------------------------------------
-- 4. Pure helpers
----------------------------------------------------------------------

create or replace function public.fn_lead_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select value from public.lead_settings where key = p_key
$$;

create or replace function public.fn_lead_tz()
returns text
language sql
immutable
as $$ select 'Asia/Tashkent'::text $$;

create or replace function public.fn_lead_work_start()
returns time
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce((public.fn_lead_setting('work_hours')->>'start')::time, time '09:00')
$$;

create or replace function public.fn_lead_work_end()
returns time
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce((public.fn_lead_setting('work_hours')->>'end')::time, time '22:00')
$$;

-- Is this ISO weekday (1 = Monday .. 7 = Sunday) a working day?
create or replace function public.fn_lead_is_work_day(p_isodow integer)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce(
    exists (
      select 1
        from jsonb_array_elements_text(public.fn_lead_setting('work_hours')->'days') d
       where d::integer = p_isodow
    ),
    true)
$$;

create or replace function public.fn_lead_in_hours(p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
begin
  return public.fn_lead_is_work_day(extract(isodow from v_local)::integer)
     and v_local::time >= public.fn_lead_work_start()
     and v_local::time < public.fn_lead_work_end();
end;
$$;

-- p_at itself inside working hours, otherwise the next opening time.
-- (The ladder uses this: 21:50 + 15 min = 22:05 becomes tomorrow 09:00.)
create or replace function public.fn_lead_shift_into_hours(p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Tashkent';
  v_day date := v_local::date;
  i integer := 0;
begin
  if public.fn_lead_in_hours(p_at) then
    return p_at;
  end if;
  -- Before opening on a working day: the same day.
  if v_local::time < public.fn_lead_work_start()
     and public.fn_lead_is_work_day(extract(isodow from v_day)::integer) then
    return (v_day + public.fn_lead_work_start()) at time zone 'Asia/Tashkent';
  end if;
  -- Otherwise the next working day.
  loop
    v_day := v_day + 1;
    i := i + 1;
    exit when public.fn_lead_is_work_day(extract(isodow from v_day)::integer) or i > 7;
  end loop;
  return (v_day + public.fn_lead_work_start()) at time zone 'Asia/Tashkent';
end;
$$;

-- The 10-minute deadline for a timer that starts at p_start: the start moved
-- into working hours, plus the window; whatever runs past closing time carries
-- over to the next opening (21:55 -> 09:05 next day; 03:00 -> 09:10 same day).
create or replace function public.fn_lead_due_at(p_start timestamptz, p_minutes integer default null)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_min integer := coalesce(p_minutes, nullif(public.fn_lead_setting('timer_minutes') #>> '{}', '')::integer, 10);
  v_start timestamptz := public.fn_lead_shift_into_hours(p_start);
  v_end_local timestamp;
  v_raw timestamptz := v_start + make_interval(mins => v_min);
  v_overflow interval;
begin
  v_end_local := ((v_start at time zone 'Asia/Tashkent')::date + public.fn_lead_work_end());
  if v_raw <= (v_end_local at time zone 'Asia/Tashkent') then
    return v_raw;
  end if;
  v_overflow := v_raw - (v_end_local at time zone 'Asia/Tashkent');
  return public.fn_lead_shift_into_hours((v_end_local at time zone 'Asia/Tashkent') + interval '1 second') + v_overflow;
end;
$$;

-- When the next call of the ladder is due, given how many attempts have been
-- made (the one that just failed included) and when it was made. NULL = the
-- ladder is over.
--   1 failed -> +15 min    2 -> +2 h    3 -> tomorrow 10:00    4 -> +2 days 10:00
create or replace function public.fn_lead_ladder_next(p_attempts integer, p_from timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  v_steps jsonb := public.fn_lead_setting('ladder')->'steps';
  v_step jsonb;
  v_local date := (p_from at time zone 'Asia/Tashkent')::date;
  v_at time;
begin
  if p_attempts < 1 or v_steps is null or p_attempts > jsonb_array_length(v_steps) then
    return null;
  end if;
  v_step := v_steps -> (p_attempts - 1);
  v_at := coalesce((v_step->>'at')::time, time '10:00');
  case v_step->>'kind'
    when 'minutes' then
      return public.fn_lead_shift_into_hours(p_from + make_interval(mins => (v_step->>'value')::integer));
    when 'next_day' then
      return public.fn_lead_shift_into_hours(((v_local + 1) + v_at) at time zone 'Asia/Tashkent');
    when 'days' then
      return public.fn_lead_shift_into_hours(((v_local + coalesce((v_step->>'value')::integer, 1)) + v_at) at time zone 'Asia/Tashkent');
    else
      return null;
  end case;
end;
$$;

-- Last 9 digits of a phone number (the merge / student-match key), NULL when
-- the number is too short to mean anything.
create or replace function public.fn_lead_phone_key(p_phone text)
returns text
language sql
immutable
as $$
  select case when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
              then right(regexp_replace(p_phone, '\D', '', 'g'), 9)
              else null end
$$;

create or replace function public.fn_lead_handle_key(p_handle text)
returns text
language sql
immutable
as $$
  select nullif(lower(regexp_replace(coalesce(p_handle, ''), '^@', '')), '')
$$;

----------------------------------------------------------------------
-- 5. Roles and row level security (spec §13)
----------------------------------------------------------------------

create or replace function public.fn_lead_has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid() and ur.role::text = any (p_roles)
  )
$$;

-- owner / admin
create or replace function public.fn_lead_is_boss()
returns boolean language sql stable security definer set search_path = public, pg_catalog
as $$ select public.fn_lead_has_any_role(array['owner', 'admin']) $$;

-- owner / admin / lead_senior
create or replace function public.fn_lead_is_senior()
returns boolean language sql stable security definer set search_path = public, pg_catalog
as $$ select public.fn_lead_has_any_role(array['owner', 'admin', 'lead_senior']) $$;

-- anybody who works leads: owner / admin / lead_senior / call_operator
create or replace function public.fn_lead_is_staff()
returns boolean language sql stable security definer set search_path = public, pg_catalog
as $$ select public.fn_lead_has_any_role(array['owner', 'admin', 'lead_senior', 'call_operator']) $$;

revoke all on function public.fn_lead_has_any_role(text[]) from public, anon;
grant execute on function public.fn_lead_has_any_role(text[]) to authenticated, service_role;
revoke all on function public.fn_lead_is_boss() from public, anon;
grant execute on function public.fn_lead_is_boss() to authenticated, service_role;
revoke all on function public.fn_lead_is_senior() from public, anon;
grant execute on function public.fn_lead_is_senior() to authenticated, service_role;
revoke all on function public.fn_lead_is_staff() from public, anon;
grant execute on function public.fn_lead_is_staff() to authenticated, service_role;

-- leads: the visibility rules.
drop policy if exists "Staff can view all leads" on public.leads;
drop policy if exists "Staff can create leads" on public.leads;
drop policy if exists "Staff can update leads" on public.leads;
drop policy if exists "Staff can delete leads" on public.leads;
drop policy if exists "lead v2 select" on public.leads;
drop policy if exists "lead v2 insert" on public.leads;
drop policy if exists "lead v2 update" on public.leads;
drop policy if exists "lead v2 delete" on public.leads;

-- A breached lead (10 minutes gone, nobody answered) is visible to every
-- operator until it is answered, whoever holds it (spec §4: "Olish").
create policy "lead v2 select" on public.leads for select to authenticated
  using (
    public.fn_lead_is_senior()
    or (
      public.fn_lead_has_any_role(array['call_operator'])
      and (
        crm_generation = 'old'
        or owner_id is null
        or owner_id = auth.uid()
        or (due_at is not null and due_at <= now())
      )
    )
    or (
      public.fn_lead_has_any_role(array['document_handler'])
      and (stage = 'student' or converted_to_student_id is not null)
    )
  );

create policy "lead v2 insert" on public.leads for insert to authenticated
  with check (public.fn_lead_is_staff());

create policy "lead v2 update" on public.leads for update to authenticated
  using (
    public.fn_lead_is_senior()
    or (
      public.fn_lead_has_any_role(array['call_operator'])
      and (crm_generation = 'old' or owner_id is null or owner_id = auth.uid())
    )
  )
  with check (
    public.fn_lead_is_senior()
    or (public.fn_lead_has_any_role(array['call_operator']) and (owner_id is null or owner_id = auth.uid() or crm_generation = 'old'))
  );

-- A hard delete takes the lead's events and call attempts with it, so only the
-- boss may do it; operators close a lead with lead_lose (Yo'qotildi).
create policy "lead v2 delete" on public.leads for delete to authenticated
  using (public.fn_lead_is_boss());

-- Child tables follow the lead: you see (and may touch) what you can see on
-- the lead. The sub-select runs under the caller's own leads policy.
alter table public.lead_events enable row level security;
alter table public.call_attempts enable row level security;
alter table public.lead_contacts enable row level security;
alter table public.lead_promises enable row level security;
alter table public.lead_drafts enable row level security;
alter table public.social_comments enable row level security;
alter table public.reactivation_queues enable row level security;
alter table public.lead_merge_suggestions enable row level security;
alter table public.lead_settings enable row level security;

-- lead_events / call_attempts: read follows the lead; writes only through the
-- SECURITY DEFINER RPCs and triggers (no insert policy for clients).
drop policy if exists "lead events read" on public.lead_events;
create policy "lead events read" on public.lead_events for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_events.lead_id));

drop policy if exists "call attempts read" on public.call_attempts;
create policy "call attempts read" on public.call_attempts for select to authenticated
  using (exists (select 1 from public.leads l where l.id = call_attempts.lead_id));

drop policy if exists "lead contacts rw" on public.lead_contacts;
create policy "lead contacts rw" on public.lead_contacts for all to authenticated
  using (public.fn_lead_is_staff() and exists (select 1 from public.leads l where l.id = lead_contacts.lead_id))
  with check (public.fn_lead_is_staff() and exists (select 1 from public.leads l where l.id = lead_contacts.lead_id));

drop policy if exists "lead promises read" on public.lead_promises;
create policy "lead promises read" on public.lead_promises for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_promises.lead_id));

drop policy if exists "lead drafts read" on public.lead_drafts;
create policy "lead drafts read" on public.lead_drafts for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_drafts.lead_id));
drop policy if exists "lead drafts handle" on public.lead_drafts;
create policy "lead drafts handle" on public.lead_drafts for update to authenticated
  using (public.fn_lead_is_staff() and exists (select 1 from public.leads l where l.id = lead_drafts.lead_id))
  with check (public.fn_lead_is_staff());

-- Comments are shared: every staff role, the boss included, answers from the
-- panel (spec §3.2).
drop policy if exists "social comments read" on public.social_comments;
create policy "social comments read" on public.social_comments for select to authenticated
  using (public.fn_lead_is_staff());
drop policy if exists "social comments reply" on public.social_comments;
create policy "social comments reply" on public.social_comments for update to authenticated
  using (public.fn_lead_is_staff()) with check (public.fn_lead_is_staff());

drop policy if exists "reactivation read" on public.reactivation_queues;
create policy "reactivation read" on public.reactivation_queues for select to authenticated
  using (public.fn_lead_is_staff());

drop policy if exists "merge suggestions read" on public.lead_merge_suggestions;
create policy "merge suggestions read" on public.lead_merge_suggestions for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_merge_suggestions.lead_id));

-- Settings: every staff role reads (templates, forbidden words, offers); the
-- boss writes everything, a lead_senior only the templates.
drop policy if exists "lead settings read" on public.lead_settings;
create policy "lead settings read" on public.lead_settings for select to authenticated
  using (public.fn_lead_is_staff());
drop policy if exists "lead settings boss write" on public.lead_settings;
create policy "lead settings boss write" on public.lead_settings for all to authenticated
  using (public.fn_lead_is_boss()) with check (public.fn_lead_is_boss());
drop policy if exists "lead settings senior templates" on public.lead_settings;
create policy "lead settings senior templates" on public.lead_settings for all to authenticated
  using (public.fn_lead_has_any_role(array['lead_senior']) and key = 'templates')
  with check (public.fn_lead_has_any_role(array['lead_senior']) and key = 'templates');

-- The Telegram directory: boss only (it holds chat ids).
alter table public.lead_alert_recipients enable row level security;
drop policy if exists "alert recipients boss" on public.lead_alert_recipients;
create policy "alert recipients boss" on public.lead_alert_recipients for all to authenticated
  using (public.fn_lead_is_boss()) with check (public.fn_lead_is_boss());

-- The senior operator works the whole inbox too: the card's timeline reads, and
-- its composer writes, the same message tables the operators use. The old
-- policies on these tables name owner / admin / call_operator only (and
-- document_handler for reads); these ones are added next to them (policies OR).
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'message_threads', 'communication_identities'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "lead senior all" on public.%I', t);
      execute format(
        'create policy "lead senior all" on public.%I for all to authenticated '
        || 'using (public.fn_lead_has_any_role(array[''lead_senior''])) '
        || 'with check (public.fn_lead_has_any_role(array[''lead_senior'']))', t);
    end if;
  end loop;
  foreach t in array array['calls', 'call_transcripts', 'call_analyses', 'instagram_comments', 'lead_notes', 'student_phones'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "lead senior read" on public.%I', t);
      execute format(
        'create policy "lead senior read" on public.%I for select to authenticated '
        || 'using (public.fn_lead_has_any_role(array[''lead_senior'']))', t);
    end if;
  end loop;
end $$;

grant select on public.lead_identities to authenticated;
grant select, insert, update, delete on public.lead_settings to authenticated;
grant select, insert, update, delete on public.lead_contacts to authenticated;
grant select on public.lead_events, public.call_attempts, public.lead_promises, public.reactivation_queues,
  public.lead_merge_suggestions to authenticated;
grant select, update on public.lead_drafts, public.social_comments to authenticated;
grant select, insert, update, delete on public.lead_alert_recipients to authenticated;

----------------------------------------------------------------------
-- 6. Realtime
----------------------------------------------------------------------

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['lead_events', 'lead_drafts', 'social_comments', 'lead_promises', 'reactivation_queues'] loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
