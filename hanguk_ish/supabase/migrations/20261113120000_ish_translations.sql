-- Hanguk Ish — machine translation (P55, 2026-11-13).
--
-- What one side writes, the other reads in its own language: a chat message
-- (A10 — «Koreyscha xabarlar avtomatik o'zbekchaga tarjima qilinadi»), a
-- shift's texts (BA2: title, duties, dress, address) and a business's name
-- and place. The apps and the CRM already show translations where there are
-- some (`messages.translations`, `shifts.translations`, `businesses.name_i18n`
-- and `businesses.translations`); until now nothing wrote them.
--
--   * A row to translate goes into ish.translation_queue: on insert, and when
--     its original text changes (shifts_validate and businesses_i18n_reset
--     have dropped the old translation by then).
--   * The statement then asks the edge function `ish-translate`
--     (supabase/functions/ish-translate) to work the queue: pg_net, with the
--     project's secret key from the vault, as hanguk.uz's pg_cron jobs do.
--     The pg_cron job `ish-translate` asks again every minute while something
--     is due.
--   * The function takes due rows (translation_claim: each try moves the next
--     one further — 1, 2, 4 … 60 minutes; after 10 tries the row stays as a
--     record of what failed), translates them with Hanguk AI's providers and
--     writes the result (translation_save) only while the original is still
--     the text it translated; a newer text has its own row in the queue.
--
-- Messages and shifts get the four app languages (uz, ru, en, ko) other than
-- their own; businesses — uz, ru, en (their name and address are Korean,
-- which Korean readers see as is). A name the staff typed (name_i18n, P52)
-- is never replaced.
--
-- Without pg_net, the vault key (the tests, a local stack) or an AI provider,
-- rows wait in the queue; nothing else changes. Translating is never worth a
-- failed write: an error in asking is only a warning.

create table ish.translation_queue (
  kind text not null check (kind in ('message', 'shift', 'business')),
  -- messages.id, shifts.id or businesses.id as text.
  ref text not null check (char_length(ref) between 1 and 40),
  queued_at timestamptz not null default now(),
  next_at timestamptz not null default now(),
  attempts smallint not null default 0,
  last_error text check (char_length(last_error) <= 500),
  primary key (kind, ref)
);

comment on table ish.translation_queue is
  'Rows waiting for ish-translate (P55). Only the service role and the database''s own code use it.';

create index translation_queue_due_idx on ish.translation_queue (next_at) where attempts < 10;

alter table ish.translation_queue enable row level security;
revoke all on ish.translation_queue from public, anon, authenticated;
grant all on ish.translation_queue to service_role;

-- ---------------------------------------------------------------------------
-- What is translated: the original texts of a row (and what the save checks
-- is unchanged).
-- ---------------------------------------------------------------------------

create function ish.translation_source(m ish.messages)
returns jsonb
language sql
immutable
set search_path = ish
as $$
  select jsonb_build_object('body', m.body, 'lang', m.lang)
$$;

create function ish.translation_source(s ish.shifts)
returns jsonb
language sql
immutable
set search_path = ish
as $$
  select jsonb_build_object('title', s.title, 'duties', s.duties, 'dress', s.dress, 'address', s.address)
$$;

create function ish.translation_source(b ish.businesses)
returns jsonb
language sql
immutable
set search_path = ish
as $$
  select jsonb_build_object('name', b.name, 'area', b.area, 'address', b.address, 'address_detail', b.address_detail)
$$;

create function ish.translation_texts(p_kind text, p_ref text)
returns jsonb
language plpgsql
stable
set search_path = ish
as $$
begin
  if p_kind = 'message' then
    return (select ish.translation_source(m) from ish.messages m where m.id = p_ref::bigint);
  elsif p_kind = 'shift' then
    return (select ish.translation_source(s) from ish.shifts s where s.id = p_ref::uuid);
  elsif p_kind = 'business' then
    return (select ish.translation_source(b) from ish.businesses b where b.id = p_ref::uuid);
  end if;
  return null;
end
$$;

-- ---------------------------------------------------------------------------
-- Into the queue
-- ---------------------------------------------------------------------------

create function ish.translation_queue_row()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
declare
  v_kind text;
begin
  case tg_table_name
    when 'messages' then
      -- Written with its translations (a copy, the tests): nothing to do.
      if new.translations <> '{}'::jsonb then
        return null;
      end if;
      v_kind := 'message';
    when 'shifts' then
      if new.translations <> '{}'::jsonb then
        return null;
      end if;
      if tg_op = 'UPDATE' and (new.title, new.duties, new.dress, new.address)
                              is not distinct from (old.title, old.duties, old.dress, old.address) then
        return null;
      end if;
      v_kind := 'shift';
    when 'businesses' then
      if tg_op = 'UPDATE' then
        if (new.name, new.area, new.address, new.address_detail)
           is not distinct from (old.name, old.area, old.address, old.address_detail) then
          return null;
        end if;
      elsif new.translations <> '{}'::jsonb and new.name_i18n ?& array['uz', 'ru', 'en'] then
        return null;
      end if;
      v_kind := 'business';
  end case;
  insert into ish.translation_queue (kind, ref)
  values (v_kind, new.id::text)
  on conflict (kind, ref) do update
    set queued_at = now(), next_at = now(), attempts = 0, last_error = null;
  return null;
end
$$;

-- Asks one of Hanguk Ish's edge functions (ish-…) to run: a POST with no
-- body, the project's secret key from the vault on `apikey` — as hanguk.uz's
-- pg_cron jobs call theirs. What it is to do waits for it in a table. Without
-- pg_net or the key (the tests, a local stack) it does nothing; an error is
-- only a warning: asking is never worth a failed write.
create function ish.ask_function(p_function text)
returns void
language plpgsql
security definer
set search_path = ish, pg_catalog
as $$
declare
  v_key text;
begin
  if p_function is null or p_function !~ '^ish-[a-z0-9-]{1,40}$' then
    raise exception 'INVALID';
  end if;
  begin
    if to_regclass('vault.decrypted_secrets') is null
       or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'net' and p.proname = 'http_post') then
      return;
    end if;
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into v_key using 'secret_key';
    if coalesce(v_key, '') = '' then
      return;
    end if;
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := $4)'
      using 'https://lysjdtyanhdfphqyijsr.supabase.co/functions/v1/' || p_function,
            '{}'::jsonb,
            jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
            10000;
  exception when others then
    raise warning 'ish.ask_function(%): %', p_function, sqlerrm;
  end;
