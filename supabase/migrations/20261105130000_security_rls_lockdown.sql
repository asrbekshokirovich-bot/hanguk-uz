-- Security lockdown (audit 2026-11-05, K3 K4 Y2 Y4 Y5 Y6).
--
-- 1. user_roles: nobody may grant themselves a role. Owners manage every
--    role; admins only the operational ones. Roles are otherwise written by
--    service-role edge functions (create-staff, delete-staff).
-- 2. lead_channel_overview, lead_timeline, student_timeline: only inbox staff
--    (owner/admin/call_operator/document_handler) or the service role get rows.
--    They were readable without signing in.
-- 3. RPCs that anon/any signed-in user could execute without a check:
--    EXECUTE revoked where only cron/service code calls them; staff check added
--    where the CRM calls them.
-- 4. profiles: a non-staff user updating their own row can no longer change
--    service fields (role, contract/payment data, magic_code, username, SIP…).
-- 5. Investors are denied contract_cancellations and student_contacts.

-- Shared helper: true when the request carries the service_role JWT.
create or replace function public.fn_is_service_request()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

-- ---------------------------------------------------------------------------
-- 1. user_roles
-- ---------------------------------------------------------------------------
drop policy if exists user_roles_owner_insert on public.user_roles;
drop policy if exists user_roles_owner_update on public.user_roles;
drop policy if exists user_roles_owner_delete on public.user_roles;
drop policy if exists "Admins can manage all roles" on public.user_roles;

create policy "Admins manage operational roles"
  on public.user_roles
  for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and role::text in ('call_operator', 'document_handler', 'university_staff')
  )
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and role::text in ('call_operator', 'document_handler', 'university_staff')
  );

-- ---------------------------------------------------------------------------
-- 2. Lead / student communication views and timelines
-- ---------------------------------------------------------------------------
create or replace view public.lead_channel_overview as
with chat as (
  select ci.lead_id, m.source as channel, count(*) as messages, max(m.created_at) as last_at
    from communication_identities ci
    join messages m on m.source = ci.channel and m.sender_id = ci.identifier
   where ci.lead_id is not null and ci.channel = any (array['telegram'::text, 'instagram'::text])
   group by ci.lead_id, m.source
), phone as (
  select c.lead_id, 'phone'::text as channel, count(*) as messages, max(c.started_at) as last_at
    from calls c
   where c.lead_id is not null
   group by c.lead_id
), all_ch as (
  select chat.lead_id, chat.channel, chat.messages, chat.last_at from chat
  union all
  select phone.lead_id, phone.channel, phone.messages, phone.last_at from phone
), sugg as (
  select lead_field_suggestions.lead_id,
         count(*) filter (where lead_field_suggestions.status = 'pending'::text) as pending_suggestions,
         max(lead_field_suggestions.created_at) as last_analysis_at
    from lead_field_suggestions
   group by lead_field_suggestions.lead_id
)
select l.id as lead_id,
       l.full_name,
       l.phone,
       coalesce(sum(a.messages) filter (where a.channel = 'phone'::text), 0::numeric)::integer as calls,
       coalesce(sum(a.messages) filter (where a.channel = 'telegram'::text), 0::numeric)::integer as telegram_messages,
       coalesce(sum(a.messages) filter (where a.channel = 'instagram'::text), 0::numeric)::integer as instagram_messages,
       max(a.last_at) filter (where a.channel = 'phone'::text) as last_call_at,
       max(a.last_at) filter (where a.channel = 'telegram'::text) as last_telegram_at,
       max(a.last_at) filter (where a.channel = 'instagram'::text) as last_instagram_at,
       max(a.last_at) as last_contact_at,
       count(distinct a.channel)::integer as channels_used,
       coalesce(max(s.pending_suggestions), 0::bigint)::integer as pending_suggestions,
       max(s.last_analysis_at) as last_analysis_at
  from leads l
  left join all_ch a on a.lead_id = l.id
  left join sugg s on s.lead_id = l.id
 where (public.fn_is_inbox_staff() or public.fn_is_service_request())
 group by l.id, l.full_name, l.phone;

