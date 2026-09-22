-- Cross-channel lead profile: the tables, view and functions the
-- /crm/leads/<id> page reads and writes.
--
-- Applied to production on 2026-09-22; this file is the record of it.

-- 1. Proposals that span every channel -------------------------------------
create table if not exists public.lead_field_suggestions (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references leads(id) on delete cascade,
  field            text not null,
  suggested_value  text,
  confidence       numeric,
  evidence         text,
  evidence_channel text,
  sources          jsonb not null default '{}'::jsonb,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','rejected','corrected')),
  corrected_value  text,
  decided_by       uuid,
  decided_at       timestamptz,
  model            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (lead_id, field)
);

create index if not exists lead_field_suggestions_lead_idx
  on public.lead_field_suggestions (lead_id, status);

alter table public.lead_field_suggestions enable row level security;

do $$ begin
  create policy lfs_staff_read on public.lead_field_suggestions
    for select to authenticated
    using (exists (select 1 from user_roles r
                   where r.user_id = auth.uid()
                     and r.role = any (array['owner'::app_role,'admin'::app_role,'call_operator'::app_role])));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy lfs_staff_decide on public.lead_field_suggestions
    for update to authenticated
    using (exists (select 1 from user_roles r
                   where r.user_id = auth.uid()
                     and r.role = any (array['owner'::app_role,'admin'::app_role,'call_operator'::app_role])))
    with check (exists (select 1 from user_roles r
                   where r.user_id = auth.uid()
                     and r.role = any (array['owner'::app_role,'admin'::app_role,'call_operator'::app_role])));
exception when duplicate_object then null; end $$;

-- 2. The one proposed field the card had no home for ------------------------
alter table public.leads add column if not exists current_stage text;

-- 3. Linking chat handles to leads by a phone the customer typed ------------
create or replace function public.extract_uz_phone(txt text)
returns text language sql immutable as $$
  select (regexp_match(
    regexp_replace(coalesce(txt, ''), '[^0-9]', '', 'g'),
    '(?:998)?((?:9[0-9]|88|77|33|20)[0-9]{7})'
  ))[1];
$$;

create or replace function public.link_chat_identities_by_phone()
returns table (out_channel text, out_linked integer)
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
  inserted as (
    insert into communication_identities
      (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
    select mt.ch, mt.ident, mt.dname, mt.lead_id, mt.dname,
           'inferred', 'auto', 'Mijoz telefon raqamini yozishmada o''zi yozgan'
    from matched mt
    on conflict (channel, identifier) do nothing
    returning communication_identities.channel as ch
  )
  select i.ch, count(*)::integer from inserted i group by i.ch;
end;
$$;

-- 4. Card overview ----------------------------------------------------------
create or replace view public.lead_channel_overview as
with chat as (
  select ci.lead_id, m.source as channel, count(*) as messages, max(m.created_at) as last_at
  from communication_identities ci
  join messages m on m.source = ci.channel and m.sender_id = ci.identifier
  where ci.lead_id is not null and ci.channel in ('telegram','instagram')
  group by ci.lead_id, m.source
),
phone as (
  select c.lead_id, 'phone'::text as channel, count(*) as messages, max(c.started_at) as last_at
  from calls c where c.lead_id is not null group by c.lead_id
),
all_ch as (select * from chat union all select * from phone),
sugg as (
  select lead_id,
         count(*) filter (where status = 'pending') as pending_suggestions,
         max(created_at) as last_analysis_at
  from lead_field_suggestions group by lead_id
)
select
  l.id as lead_id, l.full_name, l.phone,
  coalesce(sum(a.messages) filter (where a.channel = 'phone'), 0)::int     as calls,
  coalesce(sum(a.messages) filter (where a.channel = 'telegram'), 0)::int  as telegram_messages,
  coalesce(sum(a.messages) filter (where a.channel = 'instagram'), 0)::int as instagram_messages,
  max(a.last_at) filter (where a.channel = 'phone')     as last_call_at,
  max(a.last_at) filter (where a.channel = 'telegram')  as last_telegram_at,
  max(a.last_at) filter (where a.channel = 'instagram') as last_instagram_at,
  max(a.last_at)                                        as last_contact_at,
  count(distinct a.channel)::int                        as channels_used,
  coalesce(max(s.pending_suggestions), 0)::int          as pending_suggestions,
  max(s.last_analysis_at)                               as last_analysis_at
from leads l
left join all_ch a on a.lead_id = l.id
left join sugg   s on s.lead_id = l.id
group by l.id, l.full_name, l.phone;

grant select on public.lead_channel_overview to authenticated;

-- 5. One merged conversation ------------------------------------------------
create or replace function public.lead_timeline(p_lead_id uuid, p_limit int default 500)
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
    where ci.lead_id = p_lead_id and ci.channel in ('telegram','instagram')
      and m.content is not null
  ),
  phone as (
    select c.id::text, 'phone', c.direction, c.started_at, '',
           coalesce(t.full_text, ''), coalesce(c.duration, 0)::int, c.status
    from calls c
    left join call_transcripts t on t.call_id = c.id
    where c.lead_id = p_lead_id
  )
  select * from (select * from chat union all select * from phone) u
  order by u.created_at desc limit p_limit;
$$;

revoke all on function public.lead_timeline(uuid, int) from public;
grant execute on function public.lead_timeline(uuid, int) to authenticated;

-- 6. Deciding on a proposal --------------------------------------------------
create or replace function public.accept_lead_suggestion(
  p_suggestion_id uuid, p_value text default null
)
returns public.lead_field_suggestions
language plpgsql security definer set search_path = public as $$
declare
  s public.lead_field_suggestions; v_value text; v_edited boolean;
begin
  select * into s from public.lead_field_suggestions where id = p_suggestion_id;
  if not found then raise exception 'Taklif topilmadi'; end if;

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
     set status = case when v_edited then 'corrected' else 'accepted' end,
         corrected_value = case when v_edited then v_value else null end,
         decided_by = auth.uid(), decided_at = now(), updated_at = now()
   where id = p_suggestion_id
  returning * into s;
  return s;
end;
$$;

create or replace function public.reject_lead_suggestion(p_suggestion_id uuid)
returns public.lead_field_suggestions
language sql security definer set search_path = public as $$
  update public.lead_field_suggestions
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(), updated_at = now()
   where id = p_suggestion_id
  returning *;
$$;

revoke all on function public.accept_lead_suggestion(uuid, text) from public;
revoke all on function public.reject_lead_suggestion(uuid) from public;
grant execute on function public.accept_lead_suggestion(uuid, text) to authenticated;
grant execute on function public.reject_lead_suggestion(uuid) to authenticated;
