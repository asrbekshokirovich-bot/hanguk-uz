-- Local test for 20261111210000_thread_previews_definer.sql.
--
--   createdb tp_test && psql -v ON_ERROR_STOP=1 -d tp_test \
--     -f supabase/tests/thread_previews_definer.test.sql
--
-- A stub of the inbox tables with the production policies, the function as it
-- was (runs as the caller, row-level security does the filtering), then the
-- migration — and for each kind of account the same rows before and after.
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
alter role service_role bypassrls;

create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create type public.app_role as enum ('owner', 'admin', 'call_operator', 'document_handler', 'investor', 'student');
create table public.user_roles (user_id uuid not null, role public.app_role not null, unique (user_id, role));
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
  language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create function public.is_investor(p_uid uuid default auth.uid()) returns boolean
  language sql stable security definer set search_path to 'public' as $$
  select public.has_role(p_uid, 'investor'::public.app_role) $$;
create function public.fn_is_inbox_staff(p_uid uuid default auth.uid()) returns boolean
  language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.user_roles r where r.user_id = p_uid
                  and r.role::text in ('owner', 'admin', 'call_operator', 'document_handler')) $$;
create function public.fn_message_is_hidden(p_source text, p_content text, p_message_type text, p_metadata jsonb)
  returns boolean language sql immutable as $$
  select coalesce(p_message_type, '') = 'note' or coalesce(p_metadata ->> 'internal', '') = 'true' $$;
create function public.fn_is_automatic_outgoing(p_content text, p_metadata jsonb) returns boolean
  language sql immutable as $$ select coalesce(p_metadata ->> 'auto_reply', '') not in ('', 'false') $$;

create table public.message_threads (
  id uuid primary key default gen_random_uuid(), source text not null, sender_id text not null,
  sender_name text, sender_avatar text, student_id uuid, last_message_at timestamptz not null default now(),
  unread_count integer not null default 0, status text, intake_id uuid, assigned_to uuid,
  kind text, handle text, archived_at timestamptz, unique (source, sender_id));
create table public.messages (
  id uuid primary key default gen_random_uuid(), source text not null, sender_id text not null,
  content text, message_type text, direction text, created_at timestamptz not null default now(),
  delivery_status text, metadata jsonb);
create index idx_messages_thread_time on public.messages (source, sender_id, created_at desc, id desc);
create table public.leads (id uuid primary key default gen_random_uuid(), source text, source_id text);
create table public.communication_identities (channel text, identifier text, lead_id uuid);

-- The production policies (2026-11-11), word for word where it matters.
alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;
alter table public.communication_identities enable row level security;
create policy "Staff can view all threads" on public.message_threads for select to public using (
  has_role((select auth.uid()), 'owner') or has_role((select auth.uid()), 'admin')
  or has_role((select auth.uid()), 'call_operator') or has_role((select auth.uid()), 'document_handler'));
create policy deny_investor_all on public.message_threads as restrictive for all to authenticated
  using (not is_investor()) with check (not is_investor());
create policy "Staff can view all messages" on public.messages for select to public using (
  has_role((select auth.uid()), 'owner') or has_role((select auth.uid()), 'admin')
  or has_role((select auth.uid()), 'call_operator') or has_role((select auth.uid()), 'document_handler'));
create policy deny_investor_all on public.messages as restrictive for all to authenticated
  using (not is_investor()) with check (not is_investor());
create policy staff_leads on public.leads for select to public using (fn_is_inbox_staff() and not is_investor());
create policy staff_ci on public.communication_identities for select to public using (fn_is_inbox_staff());
grant select on all tables in schema public to anon, authenticated, service_role;