revoke all on public.lead_channel_overview from anon;
revoke insert, update, delete, truncate, references, trigger on public.lead_channel_overview from authenticated;
grant select on public.lead_channel_overview to authenticated, service_role;

create or replace function public.lead_timeline(p_lead_id uuid, p_limit integer default 500)
returns table(id text, channel text, direction text, at timestamp with time zone, author text, body text, seconds integer, status text)
language sql
stable
security definer
set search_path = public
as $$
  with chat as (
    select m.id::text,
           m.source,
           m.direction,
           m.created_at,
           coalesce(m.sender_name, '') as author,
           m.content,
           null::int  as seconds,
           null::text as status
    from communication_identities ci
    join messages m
      on m.source = ci.channel
     and m.sender_id = ci.identifier
    where ci.lead_id = p_lead_id
      and ci.channel in ('telegram','instagram')
      and m.content is not null
  ),
  phone as (
    select c.id::text,
           'phone' as source,
           c.direction,
           c.started_at,
           '' as author,
           coalesce(t.full_text, '') as content,
           coalesce(c.duration, 0)::int as seconds,
           c.status
    from calls c
    left join call_transcripts t on t.call_id = c.id
    where c.lead_id = p_lead_id
  )
  select * from (
    select * from chat
    union all
    select * from phone
  ) u
  where public.fn_is_inbox_staff() or public.fn_is_service_request()
  order by u.created_at desc
  limit p_limit;
$$;

create or replace function public.student_timeline(p_student_id uuid, p_limit integer default 500)
returns table(id text, channel text, direction text, at timestamp with time zone, author text, body text, seconds integer, status text)
language sql
stable
security definer
set search_path = public
as $$
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
   where public.fn_is_inbox_staff() or public.fn_is_service_request()
   order by u.created_at desc limit p_limit;
$$;

revoke execute on function public.lead_timeline(uuid, integer) from public, anon;
grant execute on function public.lead_timeline(uuid, integer) to authenticated, service_role;
revoke execute on function public.student_timeline(uuid, integer) from public, anon;
grant execute on function public.student_timeline(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RPCs without a caller check
-- ---------------------------------------------------------------------------
-- Lead field suggestions: same roles as the lfs_staff_decide policy.
create or replace function public.fn_can_decide_lead_suggestions()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
     where r.user_id = auth.uid()
       and r.role::text in ('owner', 'admin', 'call_operator')
  ) or public.fn_is_service_request()
$$;

create or replace function public.accept_lead_suggestion(p_suggestion_id uuid, p_value text default null::text)
returns public.lead_field_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.lead_field_suggestions;
  v_value  text;
  v_edited boolean;
begin
  if not public.fn_can_decide_lead_suggestions() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into s from public.lead_field_suggestions where id = p_suggestion_id;
  if not found then
    raise exception 'Taklif topilmadi';
  end if;

  v_value  := coalesce(nullif(btrim(p_value), ''), s.suggested_value);
  v_edited := v_value is distinct from s.suggested_value;

  if s.field = 'summary' then
    update public.leads set ai_summary = v_value, updated_at = now() where id = s.lead_id;

  elsif s.field in ('full_name','phone','city','education_level','korean_level',
                    'english_level','preferred_university','preferred_program',
                    'target_intake','budget_range','how_heard','interest_level',
                    'current_stage','call_result') then
    execute format('update public.leads set %I = $1, updated_at = now() where id = $2', s.field)
      using v_value, s.lead_id;

  elsif s.field = 'age' then
    if v_value ~ '^[0-9]{1,3}$' then
      update public.leads set age = v_value::int, updated_at = now() where id = s.lead_id;
    end if;

  elsif s.field = 'next_follow_up' then
    if v_value ~ '^\d{4}-\d{2}-\d{2}' then
      update public.leads set next_follow_up = v_value::timestamptz, updated_at = now()
      where id = s.lead_id;
    end if;
  end if;

  update public.lead_field_suggestions
     set status          = case when v_edited then 'corrected' else 'accepted' end,
         corrected_value = case when v_edited then v_value else null end,
         decided_by      = auth.uid(),
         decided_at      = now(),
         updated_at      = now()
   where id = p_suggestion_id
  returning * into s;

  return s;
end;
$$;

