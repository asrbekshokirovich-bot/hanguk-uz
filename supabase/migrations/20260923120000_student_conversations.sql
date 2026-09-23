-- A student's Telegram, Instagram and phone history on the student card.
--
-- When a lead signs a contract it becomes a student (profiles row), but the
-- conversations stayed behind on the lead: on 2026-09-23 the 11 chat
-- identities of converted leads had no student_id, and 104 of 107 students
-- had no lead link at all because they predate the leads module. Three
-- pieces:
--
--   1. attach_student_conversations(): the "Suhbatlarni qo'shish" button.
--      Finds the student's leads (the one converted into them, plus any lead
--      sharing one of the student's phones) and moves those leads' chats and
--      calls onto the student, back-filling the messages already stored.
--   2. A trigger so it keeps happening on its own: an identity that points at
--      a converted lead gets the student too, and converting a lead attaches
--      its history at that moment.
--   3. student_timeline() and link_student_channel(), the student-side twins
--      of lead_timeline() and link_lead_channel().
--
-- Nothing here takes a conversation away from a different student.

-- Digits of a phone, last nine — the same key the lead matchers use.
create or replace function public.phone_key(txt text)
returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(txt, ''), '[^0-9]', '', 'g'), 9), '');
$$;

-- Every phone we know for a student, as phone keys.
create or replace function public.student_phone_keys(p_student_id uuid)
returns table (k text) language sql stable security definer set search_path = public as $$
  select distinct k from (
    select public.phone_key(p.phone) as k from profiles p where p.user_id = p_student_id
    union all
    select public.phone_key(p.additional_phone) from profiles p where p.user_id = p_student_id
    union all
    select public.phone_key(sp.phone_norm) from student_phones sp where sp.student_id = p_student_id
    union all
    select public.phone_key(sc.value) from student_contacts sc
     where sc.student_id = p_student_id and sc.type in ('phone', 'whatsapp')
  ) s where length(k) = 9;
$$;