create type public.thread_preview as (
  id uuid, source text, sender_id text, sender_name text, sender_avatar text, student_id uuid,
  last_message_at timestamptz, unread_count integer, status text, intake_id uuid,
  last_content text, last_message_type text, last_direction text, last_created_at timestamptz,
  last_delivery_status text, last_metadata jsonb, assigned_to uuid, kind text, handle text,
  archived_at timestamptz, lead_id uuid, last_incoming_at timestamptz, last_human_out_at timestamptz);

-- The function as production has it: SECURITY INVOKER.
create function public.get_thread_previews(p_id uuid default null)
returns setof public.thread_preview language sql stable set search_path to 'public', 'pg_catalog' as $$
  select t.id, t.source, t.sender_id, t.sender_name, t.sender_avatar,
         t.student_id, t.last_message_at, t.unread_count, t.status, t.intake_id,
         lm.content, lm.message_type, lm.direction, lm.created_at, lm.delivery_status, lm.metadata,
         t.assigned_to, t.kind, t.handle, t.archived_at,
         coalesce(
           (select ci.lead_id from public.communication_identities ci
             where ci.channel = t.source and ci.identifier = t.sender_id and ci.lead_id is not null limit 1),
           (select l.id from public.leads l where l.source = t.source and l.source_id = t.sender_id limit 1)),
         li.created_at, lh.created_at
    from public.message_threads t
    left join lateral (select m.content, m.message_type, m.direction, m.created_at, m.delivery_status, m.metadata
        from public.messages m where m.source = t.source and m.sender_id = t.sender_id
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
       order by m.created_at desc, m.id desc limit 1) lm on true
    left join lateral (select m.created_at from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id and m.direction = 'incoming'
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
       order by m.created_at desc, m.id desc limit 1) li on true
    left join lateral (select m.created_at from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id and m.direction = 'outgoing'
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
         and not public.fn_is_automatic_outgoing(m.content, m.metadata)
       order by m.created_at desc, m.id desc limit 1) lh on true
   where p_id is null or t.id = p_id
   order by t.last_message_at desc;
$$;
grant execute on function public.get_thread_previews(uuid) to anon, authenticated, service_role;

-- Data: 300 threads, five messages each (a note, an automatic reply, incoming and outgoing), leads both ways.
insert into public.user_roles values
  ('00000000-0000-0000-0000-00000000000a', 'owner'), ('00000000-0000-0000-0000-00000000000b', 'admin'),
  ('00000000-0000-0000-0000-00000000000c', 'call_operator'), ('00000000-0000-0000-0000-00000000000d', 'document_handler'),
  ('00000000-0000-0000-0000-00000000000e', 'investor'),
  ('00000000-0000-0000-0000-00000000000f', 'investor'), ('00000000-0000-0000-0000-00000000000f', 'admin');
insert into public.message_threads (source, sender_id, sender_name, last_message_at, unread_count)
  select case when g % 2 = 0 then 'telegram' else 'instagram' end, g::text, 'Odam ' || g, now() - make_interval(mins => g), g % 3
    from generate_series(1, 300) g;
insert into public.messages (source, sender_id, content, message_type, direction, created_at, metadata)
  select t.source, t.sender_id, 'xabar ' || n,
         case when n = 5 then 'note' else 'text' end,
         case when n % 2 = 0 then 'outgoing' else 'incoming' end,
         t.last_message_at - make_interval(mins => 6 - n),
         case when n = 4 then '{"auto_reply": "true"}'::jsonb else '{}'::jsonb end
    from public.message_threads t cross join generate_series(1, 5) n;
insert into public.leads (source, source_id) select source, sender_id from public.message_threads where sender_id::int % 5 = 0;
insert into public.communication_identities (channel, identifier, lead_id)
  select t.source, t.sender_id, gen_random_uuid() from public.message_threads t where t.sender_id::int % 7 = 0;

