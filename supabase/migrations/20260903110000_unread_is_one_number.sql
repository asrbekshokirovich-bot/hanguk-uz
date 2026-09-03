-- Make "unread" mean one thing.
--
-- It currently means two, and they disagree by a factor of twenty. The inbox
-- badge reads `message_threads.unread_count`, which `upsert_message_thread`
-- maintains: +1 per inbound message, reset to 0 on any outbound one. The
-- messages themselves carry `status`, which the CRM sets to 'read' when a
-- thread is opened. Nothing ever reconciled the two, so on 2026-09-03 the
-- badges totalled 73 while 1,680 messages still sat at status='unread'.
--
-- The gap is not a counting error, it is a missing rule. Staff answer most
-- conversations from their phone, not from the CRM: an outbound message
-- arrives through the webhook, the counter is zeroed — correctly, we replied —
-- and the inbound messages it answered are left marked unread forever. Six
-- months of that is the 1,680.
--
-- WHICH ONE IS RIGHT
--
-- The counter is. "Unread" for a shared inbox means *waiting on us*, and
-- replying settles everything that came before, wherever the reply was typed.
-- Counted that way the real figure is 68 messages across 34 conversations,
-- against the 73 the badges already show — the badges were roughly right and
-- `status` was the column that had drifted.
--
-- So `status` is brought into line with the counter, and a trigger keeps it
-- there: sending closes out what it answered. Nothing about what the operator
-- sees changes today; what changes is that the two numbers can no longer
-- separate, and a report written against `messages.status` stops being wrong.

-- ---------------------------------------------------------------------------
-- 1. Replying marks what it answered as read
-- ---------------------------------------------------------------------------

create or replace function public.mark_answered_on_outgoing()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.direction <> 'outgoing' then
    return new;
  end if;

  -- Everything this thread received up to the moment we replied is answered.
  -- `<=` rather than `<`: an outbound message stamped at the same instant as
  -- an inbound one still comes after it in intent.
  update public.messages m
     set status = 'read'
   where m.source = new.source
     and m.sender_id = new.sender_id
     and m.direction = 'incoming'
     and m.status = 'unread'
     and m.created_at <= new.created_at;

  return new;
end;
$$;

drop trigger if exists trg_mark_answered_on_outgoing on public.messages;
create trigger trg_mark_answered_on_outgoing
  after insert on public.messages
  for each row execute function public.mark_answered_on_outgoing();

-- ---------------------------------------------------------------------------
-- 2. Opening a thread in the CRM: one call, one truth
-- ---------------------------------------------------------------------------
-- The client used to fire two independent updates and discard both results —
-- `messages` to 'read' and `message_threads.unread_count` to 0 — so if either
-- were ever refused there was nothing to notice it by. One function, one
-- round trip, and an error the caller can actually see.
--
-- SECURITY INVOKER on purpose: RLS decides whether this caller may mark this
-- conversation read, exactly as it did when the client issued the updates.

create or replace function public.mark_thread_read(p_source text, p_sender_id text)
returns integer
language plpgsql
as $$
declare
  v_marked integer;
begin
  update public.messages
     set status = 'read'
   where source = p_source
     and sender_id = p_sender_id
     and direction = 'incoming'
     and status = 'unread';
  get diagnostics v_marked = row_count;

  update public.message_threads
     set unread_count = 0
   where source = p_source
     and sender_id = p_sender_id
     and unread_count <> 0;

  return v_marked;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Retire increment_thread_unread without breaking a forgotten caller
-- ---------------------------------------------------------------------------
-- Instagram's webhook was the last thing calling this; it now uses
-- upsert_message_thread like every other channel, which carries the student
-- link and the direction instead of assuming "inbound, anonymous". Rather than
-- dropping the function — a forgotten caller would then lose messages, which
-- is worse than the bug — it becomes a wrapper, so anything still calling it
-- gets the correct behaviour.

create or replace function public.increment_thread_unread(
  p_source text, p_sender_id text, p_sender_name text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.upsert_message_thread(
    p_source, p_sender_id, p_sender_name, null, null, now(), 'incoming'
  );
end;
$$;

comment on function public.increment_thread_unread(text, text, text) is
  'DEPRECATED 2026-09-03 — wrapper over upsert_message_thread. New code must call that directly and pass the direction and student link.';

revoke execute on function public.increment_thread_unread(text, text, text) from public, anon, authenticated;
grant execute on function public.increment_thread_unread(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. One-time reconciliation
-- ---------------------------------------------------------------------------
-- Apply the rule retroactively: an inbound message older than our latest reply
-- in that conversation was answered, whatever its status column says. Then
-- rebuild every counter from what survives, so the badge and the rows agree
-- from this point on.

with last_out as (
  select source, sender_id, max(created_at) as last_out_at
    from public.messages
   where direction = 'outgoing'
   group by source, sender_id
)
update public.messages m
   set status = 'read'
  from last_out lo
 where m.source = lo.source
   and m.sender_id = lo.sender_id
   and m.direction = 'incoming'
   and m.status = 'unread'
   and m.created_at <= lo.last_out_at;

update public.message_threads t
   set unread_count = coalesce((
     select count(*) from public.messages m
      where m.source = t.source
        and m.sender_id = t.sender_id
        and m.direction = 'incoming'
        and m.status = 'unread'
   ), 0)
 where t.unread_count is distinct from coalesce((
     select count(*) from public.messages m
      where m.source = t.source
        and m.sender_id = t.sender_id
        and m.direction = 'incoming'
        and m.status = 'unread'
   ), 0);

-- Counting unread per thread is now a real query rather than a stored guess,
-- so give it an index narrow enough to stay cheap.
create index if not exists idx_messages_unread_incoming
  on public.messages (source, sender_id)
  where direction = 'incoming' and status = 'unread';
