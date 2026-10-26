-- App analytics, stage 3 — D5 (2026-10-22): a lead's owner is the first
-- staff account that answers it. The marketing plan sends the app's BUGUN
-- signals to "the lead's owner", but only 50 of 1 111 leads have one
-- (leads.assigned_to): from now on the account that first writes to the lead
-- (Telegram or Instagram, not an automatic message — fn_is_automatic_outgoing)
-- or calls it (a call, or a note of a contact other than a plain note)
-- becomes its owner, when it has none. There are no separate operator logins
-- (Q47), so the owner is an account. Leads that already have an owner keep
-- it; nothing is filled in backwards.

-- Makes [p_user] the owner of [p_lead] if the lead has none and the user is
-- staff (owner, admin, call operator, documents).
create or replace function public.fn_lead_take_owner(p_lead uuid, p_user uuid)
returns void
language sql
security definer
set search_path to 'pg_catalog', 'public'
as $$
  update public.leads l
     set assigned_to = p_user, updated_at = now()
   where l.id = p_lead
     and l.assigned_to is null
     and p_user is not null
     and exists (select 1 from public.user_roles r
                  where r.user_id = p_user
                    and r.role = any (array['owner', 'admin', 'call_operator', 'document_handler']::public.app_role[]));
$$;

revoke all on function public.fn_lead_take_owner(uuid, uuid) from public, anon, authenticated;

-- An outgoing message: who wrote it (the CRM's replied_by, or the Telegram
-- account's staff user the userbot records), and whose chat it is.
create or replace function public.trg_lead_owner_from_message()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_user uuid;
  v_lead uuid;
begin
  if new.direction <> 'outgoing' or new.source not in ('instagram', 'telegram') then
    return new;
  end if;
  if public.fn_is_automatic_outgoing(new.content, new.metadata) then
    return new;
  end if;
  v_user := coalesce(new.replied_by,
                     case when (new.metadata ->> 'staff_user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                          then (new.metadata ->> 'staff_user_id')::uuid end);
  if v_user is null then
    return new;
  end if;

  select ci.lead_id into v_lead
    from public.communication_identities ci
   where ci.channel = new.source and ci.identifier = new.sender_id and ci.lead_id is not null
   limit 1;
  if v_lead is null then
    select l.id into v_lead from public.leads l where l.source = new.source and l.source_id = new.sender_id limit 1;
  end if;
  if v_lead is null and (new.metadata ->> 'lead_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_lead := (new.metadata ->> 'lead_id')::uuid;
  end if;
  if v_lead is not null then
    perform public.fn_lead_take_owner(v_lead, v_user);
  end if;
  return new;
end;
$$;

create or replace function public.trg_lead_owner_from_call()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  perform public.fn_lead_take_owner(new.lead_id, new.staff_id);
  return new;
end;
$$;

create or replace function public.trg_lead_owner_from_note()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  perform public.fn_lead_take_owner(new.lead_id, new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_lead_owner_from_message on public.messages;
create trigger trg_lead_owner_from_message
  after insert on public.messages
  for each row execute function public.trg_lead_owner_from_message();

drop trigger if exists trg_lead_owner_from_call on public.calls;
create trigger trg_lead_owner_from_call
  after insert on public.calls
  for each row when (new.lead_id is not null and new.staff_id is not null)
  execute function public.trg_lead_owner_from_call();

drop trigger if exists trg_lead_owner_from_note on public.lead_notes;
create trigger trg_lead_owner_from_note
  after insert on public.lead_notes
  for each row when (coalesce(new.contact_type, 'note') <> 'note')
  execute function public.trg_lead_owner_from_note();
