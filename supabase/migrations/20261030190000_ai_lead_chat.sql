-- Hanguk AI could not find "Shoxrux rustamjonov" (Asrbek, 2026-10-27).
-- The lead is saved as "Shoxrux" (his Telegram name); he typed his full name
-- in the chat. ai_search_leads required every query word to be in the lead's
-- name, so it returned nothing, and the lead card had no chat at all, so the
-- assistant could not read the CRM conversation (the "Muloqot oqimi").
--
--   ai_search_leads  also finds leads by what they wrote in Telegram/Instagram
--                    (same link as lead_timeline: communication_identities),
--                    and by part of the name when nothing matches fully.
--   ai_lead_card     now includes the latest chat messages of the lead.
--
-- Same signatures, still staff-only and read-only.

create or replace function public.ai_search_leads(p_query text, p_limit integer default 8)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v jsonb;
  v_lim int := greatest(least(coalesce(p_limit, 8), 30), 1);
  -- pgroonga query syntax: keep letters, digits and spaces only.
  v_text text := btrim(regexp_replace(coalesce(p_query, ''), '[^[:alnum:][:space:]'']+', ' ', 'g'));
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  with q as (
    select public.hanguk_fold_name(p_query) fq, regexp_replace(coalesce(p_query, ''), '\D', '', 'g') dg
  ), qt as (select t from q, regexp_split_to_table(q.fq, '[^[:alnum:]]+') t where length(t) >= 3),
  chat as (
    select ci.lead_id, count(*) n, max(m.created_at) last_at,
           (array_agg(left(m.content, 200) order by m.created_at desc))[1] snippet
      from messages m
      join communication_identities ci on ci.channel = m.source and ci.identifier = m.sender_id
     where length(v_text) >= 3 and m.content &@~ v_text and ci.lead_id is not null
     group by ci.lead_id
  ),
  c as (
    select l.*, public.hanguk_fold_name(l.full_name) fn,
           regexp_split_to_array(public.hanguk_fold_name(coalesce(l.full_name, '') || ' ' || coalesce(l.telegram_handle, '') || ' ' || coalesce(l.instagram_handle, '')), '[^[:alnum:]]+') words
      from leads l
  ), s as (
    select c.*, ch.snippet chat_snippet, ch.last_at chat_at,
           greatest(
             word_similarity(q.fq, c.fn),
             coalesce((select avg((select max(similarity(qt.t, w)) from unnest(c.words) w)) from qt), 0),
             case when length(q.dg) >= 7 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.dg || '%' then 1 else 0 end) score,
           (exists (select 1 from qt) and not exists (select 1 from qt where not exists (
              select 1 from unnest(c.words) w where w like qt.t || '%' or similarity(qt.t, w) >= 0.45))) all_words,
           (select count(*) from qt where exists (
              select 1 from unnest(c.words) w where w like qt.t || '%' or similarity(qt.t, w) >= 0.6)) some_words,
           (length(q.dg) >= 7 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q.dg || '%') by_phone,
           (c.fn like '%' || q.fq || '%') whole,
           (ch.lead_id is not null) by_chat
      from c cross join q left join chat ch on ch.lead_id = c.id
  ), r as (
    select s.*,
           case when all_words or by_phone or whole then 1
                when by_chat then 2
                else 3 end tier
      from s
     where all_words or by_phone or whole or by_chat or some_words > 0
  )
  select coalesce(jsonb_agg(x order by tier, sc desc), '[]'::jsonb) into v from (
    select jsonb_build_object('lead_id', id, 'name', full_name, 'phone', phone, 'status', status,
             'source', source, 'channel', contact_channel, 'call_result', call_result,
             'created_at', public.ai_tk_day(created_at), 'shown_in_crm', qualified,
             'season', (select initcap(season) || ' ' || year from intakes where id = r.intake_id),
             'assignee', public.ai_staff_name(assigned_to),
             'match', case tier when 1 then 'ism yoki telefon' when 2 then 'chatda yozgan' else 'ismning bir qismi' end,
             'chat_snippet', chat_snippet) x, tier, score sc
      from r
     -- partial name matches only when nothing better was found
     where tier < 3 or not exists (select 1 from r r2 where r2.tier < 3)
     order by tier, score desc, created_at desc
     limit v_lim) z;
  return v;
