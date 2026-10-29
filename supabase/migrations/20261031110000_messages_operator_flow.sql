-- Xabarlar (CRM inbox) — operator ish oqimi.
--
-- Audit 2026-10-29 findings fixed here, database side:
--   2/6  auto-assign: the first reply written by a known staff member takes
--        an unclaimed conversation (CRM sends and anything carrying a staff
--        user id). Phone replies through the shared account carry no person
--        and cannot be attributed — the UI labels them "telefondan".
--   4    create_lead_from_thread(): a chat with no lead gets one in a click,
--        with the phone number the person typed, linked to the chat.
--   5    search_threads(): name, phone (any 4+ digits, matched on the END of
--        the number), @username and message text, across every tab.
--  16    saved_replies: the five hard-coded templates become rows staff can
--        edit from Settings; {{ism}} is replaced with the person's first name.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.fn_is_inbox_staff(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_roles r
     where r.user_id = p_uid
       and r.role::text in ('owner', 'admin', 'call_operator', 'document_handler')
  )
$$;

create or replace function public.fn_is_inbox_manager(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_roles r
     where r.user_id = p_uid and r.role::text in ('owner', 'admin')
  )
$$;

grant execute on function public.fn_is_inbox_staff(uuid) to authenticated;
grant execute on function public.fn_is_inbox_manager(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. saved_replies
-- ---------------------------------------------------------------------------
create table if not exists public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  title text not null,
  body text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_replies_key_format check (key ~ '^/[a-z0-9_-]{1,24}$')
);
create unique index if not exists saved_replies_key_unique on public.saved_replies (lower(key));

alter table public.saved_replies enable row level security;

drop policy if exists saved_replies_staff_read on public.saved_replies;
create policy saved_replies_staff_read on public.saved_replies
  for select to authenticated
  using (public.fn_is_inbox_staff());

drop policy if exists saved_replies_manager_write on public.saved_replies;
create policy saved_replies_manager_write on public.saved_replies
  for all to authenticated
  using (public.fn_is_inbox_manager())
  with check (public.fn_is_inbox_manager());

create or replace function public.fn_saved_replies_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_saved_replies_touch on public.saved_replies;
create trigger trg_saved_replies_touch
  before insert or update on public.saved_replies
  for each row execute function public.fn_saved_replies_touch();

-- The five texts that were hard-coded in src/components/crm/messages/savedReplies.ts,
-- word for word. Editing them is now a Settings task, not a deploy.
insert into public.saved_replies (key, title, body, sort_order) values
  ('/docs',  'Hujjatlar ro‘yxati',      'Assalomu alaykum! Kerakli hujjatlar: 1) Pasport nusxasi 2) Attestat + apostil 3) TOPIK sertifikati (agar bo‘lsa).', 10),
  ('/apos',  'Apostil muddati',         'Apostil odatda 5–7 ish kuni oladi. Viloyat bo‘limlari ham qabul qiladi.', 20),
  ('/pay',   'To‘lov ko‘rsatmalari',    'To‘lov: Standard reja 5M UZS. Kvitansiyani shu yerga rasm qilib yuboring.', 30),
  ('/call',  'Konsultatsiyaga yozilish', 'Sizga qulay vaqtni ayting — konsultant bilan qo‘ng‘iroqni belgilaymiz.', 40),
  ('/topik', 'TOPIK talab qilinmaydi',  'Bu universitet uchun TOPIK majburiy emas, lekin ball qo‘shadi.', 50)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Auto-assign on the first reply by a known person
