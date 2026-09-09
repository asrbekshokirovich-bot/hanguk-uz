-- Bring the messaging schema that lives in production back into this repo.
--
-- WHY THIS FILE EXISTS
--
-- A September 2026 audit compared the live database against these migrations
-- and found that a whole subsystem was missing from the repo: five Instagram
-- tables, the two RPCs the Messages page actually calls, the delivery-status
-- columns every outgoing message writes, and three triggers. All of it was
-- created by hand in the Supabase dashboard and never committed.
--
-- That is not a filing error, it is a live hazard. `supabase db reset`, a
-- staging clone, or any fresh environment built from this directory produces a
-- database the application cannot run against — `get_thread_previews` does not
-- exist, so the inbox is empty and the failure looks like "no messages"
-- instead of "missing function". And a future migration written against the
-- repo's idea of the schema can contradict what is really there.
--
-- The root cause was structural: nothing ever deployed FROM the repo. There
-- was no workflow for functions or migrations, so the dashboard was the only
-- way to change anything, and the repo could only ever fall behind. The
-- deploy workflow added alongside this migration is the half that stops it
-- happening again; this file is the half that makes the repo true today.
--
-- EVERY statement here is written to be a no-op against production, because
-- production already has all of it. This is a catch-up record, not a change.
-- It was produced by reading the live catalog (pg_get_functiondef, pg_indexes,
-- information_schema) rather than by remembering what was intended, so the
-- definitions below are what is actually running, warts included.

-- ---------------------------------------------------------------------------
-- 1. messages: delivery tracking
-- ---------------------------------------------------------------------------
-- Added when sending became optimistic: the row is inserted as 'sending' and
-- shown at once, and the edge function flips it to 'sent' or 'failed'.
-- client_msg_id is the browser's idempotency key for that insert.

alter table public.messages add column if not exists delivery_status text;
alter table public.messages add column if not exists delivery_error  text;
alter table public.messages add column if not exists client_msg_id   uuid;

comment on column public.messages.delivery_status is
  'sending | sent | failed — outgoing messages only; null for inbound.';

-- One row per client attempt: a retried POST cannot double-insert.
create unique index if not exists uq_messages_client_msg_id
  on public.messages (client_msg_id) where client_msg_id is not null;

-- Ingest de-duplication, enforced by the database rather than by each webhook
-- doing a select-then-insert (which races itself under Meta/Telegram retries).
create unique index if not exists messages_source_external_id_key
  on public.messages (source, external_id) where external_id is not null;

-- Thread reads are always (source, sender_id) newest-first; the id tiebreak
-- makes keyset pagination in get_thread_messages exact.
create index if not exists idx_messages_thread_time
  on public.messages (source, sender_id, created_at desc, id desc);

create index if not exists idx_messages_assigned_thread
  on public.messages (source, sender_id, created_at desc) where assigned_to is not null;

-- An outgoing message that came back with an external_id was accepted by the
-- platform, so it is delivered no matter what the row said a moment ago.
create or replace function public.resolve_delivery_on_external_id()
returns trigger
language plpgsql
as $function$
BEGIN
  IF NEW.direction = 'outgoing' AND NEW.external_id IS NOT NULL
     AND (NEW.delivery_status IS NULL OR NEW.delivery_status IN ('sending','failed')) THEN
    NEW.delivery_status := 'sent';
    NEW.delivery_error := NULL;
  END IF;
  RETURN NEW;
END $function$;

drop trigger if exists trg_resolve_delivery_status on public.messages;
create trigger trg_resolve_delivery_status
  before insert or update on public.messages
  for each row execute function public.resolve_delivery_on_external_id();

-- Keeps the thread's clock honest even when a message is written by a path
-- that does not call upsert_message_thread. GREATEST, so a backfilled old
-- message cannot drag a live thread backwards.
create or replace function public.bump_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  UPDATE public.message_threads t
     SET last_message_at = GREATEST(t.last_message_at, NEW.created_at)
   WHERE t.source = NEW.source AND t.sender_id = NEW.sender_id
     AND t.last_message_at < NEW.created_at;
  RETURN NEW;
END $function$;

drop trigger if exists trg_bump_thread_last_message on public.messages;
create trigger trg_bump_thread_last_message
  after insert on public.messages
  for each row execute function public.bump_thread_last_message();

-- ---------------------------------------------------------------------------
-- 2. message_threads: intake stamping
-- ---------------------------------------------------------------------------

create or replace function public.set_thread_intake()
returns trigger
language plpgsql
as $function$
begin
  if new.intake_id is null then
    new.intake_id := public.current_chat_intake_id();
  end if;
  return new;
end $function$;

drop trigger if exists trg_set_thread_intake on public.message_threads;
create trigger trg_set_thread_intake
  before insert on public.message_threads
  for each row execute function public.set_thread_intake();

-- ---------------------------------------------------------------------------
-- 3. The two RPCs the Messages page calls
-- ---------------------------------------------------------------------------
-- Neither is SECURITY DEFINER: they run as the caller, so RLS on messages and
-- message_threads still decides what comes back. Default grants (public
-- EXECUTE) are therefore safe and are what production has.

