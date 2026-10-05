-- A stand-in for the part of the PRODUCTION schema that the lead-v2 migrations
-- build on. It exists only so the migrations can be executed and tested on an
-- in-memory Postgres (PGlite) without touching the real database. It is NOT a
-- migration and must never be applied anywhere.
--
-- Keep it minimal: only objects the v2 migrations read, alter or replace.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type public.app_role as enum ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create table public.profiles (user_id uuid primary key, full_name text);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  source text not null default 'manual',
  source_id text,
  status text not null default 'new',
  interest_level text default 'medium',
  notes text,
  ai_summary text,
  assigned_to uuid,
  converted_to_student_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  city text,
  birth_date date,
  education_level text,
  english_level text,
  korean_level text,
  budget_range text,
  how_heard text,
  priority_score integer default 50,
  next_follow_up timestamptz,
  last_contacted_at timestamptz,
  contract_number text,
  contract_date date,
  exam_date date,
  exam_type text,
  target_intake text,
  enriched_at timestamptz,
  referred_by_student_id uuid,
  age integer,
  cert_level text,
  contact_channel text,
  source_note text,
  qualified boolean not null default true,
  current_stage text,
  telegram_handle text,
  instagram_handle text,
  call_result text,
  new_lead_at timestamptz,
  sla_start_at timestamptz,
  sla_alerted_at timestamptz,
  quiz_submitted_at timestamptz,
  constraint leads_age_range check (age is null or (age between 10 and 99))
);
alter table public.leads enable row level security;

create or replace function public.update_updated_at_column() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create trigger update_leads_updated_at before update on public.leads
  for each row execute function public.update_updated_at_column();

create or replace function public.fn_leads_qualified_guard() returns trigger language plpgsql as
$$ begin new.qualified := coalesce(trim(new.phone), '') <> ''; return new; end $$;
create trigger trg_leads_qualified_guard before insert or update of phone on public.leads
  for each row execute function public.fn_leads_qualified_guard();

-- the OLD alert trigger the migration must remove
create or replace function public.fn_leads_mark_new_lead() returns trigger language plpgsql as
$$ begin if tg_op = 'INSERT' then new.new_lead_at := now(); end if; return new; end $$;
create trigger trg_leads_mark_new_lead before insert or update of phone, full_name on public.leads
  for each row execute function public.fn_leads_mark_new_lead();

-- the old SLA scan the migration retires
create or replace function public.fn_lead_sla_scan(p_minutes integer default 10, p_dry boolean default false)
returns table(id uuid, full_name text, phone text, how_heard text, source text, arrived_at timestamptz, minutes_waiting integer)
language sql as $$ select l.id, l.full_name, l.phone, l.how_heard, l.source, l.new_lead_at, 1 from public.leads l $$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  sender_name text,
  sender_id text,
  content text not null default '',
  message_type text default 'text',
  direction text not null default 'incoming',
  status text default 'unread',
  student_id uuid,
  assigned_to uuid,
  replied_by uuid,
  metadata jsonb default '{}'::jsonb,
  delivery_status text,
  created_at timestamptz not null default now()
);

create table public.communication_identities (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  identifier text not null,
  identifier_label text,
  student_id uuid,
  lead_id uuid references public.leads (id) on delete cascade,
  display_name text,
  confidence text default 'unverified',
  source text default 'auto',
  created_at timestamptz not null default now(),
  unique (channel, identifier)
);

create table public.calls (id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads (id) on delete set null);
create table public.lead_notes (id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads (id) on delete cascade, content text);
create table public.instagram_comments (id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads (id) on delete set null);
create table public.student_phones (id uuid primary key default gen_random_uuid(), student_id uuid not null, phone text, phone_norm text);

create table public.after_hours_reply_queue (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  sender_id text not null,
  arrived_at timestamptz not null,
  last_incoming_at timestamptz,
  claimed_at timestamptz,
  reply_text text not null,
  unique (source, sender_id)
);

create table public.lead_alert_recipients (
  chat_id text primary key,
  label text,
  enabled boolean not null default true,
  watchdog boolean not null default false
);

-- the OLD after-hours functions that the migration replaces (same signatures)
create or replace function public.fn_after_hours_reply_texts() returns text[] language sql immutable as
$$ select array['old1', 'old2', 'old3']::text[] $$;
create or replace function public.fn_after_hours_reply_text(p_at timestamptz) returns text language sql stable as
$$ select null::text $$;
create or replace function public.fn_is_automatic_outgoing(p_content text, p_metadata jsonb) returns boolean language sql immutable as
$$ select trim(coalesce(p_content, '')) like '[template]%' $$;
create or replace function public.fn_queue_after_hours_reply() returns trigger language plpgsql as
$$ begin return new; end $$;
create trigger trg_queue_after_hours_reply after insert on public.messages
  for each row execute function public.fn_queue_after_hours_reply();
create or replace function public.fn_mark_lead_contacted_on_reply() returns trigger language plpgsql as
$$ begin return new; end $$;
create trigger trg_mark_lead_contacted_on_reply after insert on public.messages
  for each row execute function public.fn_mark_lead_contacted_on_reply();
create or replace function public.fn_lead_alerts_open(p_now timestamptz, p_start timestamptz) returns boolean language sql stable as
$$ select true $$;