create or replace function public.reject_lead_suggestion(p_suggestion_id uuid)
returns public.lead_field_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.lead_field_suggestions;
begin
  if not public.fn_can_decide_lead_suggestions() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.lead_field_suggestions
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
   where id = p_suggestion_id
  returning * into s;

  return s;
end;
$$;

revoke execute on function public.accept_lead_suggestion(uuid, text) from public, anon;
grant execute on function public.accept_lead_suggestion(uuid, text) to authenticated, service_role;
revoke execute on function public.reject_lead_suggestion(uuid) from public, anon;
grant execute on function public.reject_lead_suggestion(uuid) to authenticated, service_role;
revoke execute on function public.fn_can_decide_lead_suggestions() from public, anon;
grant execute on function public.fn_can_decide_lead_suggestions() to authenticated, service_role;

-- Only cron (postgres) and service-role edge functions call these.
revoke execute on function public.complete_telegram_outbox(uuid, boolean, bigint, text, boolean) from public, anon, authenticated;
grant execute on function public.complete_telegram_outbox(uuid, boolean, bigint, text, boolean) to service_role;
revoke execute on function public.student_phone_keys(uuid) from public, anon, authenticated;
grant execute on function public.student_phone_keys(uuid) to service_role;
revoke execute on function public.fn_invoke_crawl_dispatcher() from public, anon, authenticated;
grant execute on function public.fn_invoke_crawl_dispatcher() to service_role;
revoke execute on function public.fn_pipeline_watchdog() from public, anon, authenticated;
grant execute on function public.fn_pipeline_watchdog() to service_role;
revoke execute on function public.fn_routine_supervisor() from public, anon, authenticated;
grant execute on function public.fn_routine_supervisor() to service_role;
revoke execute on function public.link_chat_identities_by_phone() from public, anon, authenticated;
grant execute on function public.link_chat_identities_by_phone() to service_role;

-- ---------------------------------------------------------------------------
-- 4. profiles: protect service fields from self-edits by non-staff
-- ---------------------------------------------------------------------------
create or replace function public.fn_profiles_protect_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only direct API writes are restricted. SECURITY DEFINER RPCs and
  -- service-role code run as a different database role and pass through.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if auth.uid() is null or old.user_id is distinct from auth.uid() then
    return new;
  end if;
  if exists (
    select 1 from public.user_roles r
     where r.user_id = auth.uid()
       and r.role::text in ('owner', 'admin', 'call_operator', 'document_handler', 'university_staff')
  ) then
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.role := old.role;
  new.username := old.username;
  new.magic_code := old.magic_code;
  new.status := old.status;
  new.is_demo := old.is_demo;
  new.contract_date := old.contract_date;
  new.contract_url := old.contract_url;
  new.payment_plan := old.payment_plan;
  new.payment_mode := old.payment_mode;
  new.notes := old.notes;
  new.university_notes := old.university_notes;
  new.university_selection_status := old.university_selection_status;
  new.office_location := old.office_location;
  new.sip1_user := old.sip1_user;
  new.sip1_password := old.sip1_password;
  new.sip1_server := old.sip1_server;
  new.sip1_port := old.sip1_port;
  new.sip1_label := old.sip1_label;
  new.sip2_user := old.sip2_user;
  new.sip2_password := old.sip2_password;
  new.sip2_server := old.sip2_server;
  new.sip2_port := old.sip2_port;
  new.sip2_label := old.sip2_label;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_self_update on public.profiles;
create trigger trg_profiles_protect_self_update
  before update on public.profiles
  for each row execute function public.fn_profiles_protect_self_update();

-- ---------------------------------------------------------------------------
-- 5. Investor restrictions
-- ---------------------------------------------------------------------------
drop policy if exists deny_investor_all on public.contract_cancellations;
create policy deny_investor_all
  on public.contract_cancellations
  as restrictive
  for all
  to authenticated
  using (not public.is_investor())
  with check (not public.is_investor());

drop policy if exists deny_investor_all on public.student_contacts;
create policy deny_investor_all
  on public.student_contacts
  as restrictive
  for all
  to authenticated
  using (not public.is_investor())
  with check (not public.is_investor());
