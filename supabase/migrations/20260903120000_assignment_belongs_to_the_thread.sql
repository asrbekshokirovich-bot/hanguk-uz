-- Claiming a conversation should write one row, not every row.
--
-- "Assigned to" is a fact about a conversation: this operator is handling it.
-- It was stored on `messages.assigned_to`, once per message, so claiming a
-- thread meant `update messages set assigned_to = ... where source = ? and
-- sender_id = ?` — rewriting every message the person has ever sent. A busy
-- conversation is hundreds of rows; each one fires the messages triggers and
-- lands in the realtime stream, so a single click on Claim broadcasts hundreds
-- of UPDATE events to every CRM tab in the building.
--
-- Reading it back cost as much. `get_thread_previews` carried a LATERAL
-- subquery per thread — "the assignee of the most recent message that has
-- one" — because there was nowhere else to look. That is 285 extra index scans
-- on every inbox load to answer a question with one answer per thread.
--
-- The column moves to where the fact lives. `messages.assigned_to` stays: it
-- is a real record of who handled a given message at the time, and rewriting
-- history to tidy up would destroy that.

alter table public.message_threads
  add column if not exists assigned_to uuid,
  add column if not exists assigned_at timestamptz;

comment on column public.message_threads.assigned_to is
  'Operator handling this conversation. Authoritative; messages.assigned_to is per-message history.';

-- Who is handling each conversation right now, according to the old model:
-- the assignee of its most recent assigned message.
update public.message_threads t
   set assigned_to = a.assigned_to,
       assigned_at = a.created_at
  from (
    select distinct on (m.source, m.sender_id)
           m.source, m.sender_id, m.assigned_to, m.created_at
      from public.messages m
     where m.assigned_to is not null
     order by m.source, m.sender_id, m.created_at desc
  ) a
 where a.source = t.source
   and a.sender_id = t.sender_id
   and t.assigned_to is null;

create index if not exists idx_message_threads_assigned
  on public.message_threads (assigned_to) where assigned_to is not null;

-- The preview RPC can now read the answer instead of deriving it. One lateral
-- join disappears from every inbox load; the backfill above guarantees the
-- column already holds what the lateral would have returned.
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
         t.assigned_to
    FROM public.message_threads t
    LEFT JOIN LATERAL (
      SELECT m.content, m.message_type, m.direction, m.created_at,
             m.delivery_status, m.metadata
        FROM public.messages m
       WHERE m.source = t.source AND m.sender_id = t.sender_id
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 1
    ) lm ON true
   ORDER BY t.last_message_at DESC;
$function$;
