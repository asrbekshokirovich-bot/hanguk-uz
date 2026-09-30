-- Instagram's own automatic template message is not an answer.
--
-- Most Instagram leads come from an ad form: the person sends "Hello! I filled
-- out your form…" and Meta replies by itself a few seconds later with the
-- form's greeting template. The webhook stores that echo as an outgoing
-- message whose content is "[template]" (an attachment of type "template").
-- Nobody at Hanguk wrote it, but fn_mark_lead_contacted_on_reply took it for a
-- reply: every such lead left "Yangi lid" within seconds of arriving, and
-- fn_after_hours_reply_claim skipped its after-hours reply as "already
-- answered". Since 2026-09-29 23:41 eleven leads were hidden that way with no
-- real answer at all.
--
-- 1. Both functions now ignore a template echo, exactly like the automatic
--    after-hours reply.
-- 2. The hidden leads come back to "Yangi lid" (last_contacted_at cleared)
--    when their chat has no real outgoing message; the owner asked for them
--    back with the usual alerts.
-- 3. The after-hours replies those leads were denied overnight are closed, not
--    sent: it is working hours now and "bugun soat 10:00 da" would be wrong.

-- True for a message nobody at Hanguk wrote: Meta's template echo, or our own
-- after-hours reply.
create or replace function public.fn_is_automatic_outgoing(p_content text, p_metadata jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_catalog'
as $$
  select trim(coalesce(p_content, '')) like '[template]%'
      or coalesce(p_metadata->'attachments'->0->>'type', '') = 'template'
      or trim(coalesce(p_content, '')) = any (public.fn_after_hours_reply_texts())
$$;

-- As in 20260929120000_lead_after_hours.sql, with the automatic check widened.
create or replace function public.fn_mark_lead_contacted_on_reply()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lead_id uuid;
begin
  if new.direction <> 'outgoing' or new.source not in ('instagram', 'telegram') then
    return new;
  end if;

  -- Not written by us: Instagram's template echo, or the after-hours reply.
  if public.fn_is_automatic_outgoing(new.content, new.metadata) then
    return new;
  end if;

  select ci.lead_id into v_lead_id
    from public.communication_identities ci
   where ci.channel = new.source
     and ci.identifier = new.sender_id
     and ci.lead_id is not null
   limit 1;

  if v_lead_id is null then
    select l.id into v_lead_id
      from public.leads l
     where l.source = new.source
       and l.source_id = new.sender_id
     limit 1;
  end if;

  if v_lead_id is null then
    return new;
  end if;

  -- Only a lead still waiting in "Yangi lid"; nothing else is touched.
  update public.leads
     set last_contacted_at = new.created_at,
         updated_at = now()
   where id = v_lead_id
     and new_lead_at is not null
     and last_contacted_at is null
     -- A backfilled reply from before the lead existed is not a reply to it;
     -- the minute of slack covers Telegram's whole-second timestamps.
     and new.created_at >= new_lead_at - interval '1 minute';

  return new;
end;
$$;

-- As in 20260929170000_after_hours_reply_wait_for_quiet.sql, except that an
-- automatic outgoing message does not count as "answered by hand".
create or replace function public.fn_after_hours_reply_claim(p_dry boolean default false)
returns table(id uuid, source text, source_id text, reply_text text)
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if p_dry then
    return query
    select null::uuid, q.source, q.sender_id, q.reply_text
    from public.after_hours_reply_queue q
    where q.claimed_at is null
      and q.arrived_at > now() - interval '1 day'
      and coalesce(q.last_incoming_at, q.arrived_at) <= now() - interval '2 minutes'
      and not exists (
        select 1 from public.messages m
         where m.source = q.source
           and m.sender_id = q.sender_id
           and m.direction = 'outgoing'
           and m.created_at >= q.arrived_at - interval '1 minute'
           and not public.fn_is_automatic_outgoing(m.content, m.metadata)
      );
    return;
  end if;

  return query
  update public.after_hours_reply_queue q
  set claimed_at = now()
  where q.claimed_at is null
    and q.arrived_at > now() - interval '1 day'
    and coalesce(q.last_incoming_at, q.arrived_at) <= now() - interval '2 minutes'
    and not exists (
      select 1 from public.messages m
       where m.source = q.source
         and m.sender_id = q.sender_id
         and m.direction = 'outgoing'
         and m.created_at >= q.arrived_at - interval '1 minute'
         and not public.fn_is_automatic_outgoing(m.content, m.metadata)
    )
  returning null::uuid, q.source, q.sender_id, q.reply_text;
end;
$function$;

-- 3. Close the overnight replies that were held back by the template echo.
update public.after_hours_reply_queue
   set claimed_at = now()
 where claimed_at is null
   and arrived_at < now() - interval '1 hour';

-- 2. Bring back the leads the template echo hid, when nobody has really
-- answered them.
update public.leads l
   set last_contacted_at = null,
       updated_at = now()
 where l.new_lead_at > now() - interval '7 days'
   and l.last_contacted_at is not null
   and l.call_result is null
   and l.status not in ('converted', 'lost')
   and l.converted_to_student_id is null
   and not exists (
     select 1 from public.messages m
      where m.source = l.source
        and m.sender_id = l.source_id
        and m.direction = 'outgoing'
        and m.created_at >= l.new_lead_at - interval '1 minute'
        and not public.fn_is_automatic_outgoing(m.content, m.metadata)
   );
