-- Fix: a chat identity that already belongs to a phone-less "shadow" lead
-- blocks the phone match forever ----------------------------------------
--
-- `link_chat_identities_by_phone()` only ever INSERTed a new identity row
-- and walked away on conflict. That is correct the first time a customer
-- is seen. It stops being correct once some other process (the 2026-09-03
-- Instagram/Telegram backfill, in this case) has already created an
-- identity row for that same channel handle pointing at a throwaway lead
-- with no phone on it — a customer who called or filled the intake form
-- first, then messaged us on Instagram, ends up split into two lids: the
-- real one and an empty one holding their actual conversation. The old
-- function saw the conflict and silently did nothing, so the split never
-- healed even after the customer typed their own number into the chat.
--
-- The fix is narrow on purpose: an identity is only ever moved when the
-- lead it currently points to has NO phone on file. A lead with its own
-- phone on record — even a different one — is never touched; that is a
-- human question (wrong number typed, shared phone, etc.), not something
-- this function should silently resolve. Verified before this migration:
-- of 209 identities whose lead's phone didn't match the number typed in
-- chat, 84 had a genuine other lead already on file with that number
-- (this is those 84); the remaining 125 had no such lead and are left
-- exactly as they were.
create or replace function public.link_chat_identities_by_phone()
returns table (out_channel text, out_inserted integer, out_relinked integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with found as (
    select distinct on (m.source, m.sender_id)
           m.source as ch, m.sender_id as ident, m.sender_name as dname,
           public.extract_uz_phone(m.content) as phone
    from messages m
    where m.direction = 'incoming' and m.content is not null
      and m.source in ('telegram', 'instagram')
      and public.extract_uz_phone(m.content) is not null
    order by m.source, m.sender_id, m.created_at
  ),
  matched as (
    select f.ch, f.ident, f.dname, l.id as lead_id
    from found f
    join lateral (
      select id from leads
      where right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = f.phone
      order by created_at desc limit 1
    ) l on true
  ),
  upserted as (
    insert into communication_identities
      (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
    select mt.ch, mt.ident, mt.dname, mt.lead_id, mt.dname,
           'inferred', 'auto', 'Mijoz telefon raqamini yozishmada o''zi yozgan'
    from matched mt
    on conflict (channel, identifier) do update
      set lead_id = excluded.lead_id,
          notes = 'Qayta bog''landi: mijoz telefon raqamini yozishmada o''zi yozgan, avvalgi lid raqamsiz edi (' || to_char(now(), 'YYYY-MM-DD') || ')'
      where communication_identities.lead_id is distinct from excluded.lead_id
        and (select l2.phone from leads l2 where l2.id = communication_identities.lead_id) is null
    returning communication_identities.channel as ch,
              (xmax = 0) as was_insert
  )
  select u.ch,
         count(*) filter (where u.was_insert)::integer,
         count(*) filter (where not u.was_insert)::integer
  from upserted u
  group by u.ch;
end;
$$;

comment on function public.link_chat_identities_by_phone() is
  'Links Telegram/Instagram senders to a lead by a phone number the customer typed themselves. '
  'Re-points an identity away from a phone-less shadow lead when a better match appears, but never '
  'moves one off a lead that already has its own phone on file. Scheduled hourly (see below); safe to run by hand too.';

-- Run it hourly so a customer who messages before their intake-form phone
-- exists in leads (or the reverse order) gets merged within the hour
-- instead of waiting for someone to notice the split and run this by hand.
do $$
begin
  perform cron.unschedule('link-chat-identities-hourly')
  where exists (select 1 from cron.job where jobname = 'link-chat-identities-hourly');

  -- Plain SQL, no HTTP round trip needed: the function already runs
  -- security definer inside the database.
  perform cron.schedule(
    'link-chat-identities-hourly',
    '10 * * * *',
    $job$select public.link_chat_identities_by_phone();$job$
  );
end;
$$;