end;
$$;

create or replace function public.ai_lead_card(p_lead_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare v jsonb;
begin
  if not public.ai_is_staff(auth.uid()) then raise exception 'not authorized: staff only'; end if;
  select jsonb_build_object(
    'lead', jsonb_build_object(
      'name', l.full_name, 'phone', l.phone, 'email', l.email, 'city', l.city, 'age', l.age,
      'status', l.status, 'call_result', l.call_result, 'source', l.source, 'channel', l.contact_channel,
      'how_heard', l.how_heard, 'source_note', l.source_note, 'education_level', l.education_level,
      'korean_level', l.korean_level, 'english_level', l.english_level, 'cert_level', l.cert_level,
      'target_intake', l.target_intake, 'preferred_university', l.preferred_university,
      'preferred_program', l.preferred_program, 'tariff_interest', l.tariff_interest,
      'interest_level', l.interest_level, 'priority_score', l.priority_score,
      'next_follow_up', l.next_follow_up, 'last_contacted_at', l.last_contacted_at,
      'created_at', l.created_at, 'new_lead_at', l.new_lead_at, 'notes', left(l.notes, 600),
      'ai_summary', left(l.ai_summary, 600), 'telegram', l.telegram_handle, 'instagram', l.instagram_handle,
      'assignee', public.ai_staff_name(l.assigned_to), 'created_by', public.ai_staff_name(l.created_by),
      'converted_to_student', l.converted_to_student_id is not null,
      'season', (select initcap(season) || ' ' || year from intakes where id = l.intake_id),
      'learning_center', (select name from learning_centers where id = l.learning_center_id)),
    'notes', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('date', coalesce(n.contacted_at, public.ai_tk_day(n.created_at)), 'type', n.contact_type,
                 'outcome', n.outcome, 'text', left(n.content, 300), 'by', public.ai_staff_name(n.created_by)) r
          from lead_notes n where n.lead_id = l.id order by n.created_at desc limit 8) z), '[]'::jsonb),
    'calls', jsonb_build_object(
      'count', (select count(*) from calls c where c.lead_id = l.id),
      'last', (select jsonb_build_object('at', c.started_at, 'status', c.status, 'by', public.ai_staff_name(c.staff_id))
                 from calls c where c.lead_id = l.id order by c.started_at desc nulls last limit 1)),
    -- Same messages as the CRM "Muloqot oqimi" (lead_timeline), newest 30, oldest first.
    'chat', (select jsonb_build_object(
        'total', count(*),
        'messages', coalesce((select jsonb_agg(jsonb_build_object(
              'at', to_char(x.created_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI'),
              'from', case when x.direction = 'incoming' then 'mijoz'
                           else coalesce(public.ai_staff_name(x.replied_by), 'biz') end,
              'channel', x.source, 'text', left(x.content, 400)) order by x.created_at)
            from (select m2.* from messages m2
                    join communication_identities c2 on c2.channel = m2.source and c2.identifier = m2.sender_id
                   where c2.lead_id = l.id and c2.channel in ('telegram', 'instagram') and m2.content is not null
                   order by m2.created_at desc limit 30) x), '[]'::jsonb))
        from messages m
        join communication_identities ci on ci.channel = m.source and ci.identifier = m.sender_id
       where ci.lead_id = l.id and ci.channel in ('telegram', 'instagram') and m.content is not null)
  ) into v
  from leads l where l.id = p_lead_id;
  return coalesce(v, jsonb_build_object('error', 'lead not found'));
end;
$$;

revoke all on function public.ai_search_leads(text, integer) from public, anon;
revoke all on function public.ai_lead_card(uuid) from public, anon;
grant execute on function public.ai_search_leads(text, integer) to authenticated;
grant execute on function public.ai_lead_card(uuid) to authenticated;