create table public._seen (phase text, persona text, n bigint, digest text);
create function public._look(p_phase text) returns void language plpgsql as $$
declare p record; v_n bigint; v_h text;
begin
  for p in select * from (values
      ('anon', 'anon', null::uuid), ('nobody', 'authenticated', '00000000-0000-0000-0000-0000000000ff'::uuid),
      ('owner', 'authenticated', '00000000-0000-0000-0000-00000000000a'), ('admin', 'authenticated', '00000000-0000-0000-0000-00000000000b'),
      ('call_operator', 'authenticated', '00000000-0000-0000-0000-00000000000c'), ('document_handler', 'authenticated', '00000000-0000-0000-0000-00000000000d'),
      ('investor', 'authenticated', '00000000-0000-0000-0000-00000000000e'), ('investor+admin', 'authenticated', '00000000-0000-0000-0000-00000000000f'),
      ('service_role', 'service_role', null)) x(persona, role, uid)
  loop
    perform set_config('request.jwt.claim.sub', coalesce(p.uid::text, ''), true);
    perform set_config('request.jwt.claim.role', p.role, true);
    begin
      execute format('set local role %I', p.role);
      select count(*), md5(coalesce(string_agg(md5(t::text), ',' order by t.id), '')) into v_n, v_h
        from public.get_thread_previews() t;
      reset role;
    exception when insufficient_privilege then
      reset role; v_n := -1; v_h := 'denied';
    end;
    insert into public._seen values (p_phase, p.persona, v_n, v_h);
  end loop;
end $$;

select public._look('before');
\i supabase/migrations/20261111210000_thread_previews_definer.sql
select public._look('after');

do $$
declare r record; v_bad text;
begin
  for r in select b.persona, b.n as before_n, a.n as after_n, b.digest = a.digest as same
             from public._seen b join public._seen a on a.persona = b.persona and a.phase = 'after' where b.phase = 'before' order by 1
  loop
    raise notice '%: before % rows, after % rows, same=%', rpad(r.persona, 18), r.before_n, r.after_n, r.same;
  end loop;

  -- Staff see everything, exactly as before; an investor (even one who is also an admin) and strangers see nothing.
  select string_agg(b.persona, ', ') into v_bad
    from public._seen b join public._seen a on a.persona = b.persona and a.phase = 'after'
   where b.phase = 'before' and b.persona <> 'anon' and (b.n <> a.n or b.digest <> a.digest);
  assert v_bad is null, 'results changed for: ' || v_bad;
  assert (select n from public._seen where phase = 'after' and persona = 'owner') = 300;
  assert (select n from public._seen where phase = 'after' and persona = 'document_handler') = 300;
  assert (select n from public._seen where phase = 'after' and persona = 'investor') = 0;
  assert (select n from public._seen where phase = 'after' and persona = 'investor+admin') = 0;
  assert (select n from public._seen where phase = 'after' and persona = 'nobody') = 0;
  assert (select n from public._seen where phase = 'after' and persona = 'service_role') = 300;
  -- anon: no rows before (policies), no right to call it at all after.
  assert (select n from public._seen where phase = 'before' and persona = 'anon') = 0;
  assert (select n from public._seen where phase = 'after' and persona = 'anon') = -1;
  assert not has_function_privilege('anon', 'public.get_thread_previews(uuid)', 'execute');
  assert has_function_privilege('authenticated', 'public.get_thread_previews(uuid)', 'execute');
end $$;

-- One thread by id still works, and the preview skips the note and the automatic reply.
do $$
declare v_id uuid; r public.thread_preview;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select id into v_id from public.message_threads where sender_id = '35';
  set local role authenticated;
  select * into r from public.get_thread_previews(v_id);
  reset role;
  assert r.id = v_id;
  assert r.last_content = 'xabar 4', 'last visible message (the note is hidden), got ' || coalesce(r.last_content, 'null');
  assert r.last_human_out_at is not null and r.last_human_out_at < r.last_created_at, 'the automatic reply is not a human answer';
  assert r.lead_id is not null, 'lead found through communication_identities or leads';
end $$;

\echo ALL TESTS PASSED
