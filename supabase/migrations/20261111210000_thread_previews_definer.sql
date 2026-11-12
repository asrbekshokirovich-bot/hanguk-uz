-- The CRM inbox list (get_thread_previews) takes 0.6–0.9 s on the database for
-- 1111 conversations — 1.5 s on average with the network — and it is read on
-- every inbox refresh (pg_stat_statements, 2026-11-11: 1125 calls, 1730 s).
--
-- The query itself is fast: as the table owner it runs in 0.14–0.18 s. The
-- rest is row-level security. The function runs as the caller, so for every
-- thread and every message it touches Postgres calls has_role() three or four
-- times and is_investor() once — the policies on message_threads, messages,
-- leads and communication_identities all ask the same question about the same
-- person, several thousand times over.
--
-- The answer never depends on the row: someone on the inbox staff (owner,
-- admin, call_operator, document_handler) who is not an investor sees every
-- thread; anyone else sees none. So the function now asks once
-- (fn_can_read_inbox) and reads the tables as their owner.
--
-- Checked on production data on 2026-11-11, read-only: for an account of each
-- kind — anon, guest, student, investor, owner, admin, call_operator,
-- document_handler — the old function and the new body behind the guard return
-- the same rows to the byte (md5 over all 1111), 0.64–0.86 s → 0.17–0.18 s.
--
-- Also: leads had no index for the «which lead is this chat» lookup
-- (source, source_id) — a sequential scan of leads for every thread that has
-- no communication_identities row.

create or replace function public.fn_can_read_inbox()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
  -- Exactly what the SELECT policies on message_threads and messages allow:
  -- the four inbox roles, never an investor — and server code calling with
  -- the secret key, which those policies do not bind. The question is asked
  -- of the request's token, not of the database session: from the SQL editor
  -- (no token) the answer is no; read the tables there instead.
  select coalesce(auth.role(), '') = 'service_role'
      or (public.fn_is_inbox_staff() and not public.is_investor());
$$;

revoke all on function public.fn_can_read_inbox() from public, anon;
grant execute on function public.fn_can_read_inbox() to authenticated, service_role;

create or replace function public.get_thread_previews(p_id uuid default null)
returns setof public.thread_preview
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
  select t.id, t.source, t.sender_id, t.sender_name, t.sender_avatar,
         t.student_id, t.last_message_at, t.unread_count, t.status, t.intake_id,
         lm.content, lm.message_type, lm.direction, lm.created_at,
         lm.delivery_status, lm.metadata,
         t.assigned_to,
         t.kind, t.handle, t.archived_at,
         coalesce(
           (select ci.lead_id from public.communication_identities ci
             where ci.channel = t.source and ci.identifier = t.sender_id and ci.lead_id is not null
             limit 1),
           (select l.id from public.leads l
             where l.source = t.source and l.source_id = t.sender_id
             limit 1)
         ) as lead_id,
         li.created_at as last_incoming_at,
         lh.created_at as last_human_out_at
    from public.message_threads t
    -- Last visible message: the preview line.
    left join lateral (
      select m.content, m.message_type, m.direction, m.created_at,
             m.delivery_status, m.metadata
        from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
       order by m.created_at desc, m.id desc
       limit 1
    ) lm on true
    -- When the person last wrote.
    left join lateral (
      select m.created_at
        from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id
         and m.direction = 'incoming'
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
       order by m.created_at desc, m.id desc
       limit 1
    ) li on true
    -- When a PERSON on our side last answered (bot, after-hours and Meta
    -- instant replies do not count).
    left join lateral (
      select m.created_at
        from public.messages m
       where m.source = t.source and m.sender_id = t.sender_id
         and m.direction = 'outgoing'
         and not public.fn_message_is_hidden(m.source, m.content, m.message_type, m.metadata)
         and not public.fn_is_automatic_outgoing(m.content, m.metadata)
       order by m.created_at desc, m.id desc
       limit 1
    ) lh on true
   where (p_id is null or t.id = p_id)
     -- asked once for the whole call, not once per row
     and (select public.fn_can_read_inbox())
   order by t.last_message_at desc;
$$;

-- It reads past row-level security now: nobody without a session may call it.
revoke all on function public.get_thread_previews(uuid) from public, anon;
grant execute on function public.get_thread_previews(uuid) to authenticated, service_role;

create index if not exists idx_leads_source_source_id
  on public.leads (source, source_id)
  where source_id is not null;