-- One row per thread with its last message folded in, so the inbox list is a
-- single round trip instead of N+1 queries.
create or replace function public.get_thread_previews()
returns table(
  id uuid, source text, sender_id text, sender_name text, sender_avatar text,
  student_id uuid, last_message_at timestamptz, unread_count integer, status text,
  intake_id uuid, last_content text, last_message_type text, last_direction text,
  last_created_at timestamptz, last_delivery_status text, last_metadata jsonb,
  assigned_to uuid
)
language sql
stable
as $function$
  SELECT t.id, t.source, t.sender_id, t.sender_name, t.sender_avatar,
         t.student_id, t.last_message_at, t.unread_count, t.status, t.intake_id,
         lm.content, lm.message_type, lm.direction, lm.created_at,
         lm.delivery_status, lm.metadata,
         am.assigned_to
    FROM public.message_threads t
    LEFT JOIN LATERAL (
      SELECT m.content, m.message_type, m.direction, m.created_at,
             m.delivery_status, m.metadata
        FROM public.messages m
       WHERE m.source = t.source AND m.sender_id = t.sender_id
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT m.assigned_to
        FROM public.messages m
       WHERE m.source = t.source AND m.sender_id = t.sender_id
         AND m.assigned_to IS NOT NULL
       ORDER BY m.created_at DESC
       LIMIT 1
    ) am ON true
   ORDER BY t.last_message_at DESC;
$function$;

-- Keyset pagination on (created_at, id) rather than OFFSET, so scrolling back
-- through a long conversation stays O(page) and cannot skip or repeat a row
-- when a new message arrives mid-scroll.
create or replace function public.get_thread_messages(
  p_source text,
  p_sender_id text,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns setof public.messages
language sql
stable
as $function$
  SELECT * FROM public.messages m
   WHERE m.source = p_source AND m.sender_id = p_sender_id
     AND (p_before IS NULL
          OR (m.created_at, m.id) < (p_before, COALESCE(p_before_id, '00000000-0000-0000-0000-000000000000'::uuid)))
   ORDER BY m.created_at DESC, m.id DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$function$;

-- ---------------------------------------------------------------------------
-- 4. Instagram tables
-- ---------------------------------------------------------------------------

-- The connected business account and its long-lived token.
create table if not exists public.instagram_accounts (
  id               uuid primary key default gen_random_uuid(),
  ig_user_id       text not null unique,
  username         text,
  access_token     text not null,
  token_expires_at timestamptz,
  active           boolean not null default true,
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- App-level credentials. verify_token defaults to a fresh random value so a
-- new environment has one without anybody inventing it.
create table if not exists public.instagram_app_config (
  id            text primary key default 'main',
  app_id        text,
  app_secret    text,
  verify_token  text not null default encode(gen_random_bytes(24), 'hex'),
  graph_version text not null default 'v25.0',
  updated_at    timestamptz not null default now()
);

-- Comments under posts and reels — a separate inbox from DMs.
create table if not exists public.instagram_comments (
  id                 uuid primary key default gen_random_uuid(),
  comment_id         text not null unique,
  media_id           text,
  media_product_type text,
  parent_comment_id  text,
  from_ig_id         text,
  from_username      text,
  text               text,
  commented_at       timestamptz,
  is_from_me         boolean not null default false,
  status             text not null default 'new'
                       check (status in ('new','replied','private_replied','hidden','ignored')),
  reply_comment_id   text,
  reply_text         text,
  replied_by         uuid references public.profiles(user_id) on delete set null,
  replied_at         timestamptz,
  student_id         uuid,
  lead_id            uuid references public.leads(id) on delete set null,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Send-side de-duplication: (recipient, text hash, time bucket) as the primary
-- key, so a double-clicked Send inside the same bucket collides instead of
-- messaging the person twice.
create table if not exists public.instagram_send_dedupe (
  igsid      text not null,
  text_hash  text not null,
  bucket     bigint not null,
  created_at timestamptz not null default now(),
  primary key (igsid, text_hash, bucket)
);

-- Every delivery is stored raw before it is processed, so a payload that
-- crashes the handler is still on disk to look at afterwards.
create table if not exists public.instagram_webhook_events (
  id         uuid primary key default gen_random_uuid(),
  event_kind text,
  payload    jsonb not null,
  processed  boolean not null default false,
  error      text,
  created_at timestamptz not null default now()
);

alter table public.instagram_accounts       enable row level security;
alter table public.instagram_app_config     enable row level security;
alter table public.instagram_comments       enable row level security;
alter table public.instagram_send_dedupe    enable row level security;
alter table public.instagram_webhook_events enable row level security;

-- accounts / app_config / dedupe / webhook_events carry credentials and raw
-- payloads and have NO policies on purpose: only the service role reaches
-- them, i.e. only the edge functions.

drop policy if exists "Staff can view instagram comments" on public.instagram_comments;
create policy "Staff can view instagram comments" on public.instagram_comments
  for select using (
    has_role((select auth.uid()), 'owner'::app_role)
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'call_operator'::app_role)
    or has_role((select auth.uid()), 'document_handler'::app_role)
  );

drop policy if exists "Staff can manage instagram comments" on public.instagram_comments;
create policy "Staff can manage instagram comments" on public.instagram_comments
  for update using (
    has_role((select auth.uid()), 'owner'::app_role)
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'call_operator'::app_role)
  );
