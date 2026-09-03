-- Give the 226 existing Instagram conversations somebody to belong to.
--
-- instagram-webhook now creates a lead on first contact, but that only helps
-- messages that arrive from today. Every conversation already in the database
-- is still anonymous: 226 threads, 0 linked, because identity resolution only
-- ever worked through a phone number and Instagram does not carry one.
--
-- Two passes, in this order, because the cheap mistake here is creating a
-- second record for a person the office already knows:
--
--   1. Name match. 21 of these threads carry a display name that is exactly
--      one existing lead's name. Those are attached to that lead — no new
--      record — as `inferred`, since a name match is evidence and not proof.
--   2. Everyone else gets a new lead keyed on (source, source_id) = the IGSID,
--      the same key the webhook uses, so the two paths converge instead of
--      racing.
--
-- A display name matching TWO OR MORE leads is left alone deliberately: the
-- database cannot tell which one it is, and guessing would silently attach a
-- stranger's conversation to a real student's record. Those threads stay
-- unlinked for staff to attach with the new button in Messages.
--
-- Idempotent: a thread that already has an identity row is skipped, so
-- re-running this changes nothing.

do $$
declare
  v_linked  int := 0;
  v_created int := 0;
  v_skipped int := 0;
begin
  -- Pass 1: unambiguous name match to an existing lead.
  with candidate as (
    select
      t.sender_id,
      t.sender_name,
      (
        select l.id from public.leads l
        where lower(trim(l.full_name)) = lower(trim(t.sender_name))
        limit 1
      ) as lead_id,
      (
        select count(*) from public.leads l
        where lower(trim(l.full_name)) = lower(trim(t.sender_name))
      ) as match_count
    from public.message_threads t
    where t.source = 'instagram'
      and coalesce(trim(t.sender_name), '') <> ''
      and not exists (
        select 1 from public.communication_identities ci
        where ci.channel = 'instagram' and ci.identifier = t.sender_id
      )
  )
  insert into public.communication_identities
    (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
  select
    'instagram', c.sender_id, c.sender_name, c.lead_id, c.sender_name,
    'inferred', 'import',
    'Backfill 2026-09-03: matched an existing lead by exact display name.'
  from candidate c
  where c.match_count = 1
  on conflict (channel, identifier) do nothing;

  get diagnostics v_linked = row_count;

  -- Pass 2: everyone still unattached gets their own lead.
  with orphan as (
    select
      t.sender_id,
      coalesce(nullif(trim(t.sender_name), ''), 'IG ' || right(t.sender_id, 6)) as display_name,
      (
        select count(*) from public.leads l
        where lower(trim(l.full_name)) = lower(trim(t.sender_name))
      ) as match_count
    from public.message_threads t
    where t.source = 'instagram'
      and not exists (
        select 1 from public.communication_identities ci
        where ci.channel = 'instagram' and ci.identifier = t.sender_id
      )
  ),
  eligible as (
    -- match_count >= 2 is the ambiguous case described above: leave it.
    -- (match_count = 1 rows were attached by pass 1 and no longer appear here.)
    select * from orphan where coalesce(match_count, 0) < 2
  ),
  new_lead as (
    insert into public.leads (full_name, source, source_id, status, contact_channel, notes)
    select
      e.display_name, 'instagram', e.sender_id, 'new', 'instagram',
      'Instagram suhbatidan avtomatik yaratilgan (backfill 2026-09-03).'
    from eligible e
    where not exists (
      select 1 from public.leads l
      where l.source = 'instagram' and l.source_id = e.sender_id
    )
    returning id, source_id
  ),
  resolved as (
    select e.sender_id, e.display_name,
           coalesce(
             (select id from new_lead n where n.source_id = e.sender_id),
             (select l.id from public.leads l
               where l.source = 'instagram' and l.source_id = e.sender_id limit 1)
           ) as lead_id
    from eligible e
  )
  insert into public.communication_identities
    (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
  select
    'instagram', r.sender_id, r.display_name, r.lead_id, r.display_name,
    'unverified', 'import',
    'Backfill 2026-09-03: lead created from the Instagram conversation.'
  from resolved r
  where r.lead_id is not null
  on conflict (channel, identifier) do nothing;

  get diagnostics v_created = row_count;

  select count(*) into v_skipped
  from public.message_threads t
  where t.source = 'instagram'
    and not exists (
      select 1 from public.communication_identities ci
      where ci.channel = 'instagram' and ci.identifier = t.sender_id
    );

  raise notice 'instagram backfill: % linked to existing leads, % new leads, % left for manual linking',
    v_linked, v_created, v_skipped;
end;
$$;

-- Carry the link onto the threads and messages themselves where the person
-- turned out to be a student. (For leads the identity row is the link —
-- message_threads has no lead_id column.)
update public.message_threads t
   set student_id = ci.student_id
  from public.communication_identities ci
 where ci.channel = 'instagram'
   and ci.identifier = t.sender_id
   and ci.student_id is not null
   and t.source = 'instagram'
   and t.student_id is null;

update public.messages m
   set student_id = ci.student_id
  from public.communication_identities ci
 where ci.channel = 'instagram'
   and ci.identifier = m.sender_id
   and ci.student_id is not null
   and m.source = 'instagram'
   and m.student_id is null;
