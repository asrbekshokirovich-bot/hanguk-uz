-- CRM "Investor" desk: answering investor messages and recording payouts.
--
-- Audit 2026-10-26: an investor's message reached nobody. There was no CRM
-- screen for the staff member on the thread, no notification, and no UPDATE
-- policy on investor_messages, so "mark as read" silently did nothing on
-- either side. Payouts had a table (owner may write) but no screen.
--
-- This migration adds:
--   1. a notification (mentions row) to the staff member when the investor
--      writes, so it shows in the CRM bell;
--   2. mark_investor_thread_read(thread) - the only way read_at moves, for
--      either participant, only on messages the other side sent;
--   3. staff_investor_threads() - the staff member's own threads (owner: all)
--      with the investor's name, which staff cannot read from `investors`.

-- 1. Notify the staff member on the thread when the investor writes.
create or replace function public.notify_investor_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_staff uuid;
begin
  select t.staff_user_id into v_staff
    from public.investor_threads t
   where t.id = new.thread_id;

  if v_staff is not null and v_staff <> new.sender_user_id then
    insert into public.mentions (mentioned_user_id, mentioned_by, context_type, context_id, content_preview)
    values (v_staff, new.sender_user_id, 'investor_message', new.thread_id, left(new.body, 140));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_investor_message on public.investor_messages;
create trigger trg_notify_investor_message
  after insert on public.investor_messages
  for each row execute function public.notify_investor_message();

-- 2. Mark the other side's messages in a thread as read.
create or replace function public.mark_investor_thread_read(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_n integer;
begin
  if not exists (
    select 1 from public.investor_threads t
     where t.id = p_thread_id
       and (t.staff_user_id = auth.uid() or t.investor_id = public.current_investor_id())
  ) then
    raise exception 'Bu suhbatga ruxsat yo''q' using errcode = '42501';
  end if;

  update public.investor_messages
     set read_at = now()
   where thread_id = p_thread_id
     and read_at is null
     and sender_user_id <> auth.uid();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.mark_investor_thread_read(uuid) from public, anon;
grant execute on function public.mark_investor_thread_read(uuid) to authenticated;

-- 3. The staff member's threads, with the investor's name.
create or replace function public.staff_investor_threads()
returns table (
  thread_id        uuid,
  investor_id      uuid,
  investor_name    text,
  staff_user_id    uuid,
  staff_name       text,
  last_message_at  timestamptz,
  preview          text,
  unread           integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id,
         t.investor_id,
         inv.full_name,
         t.staff_user_id,
         sp.full_name,
         t.last_message_at,
         (select m.body from public.investor_messages m
           where m.thread_id = t.id order by m.created_at desc limit 1),
         (select count(*)::integer from public.investor_messages m
           where m.thread_id = t.id and m.read_at is null and m.sender_user_id <> t.staff_user_id)
    from public.investor_threads t
    join public.investors inv on inv.id = t.investor_id
    left join public.profiles sp on sp.user_id = t.staff_user_id
   where public.is_staff_user(auth.uid())
     and (t.staff_user_id = auth.uid() or public.has_role(auth.uid(), 'owner'::public.app_role))
   order by t.last_message_at desc;
$$;

revoke all on function public.staff_investor_threads() from public, anon;
grant execute on function public.staff_investor_threads() to authenticated;
