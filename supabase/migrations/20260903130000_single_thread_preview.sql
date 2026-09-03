-- Fetch one conversation's preview instead of all of them.
--
-- The inbox listens to realtime and patches rows in place, except in two
-- cases: a brand new thread, and an update for a thread that is not in the
-- list yet. Both called `fetchThreads()` — get_thread_previews with no
-- arguments, every conversation in the database, currently 285 rows each with
-- a lateral join for its last message.
--
-- That is the full-reload cascade the audit named: a message from someone the
-- operator has never spoken to reloads the entire inbox, and it happens more
-- often the busier the school gets. The information actually needed is one row.
--
-- Same shape as get_thread_previews so the client maps both with one function,
-- and same STABLE / invoker-rights posture, so RLS still decides what comes
-- back.

create or replace function public.get_thread_preview(p_id uuid)
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
   WHERE t.id = p_id;
$function$;
