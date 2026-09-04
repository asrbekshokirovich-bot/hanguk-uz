-- The badge counts webhook calls, not messages.
--
-- 2026-09-03 made `messages.status` agree with `message_threads.unread_count`
-- and called the job done. It was half a job: the two numbers were reconciled
-- once, but the counter kept being maintained the way it always was — by
-- `upsert_message_thread`, which the webhook calls before it inserts anything
-- and which does `unread_count + 1` unconditionally. Nothing checks that a
-- message row actually appeared.
--
-- So every retried delivery, every duplicate update and every edit event adds
-- one. On 2026-09-04 the thread "Komuna" held ten messages in total and a
-- badge reading 190. Two more sat at 188 and 186. A badge like that is worse
-- than no badge: the operator learns to ignore it, and then misses the real
-- ones.
--
-- The fix is not a better increment. A number kept in two places by two
-- different rules will always drift; the only counter that cannot lie is one
-- that is derived. So `unread_count` stops being written by the webhook and
-- becomes a function of the messages themselves, maintained by a trigger.
-- "Unread" keeps the meaning fixed on 2026-09-03 — incoming, not yet answered
-- or opened — because that is the one that means "waiting on us".
--
-- Applied to production 2026-09-04: 661 badge-units across the inbox became
-- 98, matching `messages.status` exactly, zero threads mismatched, and the
-- worst single thread went from 190 to 9.

-- ---------------------------------------------------------------------------
-- 1. The counter follows the messages
-- ---------------------------------------------------------------------------

create or replace function public.sync_thread_unread()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_source    text;
  v_sender_id text;
begin
  -- One function for insert, update and delete: whichever row survives tells
  -- us which thread to recount.
  v_source    := coalesce(new.source, old.source);
  v_sender_id := coalesce(new.sender_id, old.sender_id);

  if v_source is null or v_sender_id is null then
    return coalesce(new, old);
  end if;

  update public.message_threads t
     set unread_count = (
           select count(*)
             from public.messages m
            where m.source = v_source
              and m.sender_id = v_sender_id
              and m.direction = 'incoming'
              and m.status = 'unread'
         )
   where t.source = v_source
     and t.sender_id = v_sender_id;

  return coalesce(new, old);
end;
$$;

-- Named `trg_z_...` deliberately: Postgres fires triggers in name order, and
-- this must run after `trg_mark_answered_on_outgoing`, which flips earlier
-- inbound messages to 'read' when a reply lands. Recounting first would
-- produce a number that is already stale by the end of the statement.
drop trigger if exists trg_z_sync_thread_unread on public.messages;
create trigger trg_z_sync_thread_unread
  after insert or delete or update of status, direction, source, sender_id
  on public.messages
  for each row execute function public.sync_thread_unread();

-- ---------------------------------------------------------------------------
-- 2. The webhook stops keeping its own tally
-- ---------------------------------------------------------------------------
-- Same signature, same behaviour for everything else — callers do not change.
-- It simply no longer touches `unread_count`: on a new thread the column takes
-- its default and the trigger corrects it the moment the message row lands,
-- and on an existing thread it is left alone entirely.

create or replace function public.upsert_message_thread(
  p_source text,
  p_sender_id text,
  p_sender_name text,
  p_sender_avatar text,
  p_student_id uuid,
  p_last_message_at timestamptz,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.message_threads
    (source, sender_id, sender_name, sender_avatar, student_id, last_message_at, unread_count, status)
  values
    (p_source, p_sender_id, p_sender_name, p_sender_avatar, p_student_id,
     coalesce(p_last_message_at, now()), 0, 'active')
  on conflict (source, sender_id) do update set
    last_message_at = greatest(message_threads.last_message_at, excluded.last_message_at),
    sender_name     = coalesce(excluded.sender_name, message_threads.sender_name),
    sender_avatar   = coalesce(excluded.sender_avatar, message_threads.sender_avatar),
    student_id      = coalesce(message_threads.student_id, excluded.student_id);
  -- unread_count is derived; see sync_thread_unread().
end;
$function$;

comment on column public.message_threads.unread_count is
  'Derived from public.messages by trigger trg_z_sync_thread_unread. Never write this column directly — a second writer is how it reached 190 on a ten-message thread.';

-- ---------------------------------------------------------------------------
-- 3. Correct what the old rule inflated
-- ---------------------------------------------------------------------------

update public.message_threads t
   set unread_count = c.n
  from (
    select t2.id,
           (select count(*)
              from public.messages m
             where m.source = t2.source
               and m.sender_id = t2.sender_id
               and m.direction = 'incoming'
               and m.status = 'unread') as n
      from public.message_threads t2
  ) c
 where c.id = t.id
   and t.unread_count is distinct from c.n;
