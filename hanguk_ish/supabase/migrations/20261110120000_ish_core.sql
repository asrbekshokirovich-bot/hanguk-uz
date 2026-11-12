-- Hanguk Ish — core schema (P1, 2026-11-10).
--
-- Everything of Hanguk Ish lives in its own schema, `ish`, inside hanguk.uz's
-- Supabase project (P48): nothing here creates, changes or grants anything in
-- `public`, which is hanguk.uz's. Two apps use it — the worker app
-- (uz.hanguk.ish) and the employer app (uz.hanguk.ish.biz) — and hanguk.uz's
-- CRM «Hanguk Ish» section. The API serves it once `ish` is among the
-- project's exposed schemas (Settings → Data API).
--
-- Times are stored as timestamptz and always shown on the Korean clock
-- (Asia/Seoul, UTC+9, no DST). Money is whole Korean won (int).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists ish;
comment on schema ish is 'Hanguk Ish (hanguk_ish/): day-job shifts in Korea — apps uz.hanguk.ish, uz.hanguk.ish.biz and the CRM section.';
grant usage on schema ish to anon, authenticated, service_role;
-- A new schema has none of the defaults `public` has on Supabase: the
-- service role (edge functions) gets everything made here explicitly; what
-- signed-in people may read or write is granted table by table (ish_rls).
alter default privileges in schema ish grant all on tables to service_role;
alter default privileges in schema ish grant all on sequences to service_role;
alter default privileges in schema ish grant execute on functions to service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type ish.app_language as enum ('uz', 'ru', 'en', 'ko');

-- 국세청 사업자등록 상태 + our review: pending until verified (T8: verified
-- automatically when NTS answers 계속사업자).
create type ish.business_status as enum ('pending', 'verified', 'rejected');

create type ish.shift_status as enum ('open', 'cancelled');

-- pending → confirmed → checked_in → completed; side exits: rejected (by the
-- business), cancelled (by the worker), no_show (window closed, never
-- checked in).
create type ish.application_status as enum (
  'pending', 'confirmed', 'rejected', 'cancelled', 'checked_in', 'completed', 'no_show'
);