end
$$;

-- Asks ish-translate to work the queue, when something is due.
create function ish.translation_kick()
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  if exists (select 1 from ish.translation_queue q where q.next_at <= now() and q.attempts < 10) then
    perform ish.ask_function('ish-translate');
  end if;
end
$$;

create function ish.translation_kick_after()
returns trigger
language plpgsql
security definer
set search_path = ish
as $$
begin
  perform ish.translation_kick();
  return null;
end
$$;

create trigger messages_translate after insert on ish.messages
  for each row execute function ish.translation_queue_row();
create trigger messages_translate_kick after insert on ish.messages
  for each statement execute function ish.translation_kick_after();

create trigger shifts_translate after insert or update of title, duties, dress, address on ish.shifts
  for each row execute function ish.translation_queue_row();
create trigger shifts_translate_kick after insert or update of title, duties, dress, address on ish.shifts
  for each statement execute function ish.translation_kick_after();

create trigger businesses_translate after insert or update of name, area, address, address_detail on ish.businesses
  for each row execute function ish.translation_queue_row();
create trigger businesses_translate_kick after insert or update of name, area, address, address_detail on ish.businesses
  for each statement execute function ish.translation_kick_after();

-- ---------------------------------------------------------------------------
-- Out of the queue (the service role: ish-translate)
-- ---------------------------------------------------------------------------

-- Up to [p_limit] due rows with their original texts. Each is pushed back
-- before it is returned (1, 2, 4 … 60 minutes): a try that fails or never
-- reports back is retried then.
create function ish.translation_claim(p_limit int default 10)
returns table (kind text, ref text, attempts int, texts jsonb, hash text)
language plpgsql
set search_path = ish
as $$
#variable_conflict use_column
declare
  r record;
  v_texts jsonb;