-- ---------------------------------------------------------------------------
create or replace function public.fn_assign_thread_on_reply()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_user uuid;
begin
  if new.direction <> 'outgoing' then
    return new;
  end if;
  if coalesce(new.message_type, '') = 'note' or coalesce(new.metadata ->> 'internal', '') = 'true' then
    return new;
  end if;
  if public.fn_is_automatic_outgoing(new.content, new.metadata) then
    return new;
  end if;
  v_user := coalesce(
    new.replied_by,
    case when (new.metadata ->> 'staff_user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then (new.metadata ->> 'staff_user_id')::uuid end
  );
  if v_user is null then
    return new;
  end if;
  update public.message_threads
     set assigned_to = v_user, assigned_at = now()
   where source = new.source and sender_id = new.sender_id
     and assigned_to is null;
  return new;
end;
$$;

drop trigger if exists trg_assign_thread_on_reply on public.messages;
create trigger trg_assign_thread_on_reply
  after insert on public.messages
  for each row execute function public.fn_assign_thread_on_reply();

-- ---------------------------------------------------------------------------
-- 3. Search across every conversation
-- ---------------------------------------------------------------------------
create or replace function public.search_threads(p_query text, p_limit integer default 60)
returns table (thread_id uuid, matched text, snippet text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_q text := trim(coalesce(p_query, ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_like text;
  v_handle text;
begin
  if not public.fn_is_inbox_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(v_q) < 2 then
    return;
  end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_handle := ltrim(v_q, '@');

  return query
  with hits as (
    -- name / handle on the thread
    select t.id, 'name'::text as matched, coalesce(t.sender_name, t.handle) as snippet, 1 as rank
      from public.message_threads t
     where t.sender_name ilike v_like or t.handle ilike '%' || v_handle || '%'
    union all
    -- the lead's name or phone
    select t.id,
           case when length(v_digits) >= 4 and regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') like '%' || v_digits
                then 'phone' else 'lead' end,
           coalesce(l.full_name, '') || coalesce(' · ' || l.phone, ''),
           2
      from public.message_threads t
      join public.communication_identities ci
        on ci.channel = t.source and ci.identifier = t.sender_id and ci.lead_id is not null
      join public.leads l on l.id = ci.lead_id
     where l.full_name ilike v_like
        or (length(v_digits) >= 4 and regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') like '%' || v_digits)
    union all
    select t.id,
           case when length(v_digits) >= 4 then 'phone' else 'lead' end,
           coalesce(l.full_name, '') || coalesce(' · ' || l.phone, ''),
           2
      from public.message_threads t
      join public.leads l on l.source = t.source and l.source_id = t.sender_id
     where l.full_name ilike v_like
        or (length(v_digits) >= 4 and regexp_replace(coalesce(l.phone, ''), '\D', '', 'g') like '%' || v_digits)
    union all
    -- the student's name or phone
    select t.id, 'student', coalesce(p.full_name, '') || coalesce(' · ' || p.phone, ''), 2
      from public.message_threads t
      join public.profiles p on p.user_id = t.student_id
     where p.full_name ilike v_like
        or (length(v_digits) >= 4 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || v_digits)
    union all
    -- what was written (a phone number typed into the chat included)
    select t.id, 'message', left(m.content, 120), 3
      from public.messages m
      join public.message_threads t on t.source = m.source and t.sender_id = m.sender_id
     where m.content ilike v_like
        or (length(v_digits) >= 7 and regexp_replace(m.content, '\D', '', 'g') like '%' || v_digits || '%')
  )
  select distinct on (h.id) h.id, h.matched, h.snippet
    from hits h
   order by h.id, h.rank
   limit greatest(1, least(coalesce(p_limit, 60), 200));
end;
$$;

revoke all on function public.search_threads(text, integer) from public;
grant execute on function public.search_threads(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Create (or find) the lead behind a conversation
-- ---------------------------------------------------------------------------
create or replace function public.create_lead_from_thread(p_thread_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_t public.message_threads;
  v_lead uuid;
  v_phone text;
begin
  if not exists (
    select 1 from public.user_roles r
     where r.user_id = auth.uid() and r.role::text in ('owner', 'admin', 'call_operator')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_t from public.message_threads where id = p_thread_id;
  if v_t.id is null then
    raise exception 'thread not found' using errcode = 'P0002';
  end if;

  select ci.lead_id into v_lead
    from public.communication_identities ci
   where ci.channel = v_t.source and ci.identifier = v_t.sender_id and ci.lead_id is not null
   limit 1;
  if v_lead is null then
    select l.id into v_lead from public.leads l
     where l.source = v_t.source and l.source_id = v_t.sender_id
     limit 1;
  end if;

  if v_lead is null then
    -- The first number the person typed into the chat, if any.
    select public.fn_extract_phone(m.content) into v_phone
      from public.messages m
     where m.source = v_t.source and m.sender_id = v_t.sender_id
       and m.direction = 'incoming'
       and public.fn_extract_phone(m.content) is not null
     order by m.created_at
     limit 1;

    insert into public.leads (full_name, phone, source, source_id, status, contact_channel, created_by)
    values (
      coalesce(nullif(trim(v_t.sender_name), ''), coalesce('@' || v_t.handle, v_t.source || ' ' || v_t.sender_id)),
      v_phone,
      v_t.source,
      v_t.sender_id,
      'new',
      case v_t.source when 'telegram' then 'Telegram' when 'instagram' then 'instagram' else v_t.source end,
      auth.uid()
    )
    returning id into v_lead;
  end if;

  insert into public.communication_identities
    (channel, identifier, identifier_label, lead_id, display_name, confidence, source, attached_by)
  values
    (v_t.source, v_t.sender_id, case when v_t.handle is not null then '@' || v_t.handle end,
     v_lead, v_t.sender_name, 'confirmed', 'manual', auth.uid())
  on conflict (channel, identifier) do update
    set lead_id = coalesce(communication_identities.lead_id, excluded.lead_id),
        updated_at = now();

  return v_lead;
end;
$$;

revoke all on function public.create_lead_from_thread(uuid) from public;
grant execute on function public.create_lead_from_thread(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The conversation of a lead (lead profile → "Chatni ochish")
-- ---------------------------------------------------------------------------
create or replace function public.lead_threads(p_lead_id uuid)
returns table (thread_id uuid, source text, last_message_at timestamptz)
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
  select t.id, t.source, t.last_message_at
    from public.message_threads t
   where public.fn_is_inbox_staff()
     and (
       exists (select 1 from public.communication_identities ci
                where ci.channel = t.source and ci.identifier = t.sender_id and ci.lead_id = p_lead_id)
       or exists (select 1 from public.leads l
                   where l.id = p_lead_id and l.source = t.source and l.source_id = t.sender_id)
     )
   order by t.last_message_at desc;
$$;

revoke all on function public.lead_threads(uuid) from public;
grant execute on function public.lead_threads(uuid) to authenticated;