-- ---------------------------------------------------------------------------
-- Minimum wage (official, by year of the shift's Korean date)
-- ---------------------------------------------------------------------------

create table ish.minimum_wages (
  year int primary key,
  hourly_won int not null check (hourly_won > 0),
  source text not null
);

comment on table ish.minimum_wages is
  'Korean statutory minimum hourly wage by year. Add next year''s row when the Ministry of Employment and Labor publishes it.';

insert into ish.minimum_wages (year, hourly_won, source) values
  (2026, 10320, '고용노동부 고시: 2026년 적용 최저임금 시간급 10,320원'),
  (2027, 10700, '고용노동부 고시 (2026-08-05): 2027년 적용 최저임금 시간급 10,700원');

-- The statutory minimum on the Korean calendar date of [p_at].
create function ish.minimum_wage(p_at timestamptz)
returns int
language sql
stable
set search_path = ish
as $$
  select hourly_won
  from ish.minimum_wages
  where year <= extract(year from (p_at at time zone 'Asia/Seoul'))::int
  order by year desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table ish.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  avatar_path text check (char_length(avatar_path) <= 300),
  phone text check (char_length(phone) <= 32),
  telegram_id bigint unique,
  telegram_username text check (char_length(telegram_username) <= 64),
  language ish.app_language not null default 'uz',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table ish.profiles is
  'One row per Hanguk Ish user (both apps). Created by the ish_on_auth_user_created trigger.';

-- Availability is a 28-bit mask: bit (day * 4 + slot), day 0 = Monday …
-- 6 = Sunday, slot 0 = 06–12, 1 = 12–18, 2 = 18–24, 3 = 00–06 (A02 step 3).
create table ish.worker_profiles (
  user_id uuid primary key default auth.uid() references ish.profiles (id) on delete cascade,
  languages text[] not null default '{}'
    check (languages <@ array['uz', 'ru', 'en', 'ko', 'kk', 'ky', 'tg']::text[]),
  topik smallint not null default 0 check (topik between 0 and 6),
  university text check (char_length(university) <= 120),
  district text check (char_length(district) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  availability int not null default 0 check (availability between 0 and 268435455),
  visa text check (visa in ('D-2', 'D-4', 'other')),
  -- T5: starts at 100; completed shift +1 (max 100), late cancel −5, no-show −20.
  reliability smallint not null default 100 check (reliability between 0 and 100),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table ish.worker_profiles is
  'Worker side of a profile (A02). onboarded_at is set when step 3 is saved; only onboarded workers can take shifts.';

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------

create table ish.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references ish.profiles (id),
  -- As registered, in Korean: 달빛카페 신촌점.
  name text not null check (char_length(name) between 1 and 80),
  -- What workers read, per app language: {"uz": "Dalbit Kafe · Sinchon", …}.
  name_i18n jsonb not null default '{}'::jsonb,
  biz_no text not null unique check (biz_no ~ '^[0-9]{10}$'),
  -- 국세청 b_stt_cd: 01 계속사업자, 02 휴업자, 03 폐업자.
  nts_status text check (nts_status in ('01', '02', '03')),
  nts_checked_at timestamptz,
  status ish.business_status not null default 'pending',
  category text not null default 'other'
    check (category in ('cafe', 'restaurant', 'retail', 'logistics', 'event', 'office', 'other')),
  address text not null default '' check (char_length(address) <= 200),
  district text check (char_length(district) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

create table ish.business_members (
  business_id uuid not null references ish.businesses (id) on delete cascade,
  user_id uuid not null references ish.profiles (id) on delete cascade,
  -- owner = 사장님, manager = 점장.
  role text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_idx on ish.business_members (user_id);

-- ---------------------------------------------------------------------------
-- Shifts
-- ---------------------------------------------------------------------------

-- BA2 템플릿: what is reused from one posting to the next.
create table ish.shift_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references ish.businesses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  duties text not null default '' check (char_length(duties) <= 600),
  dress text not null default '' check (char_length(dress) <= 300),
  address text not null default '' check (char_length(address) <= 200),
  start_time time,
  end_time time,
  hourly_wage int check (hourly_wage > 0),
  slots smallint check (slots between 1 and 50),
  created_at timestamptz not null default now()
);

create index shift_templates_business_idx on ish.shift_templates (business_id);

create table ish.shifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references ish.businesses (id) on delete cascade,
  template_id uuid references ish.shift_templates (id) on delete set null,
  -- Written in Korean by the business; translations below are for workers.
  title text not null check (char_length(title) between 1 and 80),
  duties text not null default '' check (char_length(duties) <= 600),
  dress text not null default '' check (char_length(dress) <= 300),
  address text not null default '' check (char_length(address) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hourly_wage int not null check (hourly_wage > 0),
  slots smallint not null check (slots between 1 and 50),
  auto_confirm boolean not null default false,
  status ish.shift_status not null default 'open',
  -- {"uz": {"title": …, "duties": …, "dress": …, "address": …}, "ru": …}
  translations jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references ish.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_time_order check (ends_at > starts_at),
  constraint shifts_max_length check (ends_at - starts_at <= interval '16 hours')
);

create index shifts_open_starts_idx on ish.shifts (starts_at) where status = 'open';
create index shifts_business_starts_idx on ish.shifts (business_id, starts_at);

-- The QR secret lives apart from the shift so that workers, who can read open
-- shifts, can never read it (BA3: one code per shift, for check-in and out).
create table ish.shift_secrets (
  shift_id uuid primary key references ish.shifts (id) on delete cascade,
  qr_secret text not null default encode(extensions.gen_random_bytes(16), 'hex')
);

create table ish.applications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references ish.shifts (id) on delete cascade,
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  status ish.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  cancelled_at timestamptz,
  -- Cancelled with less than 24 h to go (T5).
  late_cancel boolean not null default false,
  check_in_at timestamptz,
  check_out_at timestamptz,
  -- Whole minutes after the start at check-in; 1 or more = 지각 (T6).
  late_minutes int check (late_minutes >= 0),
  -- T7: actual QR time inside the planned window, never more than planned.
  worked_minutes int check (worked_minutes >= 0),
  pay_amount int check (pay_amount >= 0),
  -- The business pays the worker directly; this only records that it did.
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

-- A worker holds at most one live application per shift.
create unique index applications_one_live_per_shift
  on ish.applications (shift_id, worker_id)
  where status not in ('cancelled', 'rejected');

create index applications_worker_idx on ish.applications (worker_id, status);
create index applications_shift_idx on ish.applications (shift_id, status);

-- ---------------------------------------------------------------------------
-- After the shift
-- ---------------------------------------------------------------------------

create table ish.ratings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references ish.applications (id) on delete cascade,
  direction text not null check (direction in ('worker_to_business', 'business_to_worker')),
  rater_id uuid not null references ish.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  -- A08 tags (worker → business).
  tags text[] not null default '{}'
    check (tags <@ array['on_time', 'polite', 'explained_well', 'as_described',
                         'break_given', 'clean_workplace', 'would_return']::text[]),
  created_at timestamptz not null default now(),
  unique (application_id, direction)
);

create table ish.favorites (
  business_id uuid not null references ish.businesses (id) on delete cascade,
  worker_id uuid not null references ish.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_id, worker_id)
);

-- One chat thread per application (A10): the worker and the business.
create table ish.messages (
  id bigint generated always as identity primary key,
  application_id uuid not null references ish.applications (id) on delete cascade,
  sender_id uuid not null default auth.uid() references ish.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  -- Language of [body] when known; translations: {"uz": …, "ko": …}.
  lang text,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_thread_idx on ish.messages (application_id, created_at);

-- In-app notifications (A12). The text is built by the app from [kind] and
-- [data], in the reader's language.
create table ish.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references ish.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'shift_reminder', 'application_confirmed', 'application_rejected',
    'new_shift_match', 'nearby_digest', 'new_applicant', 'worker_cancelled',
    'no_show', 'request_again', 'chat_message', 'payment_marked'
  )),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on ish.notifications (user_id, created_at desc);

create table ish.push_tokens (
  token text primary key check (char_length(token) <= 4096),
  user_id uuid not null default auth.uid() references ish.profiles (id) on delete cascade,
  app text not null check (app in ('worker', 'employer')),
  platform text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on ish.push_tokens (user_id);

-- A11 «Shikoyat qilish» and disputes (T9: stored here, admin screen later).
create table ish.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references ish.profiles (id) on delete cascade,
  application_id uuid references ish.applications (id) on delete set null,
  business_id uuid references ish.businesses (id) on delete set null,
  reason text not null check (reason in (
    'unpaid', 'not_as_described', 'time_dispute', 'no_show', 'behaviour', 'other'
  )),
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'closed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Housekeeping triggers
-- ---------------------------------------------------------------------------

create function ish.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_touch before update on ish.profiles
  for each row execute function ish.touch_updated_at();
create trigger worker_profiles_touch before update on ish.worker_profiles
  for each row execute function ish.touch_updated_at();
create trigger shifts_touch before update on ish.shifts
  for each row execute function ish.touch_updated_at();
create trigger applications_touch before update on ish.applications
  for each row execute function ish.touch_updated_at();

-- Every new Hanguk Ish user gets a profile row. The sign-in is hanguk.uz's
-- (one Supabase project, P48), so only the people of these apps: the apps
-- sign up with user_metadata.app = 'hanguk_ish', and a phone-only account
-- (no e-mail) is ours too. hanguk.uz's staff and students sign in with an
-- e-mail and get no row here; their own profile is public.profiles, made by
-- hanguk.uz's public.handle_new_user, which skips our sign-ups in turn.
create function ish.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'hanguk_ish'
     or (coalesce(new.phone, '') <> '' and coalesce(new.email, '') = '') then
    insert into ish.profiles (id, phone)
    values (new.id, new.phone)
    on conflict (id) do nothing;
  end if;
  return new;
end
$$;

-- Its own name: hanguk.uz has an on_auth_user_created trigger on auth.users.
create trigger ish_on_auth_user_created
  after insert on auth.users
  for each row execute function ish.handle_new_user();

-- Shifts: wage at least the statutory minimum of the shift's date, a secret
-- for the QR code, and a fresh translation whenever the Korean text changes.
create function ish.shifts_validate()
returns trigger
language plpgsql
set search_path = ish
as $$
declare
  v_min int := ish.minimum_wage(new.starts_at);
begin
  if v_min is not null and new.hourly_wage < v_min then
    raise exception 'WAGE_BELOW_MINIMUM'
      using errcode = 'P0001',
            detail = format('hourly_wage %s < minimum %s', new.hourly_wage, v_min);
  end if;
  if tg_op = 'UPDATE' and (
       new.title is distinct from old.title or new.duties is distinct from old.duties
       or new.dress is distinct from old.dress or new.address is distinct from old.address
     ) and new.translations = old.translations then
    new.translations := '{}'::jsonb;
  end if;
  return new;
end
$$;

create trigger shifts_validate before insert or update on ish.shifts
  for each row execute function ish.shifts_validate();

create function ish.shifts_add_secret()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  insert into ish.shift_secrets (shift_id) values (new.id);
  return new;
end
$$;

create trigger shifts_add_secret after insert on ish.shifts
  for each row execute function ish.shifts_add_secret();