-- 1. The work, without the permission check (the trigger calls this too) --
create or replace function public._attach_student_conversations(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_leads     uuid[];
  v_idents    int := 0;
  v_conflicts int := 0;
  v_msgs      int := 0;
  v_calls     int := 0;
  v_phone     int := 0;
  v_k         text;
begin
  if not exists (select 1 from profiles where user_id = p_student_id) then
    raise exception 'student not found';
  end if;

  -- The student's leads: the converted one, and any sharing a phone with them.
  select array_agg(distinct l.id) into v_leads
    from leads l
   where l.converted_to_student_id = p_student_id
      or public.phone_key(l.phone) in (select s.k from public.student_phone_keys(p_student_id) s);

  -- Chats that belong to those leads now belong to the student as well.
  -- lead_id stays: the lead profile keeps showing its own history.
  if v_leads is not null then
    update communication_identities
       set student_id = p_student_id, updated_at = now()
     where lead_id = any (v_leads) and student_id is null;
    get diagnostics v_idents = row_count;

    select count(*) into v_conflicts
      from communication_identities
     where lead_id = any (v_leads) and student_id is not null and student_id <> p_student_id;
  end if;

  -- The student's own phones as phone identities, so a call from any of them
  -- lands on the card.
  for v_k in select s.k from public.student_phone_keys(p_student_id) s loop
    insert into communication_identities
      (channel, identifier, identifier_label, student_id, confidence, source, notes)
    values ('phone', '+998' || v_k, '+998' || v_k, p_student_id, 'confirmed', 'staff',
            'Talaba kartasidagi raqam')
    on conflict (channel, identifier) do update
      set student_id = excluded.student_id, updated_at = now()
      where communication_identities.student_id is null;
    if found then v_phone := v_phone + 1; end if;
  end loop;

  -- Back-fill what is already stored: the insert-time trigger only stamps
  -- student_id on messages that arrive after the identity knows the student.
  update messages m
     set student_id = p_student_id
    from communication_identities ci
   where ci.student_id = p_student_id
     and m.source = ci.channel and m.sender_id = ci.identifier
     and m.student_id is null;
  get diagnostics v_msgs = row_count;

  update message_threads t
     set student_id = p_student_id
    from communication_identities ci
   where ci.student_id = p_student_id
     and t.source = ci.channel and t.sender_id = ci.identifier
     and t.student_id is null;

  update calls c
     set student_id = p_student_id
   where c.student_id is null
     and ((v_leads is not null and c.lead_id = any (v_leads))
          or public.phone_key(c.phone_number) in (select s.k from public.student_phone_keys(p_student_id) s));
  get diagnostics v_calls = row_count;

  return jsonb_build_object(
    'leads', coalesce(array_length(v_leads, 1), 0),
    'identities', v_idents,
    'phones', v_phone,
    'messages', v_msgs,
    'calls', v_calls,
    'conflicts', v_conflicts);
end;
$$;

revoke all on function public._attach_student_conversations(uuid) from public, anon, authenticated;

-- The button.
create or replace function public.attach_student_conversations(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from user_roles r
     where r.user_id = auth.uid()
       and r.role = any (array['owner'::app_role, 'admin'::app_role,
                               'call_operator'::app_role, 'document_handler'::app_role])
  ) then
    raise exception 'forbidden';
  end if;
  return public._attach_student_conversations(p_student_id);
end;
$$;

revoke all on function public.attach_student_conversations(uuid) from public, anon;
grant execute on function public.attach_student_conversations(uuid) to authenticated;

-- 2. Keep it automatic ------------------------------------------------------
-- An identity pointing at a lead that has already become a student belongs
-- to that student too. BEFORE, so the very row being written carries it and
-- the messages trigger stamps student_id on the next message.
create or replace function public.identity_inherit_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Joined through profiles: 33 of the 36 converted leads on 2026-09-23
  -- pointed at student accounts that had since been deleted, and copying such
  -- an id would fail the student_id foreign key and reject the whole insert.
  if new.student_id is null and new.lead_id is not null then
    select p.user_id into new.student_id
      from leads l
      join profiles p on p.user_id = l.converted_to_student_id
     where l.id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_identity_inherit_student on public.communication_identities;
create trigger trg_identity_inherit_student
  before insert or update of lead_id on public.communication_identities
  for each row execute function public.identity_inherit_student();

-- The moment a lead is converted, its history follows.
create or replace function public.lead_converted_attach()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.converted_to_student_id is not null
     and new.converted_to_student_id is distinct from old.converted_to_student_id
     and exists (select 1 from profiles where user_id = new.converted_to_student_id) then
    perform public._attach_student_conversations(new.converted_to_student_id);
  end if;
  return null;
exception when others then
  -- Converting a lead must never fail because of this; the button can redo it.
  raise warning 'lead_converted_attach: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_lead_converted_attach on public.leads;
create trigger trg_lead_converted_attach
  after update of converted_to_student_id on public.leads
  for each row execute function public.lead_converted_attach();

-- 3a. One feed for the student card -----------------------------------------
create or replace function public.student_timeline(p_student_id uuid, p_limit int default 500)
returns table (
  id text, channel text, direction text, at timestamptz,
  author text, body text, seconds int, status text
)
language sql stable security definer set search_path = public as $$
  with chat as (
    select m.id::text, m.source, m.direction, m.created_at,
           coalesce(m.sender_name, '') as author, m.content,
           null::int as seconds, null::text as status
      from communication_identities ci
      join messages m on m.source = ci.channel and m.sender_id = ci.identifier
     where ci.student_id = p_student_id and ci.channel in ('telegram', 'instagram')
       and m.content is not null
  ),
  phone as (
    select c.id::text, 'phone', c.direction, c.started_at, '',
           coalesce(t.full_text, ''), coalesce(c.duration, 0)::int, c.status
      from calls c
      left join call_transcripts t on t.call_id = c.id
     where c.student_id = p_student_id
  )
  select * from (select * from chat union all select * from phone) u
  order by u.created_at desc limit p_limit;
$$;

revoke all on function public.student_timeline(uuid, int) from public, anon;
grant execute on function public.student_timeline(uuid, int) to authenticated;

-- 3b. Link a student's Telegram / Instagram by username or ID ----------------
-- Same rules as link_lead_channel(), minus the "remember it for later" part:
-- a profile has no handle columns, so a username we have never seen is
-- reported back rather than stored. A Telegram numeric ID still links at
-- once, because it is the chat identifier itself.
create or replace function public.link_student_channel(
  p_student_id uuid,
  p_channel    text,
  p_value      text,
  p_force      boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v        text := public.normalize_handle(p_value);
  v_is_id  boolean;
  v_idents text[];
  v_ident  text;
  v_ci     record;
  v_name   text;
  v_linked int := 0;
  v_conf   jsonb := '[]'::jsonb;
  v_msgs   int := 0;
begin
  if not exists (
    select 1 from user_roles r
     where r.user_id = auth.uid()
       and r.role = any (array['owner'::app_role, 'admin'::app_role,
                               'call_operator'::app_role, 'document_handler'::app_role])
  ) then
    raise exception 'forbidden';
  end if;
  if p_channel not in ('telegram', 'instagram') then
    raise exception 'unsupported channel %', p_channel;
  end if;
  select full_name into v_name from profiles where user_id = p_student_id;
  if not found then raise exception 'student not found'; end if;
  if v is null then
    return jsonb_build_object('status', 'cleared');
  end if;

  v_is_id := v ~ '^[0-9]{5,}$';

  select array_agg(distinct x) into v_idents from (
    select v as x
     where v_is_id and (
       p_channel = 'telegram'
       or exists (select 1 from messages m where m.source = p_channel and m.sender_id = v)
       or exists (select 1 from communication_identities ci where ci.channel = p_channel and ci.identifier = v))
    union
    select ci.identifier from communication_identities ci
     where not v_is_id and ci.channel = p_channel and lower(ci.identifier_label) = '@' || v
    union
    select m.sender_id from messages m
     where not v_is_id and m.source = p_channel and m.direction = 'incoming'
       and lower(m.metadata ->> 'username') = v
  ) s where x is not null;

  if v_idents is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not v_is_id and array_length(v_idents, 1) > 1 then
    return jsonb_build_object(
      'status', 'ambiguous',
      'candidates', (
        select jsonb_agg(jsonb_build_object(
                 'identifier', i,
                 'name', (select t.sender_name from message_threads t
                           where t.source = p_channel and t.sender_id = i limit 1),
                 'messages', (select count(*) from messages m
                               where m.source = p_channel and m.sender_id = i)))
          from unnest(v_idents) i));
  end if;

  foreach v_ident in array v_idents loop
    select ci.id, ci.student_id, p.full_name as cur_name
      into v_ci
      from communication_identities ci
      left join profiles p on p.user_id = ci.student_id
     where ci.channel = p_channel and ci.identifier = v_ident;

    if not found then
      insert into communication_identities
        (channel, identifier, identifier_label, student_id, display_name, confidence, source, notes)
      values
        (p_channel, v_ident, case when v_is_id then null else '@' || v end, p_student_id, v_name,
         'confirmed', 'staff', 'Operator talaba kartasida kiritdi');
      v_linked := v_linked + 1;
    elsif v_ci.student_id is null or v_ci.student_id = p_student_id or p_force then
      update communication_identities
         set student_id = p_student_id, confidence = 'confirmed', updated_at = now()
       where id = v_ci.id;
      v_linked := v_linked + 1;
    else
      v_conf := v_conf || jsonb_build_object(
        'identifier', v_ident, 'lead_id', null, 'name', v_ci.cur_name, 'is_student', true);
    end if;
  end loop;

  -- Stamp the history that is already stored.
  update messages m set student_id = p_student_id
   where m.source = p_channel and m.sender_id = any (v_idents) and m.student_id is null;
  update message_threads t set student_id = p_student_id
   where t.source = p_channel and t.sender_id = any (v_idents) and t.student_id is null;

  select count(*) into v_msgs
    from messages m where m.source = p_channel and m.sender_id = any (v_idents);

  return jsonb_build_object(
    'status', case when jsonb_array_length(v_conf) > 0 then 'conflict' else 'linked' end,
    'linked', v_linked, 'messages', v_msgs, 'conflicts', v_conf);
end;
$$;

revoke all on function public.link_student_channel(uuid, text, text, boolean) from public, anon;
grant execute on function public.link_student_channel(uuid, text, text, boolean) to authenticated;