begin
  for r in
    with due as (
      select q.kind, q.ref
      from ish.translation_queue q
      where q.next_at <= now() and q.attempts < 10
      order by q.next_at, q.queued_at
      limit greatest(1, least(coalesce(p_limit, 10), 50))
      for update skip locked
    )
    update ish.translation_queue q
    set attempts = q.attempts + 1,
        next_at = now() + make_interval(mins => least(60, (2 ^ q.attempts)::int))
    from due
    where q.kind = due.kind and q.ref = due.ref
    returning q.kind as job_kind, q.ref as job_ref, q.attempts as job_attempts
  loop
    v_texts := ish.translation_texts(r.job_kind, r.job_ref);
    if v_texts is null then
      -- The row is gone (a deleted shift or business).
      delete from ish.translation_queue q where q.kind = r.job_kind and q.ref = r.job_ref;
      continue;
    end if;
    kind := r.job_kind;
    ref := r.job_ref;
    attempts := r.job_attempts;
    texts := v_texts;
    hash := md5(v_texts::text);
    return next;
  end loop;
end
$$;

-- Writes a translation if the original is still [p_hash]'s and takes the row
-- off the queue. False: the text changed (its new row will be translated) or
-- the row is gone. [p_names]: a business's name per language — only where
-- name_i18n has none (the staff's own stays).
create function ish.translation_save(
  p_kind text, p_ref text, p_hash text, p_lang text,
  p_translations jsonb, p_names jsonb default '{}'::jsonb)
returns boolean
language plpgsql
set search_path = ish
as $$
declare
  v_lang text := case when p_lang ~ '^[a-z]{2,3}$' then p_lang end;
  v_translations jsonb := case when jsonb_typeof(p_translations) = 'object' then p_translations else '{}'::jsonb end;
  v_names jsonb := case when jsonb_typeof(p_names) = 'object' then p_names else '{}'::jsonb end;
begin
  if p_kind = 'message' then
    update ish.messages m
    set lang = coalesce(m.lang, v_lang), translations = v_translations
    where m.id = p_ref::bigint and md5(ish.translation_source(m)::text) = p_hash;
  elsif p_kind = 'shift' then
    update ish.shifts s
    set translations = v_translations
    where s.id = p_ref::uuid and md5(ish.translation_source(s)::text) = p_hash;
  elsif p_kind = 'business' then
    update ish.businesses b
    set name_i18n = v_names || b.name_i18n, translations = v_translations
    where b.id = p_ref::uuid and md5(ish.translation_source(b)::text) = p_hash;
  else
    raise exception 'INVALID';
  end if;
  if not found then
    return false;
  end if;
  delete from ish.translation_queue q where q.kind = p_kind and q.ref = p_ref;
  return true;
end
$$;

-- Why the last try failed (the row is retried at its next_at).
create function ish.translation_fail(p_kind text, p_ref text, p_error text)
returns void
language sql
set search_path = ish
as $$
  update ish.translation_queue q
  set last_error = left(coalesce(nullif(p_error, ''), 'unknown'), 500)
  where q.kind = p_kind and q.ref = p_ref;
$$;

-- Every minute (pg_cron): what waits for a retry; rows given up a month ago go.
create function ish.translation_tick()
returns void
language plpgsql
security definer
set search_path = ish
as $$
begin
  delete from ish.translation_queue q where q.attempts >= 10 and q.queued_at < now() - interval '30 days';
  perform ish.translation_kick();
end
$$;

revoke execute on function ish.ask_function(text),
  ish.translation_source(ish.messages), ish.translation_source(ish.shifts),
  ish.translation_source(ish.businesses), ish.translation_texts(text, text), ish.translation_kick(),
  ish.translation_claim(int), ish.translation_save(text, text, text, text, jsonb, jsonb),
  ish.translation_fail(text, text, text), ish.translation_tick()
  from public, anon, authenticated;
grant execute on function ish.translation_source(ish.messages), ish.translation_source(ish.shifts),
  ish.translation_source(ish.businesses), ish.translation_texts(text, text),
  ish.translation_claim(int), ish.translation_save(text, text, text, text, jsonb, jsonb),
  ish.translation_fail(text, text, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ish-translate', '* * * * *', 'select ish.translation_tick()');
  end if;
end
$$;
