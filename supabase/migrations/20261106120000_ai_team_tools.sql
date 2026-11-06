-- Hanguk AI: xodim boti ma'lumotlari uchun 3 ta tool (xodim boti 2.0, B3-3).
--   ai_team_daily_reports  — kunlik hisobotlar va kim topshirmagan.
--                            owner — hammasi; boshqa xodim — faqat o'ziniki (D3).
--   ai_group_summaries     — guruhning kunlik xulosalari (group_daily_summaries, B3-1). Faqat owner.
--   ai_team_history_search — xodimlar guruhi xabarlarida leksik qidiruv (matn va «🎤» transkriptlar). Faqat owner.
--
-- Hammasi SECURITY DEFINER, ichida auth.uid() bo'yicha rol tekshiruvi; faqat authenticated'ga grant.
-- Test akkauntlar (fn_is_demo_user) natijalardan chiqariladi (o'z hisobotini so'ragan test akkauntdan tashqari). Ulanmagan Telegram akkauntlari
-- (staff_group_messages.user_id is null) qidiruvga kirmaydi (D7).
-- Vektor (ma'no bo'yicha) qidiruv — B3-2, keyingi PR.

create extension if not exists pg_trgm with schema public;

-- ILIKE '%so'z%' qidiruvi uchun trigram indeksi.
create index if not exists staff_group_messages_text_trgm_idx
  on public.staff_group_messages using gin (text public.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 1. Kunlik hisobotlar
-- ---------------------------------------------------------------------------
create or replace function public.ai_team_daily_reports(
  p_from date default null,
  p_to date default null,
  p_staff text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_uid uuid := auth.uid();
  v_owner boolean;
  v_today date := public.tashkent_today();
  v_to date := least(coalesce(p_to, p_from, public.tashkent_today()), public.tashkent_today());
  v_from date := coalesce(p_from, coalesce(p_to, public.tashkent_today()));
  v_note text := null;
  v_workdays text[] := string_to_array(
    coalesce((select s.value from public.bot_settings s where s.key = 'workdays'), '1,2,3,4,5,6'), ',');
  v_reports jsonb;
  v_missing jsonb;
begin
  if v_uid is null or not public.is_staff_user(v_uid) then
    raise exception 'not authorized: staff only';
  end if;
  v_owner := public.has_role(v_uid, 'owner'::public.app_role);

  if v_from > v_to then v_from := v_to; end if;
  if v_to - v_from > 30 then
    v_from := v_to - 30;
    v_note := 'Oraliq 31 kun bilan cheklandi.';
  end if;
  if not v_owner and p_staff is not null then
    v_note := concat_ws(' ', v_note, 'Xodim faqat o''z hisobotini ko''ra oladi — boshqa xodim filtri e''tiborsiz qoldirildi.');
  end if;

  with people as (
    select p.user_id, coalesce(nullif(trim(p.full_name), ''), '—') as name
      from public.profiles p
     where public.is_staff_user(p.user_id)
       and (not public.fn_is_demo_user(p.user_id) or p.user_id = v_uid)
       and (case when v_owner
                 then p_staff is null
                      or public.hanguk_fold_name(p.full_name) like '%' || public.hanguk_fold_name(p_staff) || '%'
                 else p.user_id = v_uid end)
  ), r as (
    select d.report_date, pe.name, d.done, d.blockers, d.plan, d.raw_text
      from public.daily_reports d
      join people pe on pe.user_id = d.user_id
     where d.report_date between v_from and v_to
     order by d.report_date desc, pe.name
     limit 200
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'date', r.report_date,
           'name', r.name,
           'done', left(r.done, 600),
           'blockers', left(r.blockers, 400),
           'plan', left(r.plan, 400),
           -- AI ajratmagan hisobot: asl matn
           'text', case when coalesce(r.done, r.blockers, r.plan) is null then left(r.raw_text, 600) end
         )) order by r.report_date desc, r.name), '[]'::jsonb)
    into v_reports
    from r;

  -- Kim topshirmagan: ish kunlari (bot_settings.workdays), hisobot topshiradiganlar
  -- (owner emas, test akkaunt emas — bot_report_summary bilan bir xil to'plam).
  with people as (
    select p.user_id, coalesce(nullif(trim(p.full_name), ''), '—') as name,
           exists (select 1 from public.staff_telegram_links l where l.user_id = p.user_id and l.is_active) as linked
      from public.profiles p
     where public.is_staff_user(p.user_id)
       and not public.has_role(p.user_id, 'owner'::public.app_role)
       and (not public.fn_is_demo_user(p.user_id) or p.user_id = v_uid)
       and (case when v_owner
                 then p_staff is null
                      or public.hanguk_fold_name(p.full_name) like '%' || public.hanguk_fold_name(p_staff) || '%'
                 else p.user_id = v_uid end)
  ), days as (
    select g.d::date as d
      from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') g(d)
     where extract(isodow from g.d)::int::text = any (v_workdays)
       -- hisobot tizimi ishlamagan kunlar «topshirmagan» emas
       and g.d >= (select min(d0.report_date) from public.daily_reports d0)
  ), m as (
    select days.d, jsonb_agg(jsonb_build_object('name', pe.name, 'bot_linked', pe.linked) order by pe.name) as people
      from days
      cross join people pe
     where not exists (select 1 from public.daily_reports d
                        where d.user_id = pe.user_id and d.report_date = days.d)
     group by days.d
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', m.d,
           'is_today', m.d = v_today,
           'people', m.people
         ) order by m.d desc), '[]'::jsonb)
    into v_missing
    from m;

  return jsonb_strip_nulls(jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'scope', case when v_owner then 'all' else 'own' end,
    'reports', v_reports,
    'not_submitted', v_missing,
    'note', concat_ws(' ', v_note,
      'Hisobot har ish kuni 17:00 da so''raladi; bugungi kun hali tugamagan bo''lishi mumkin. Ownerlar hisobot topshirmaydi.')
  ));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Guruhning kunlik xulosalari (group_daily_summaries jadvalini B3-1 yaratadi;
--    jadval bo'lmasa bo'sh natija — shuning uchun dinamik SQL).
-- ---------------------------------------------------------------------------
create or replace function public.ai_group_summaries(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_uid uuid := auth.uid();
  v_to date := coalesce(p_to, p_from, public.tashkent_today());
  v_from date := coalesce(p_from, coalesce(p_to, public.tashkent_today()) - 6);
  v_rows jsonb;
begin
  if v_uid is null or not public.has_role(v_uid, 'owner'::public.app_role) then
    raise exception 'not authorized: owner only';
  end if;
  if v_from > v_to then v_from := v_to; end if;
  if v_to - v_from > 30 then v_from := v_to - 30; end if;

  if to_regclass('public.group_daily_summaries') is null then
    return jsonb_build_object('from', v_from, 'to', v_to, 'summaries', '[]'::jsonb,
      'note', 'Guruh xulosalari hali yozilmayapti (group_daily_summaries yo''q).');
  end if;

  execute $q$
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'date', s.summary_date,
             'summary', left(s.summary, 2000),
             'topics', s.topics,
             'decisions', s.decisions,
             'open_questions', s.open_questions,
             'message_count', s.message_count
           )) order by s.summary_date desc), '[]'::jsonb)
      from (select * from public.group_daily_summaries
             where summary_date between $1 and $2
             order by summary_date desc
             limit 31) s
  $q$ into v_rows using v_from, v_to;

  return jsonb_build_object('from', v_from, 'to', v_to, 'summaries', v_rows,
    'note', case when v_rows = '[]'::jsonb then 'Bu oraliqda guruh xulosasi yo''q.' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Guruh tarixi bo'yicha qidiruv (leksik). So'zlar ILIKE bilan; o'zbekcha
--    tutuq belgilari (' ʼ ‘ ’ `) har qanday belgiga mos keladi (o'/oʻ/o‘).
--    Ko'proq so'z mos kelgan xabar oldinda, keyin yangisi.
-- ---------------------------------------------------------------------------
create or replace function public.ai_team_history_search(
  p_query text,
  p_from date default null,
  p_to date default null,
  p_staff text default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '8s'
as $$
declare
  v_uid uuid := auth.uid();
  v_words text[];
  v_pats text[];
  v_anchor text;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_rows jsonb;
  v_from date := p_from;
  v_to date := coalesce(p_to, public.tashkent_today());
begin
  if v_uid is null or not public.has_role(v_uid, 'owner'::public.app_role) then
    raise exception 'not authorized: owner only';
  end if;

  -- so'zlar: kichik harf, tinish belgilarisiz, 2+ belgi, ko'pi bilan 8 ta
  select array_agg(w order by ord) into v_words
    from (select distinct on (w) w, ord
            from regexp_split_to_table(lower(coalesce(p_query, '')), '[^[:alnum:]''ʼ‘’`-]+') with ordinality t(w, ord)
           where length(regexp_replace(w, '[''ʼ‘’`-]', '', 'g')) >= 2
           order by w, ord) x;
  v_words := v_words[1:8];
  if v_words is null then
    return jsonb_build_object('error', 'query is too short');
  end if;

  -- LIKE belgilarini ekranlash, tutuq belgisi → '_' (istalgan bitta belgi)
  select array_agg('%' || regexp_replace(
                     replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_'),
                     '[''ʼ‘’`]', '_', 'g') || '%')
    into v_pats
    from unnest(v_words) w;

  -- parcha uchun eng uzun so'zning tutuqsiz eng uzun bo'lagi
  select part into v_anchor
    from unnest(v_words) w, regexp_split_to_table(w, '[''ʼ‘’`]') part
   order by length(part) desc limit 1;

  with m as (
    select g.created_at, g.chat_id, g.message_id, g.text,
           coalesce(nullif(trim(p.full_name), ''), '—') as name,
           (select count(*) from unnest(v_pats) pat where g.text ilike pat) as hits
      from public.staff_group_messages g
      join public.profiles p on p.user_id = g.user_id
     where g.user_id is not null
       and g.text is not null
       and coalesce(g.kind, 'message') <> 'command'
       and not public.fn_is_demo_user(g.user_id)
       and g.text ilike any (v_pats)
       and (v_from is null or public.ai_tk_day(g.created_at) >= v_from)
       and public.ai_tk_day(g.created_at) <= v_to
       and (p_staff is null
            or public.hanguk_fold_name(p.full_name) like '%' || public.hanguk_fold_name(p_staff) || '%')
     order by hits desc, g.created_at desc
     limit v_limit
  ), s as (
    select m.*, greatest(strpos(lower(m.text), v_anchor) - 100, 1) as pos from m
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'at', to_char(s.created_at at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI'),
           'name', s.name,
           'voice', s.text like '🎤%',
           'matched_words', s.hits,
           'snippet', case when s.pos > 1 then '…' else '' end
                      || substr(s.text, s.pos, 300)
                      || case when length(s.text) > s.pos + 299 then '…' else '' end,
           -- supergroup havolasi: https://t.me/c/<id>/<message_id>
           'link', case when s.chat_id < -1000000000000
                        then 'https://t.me/c/' || ((-s.chat_id) - 1000000000000)::text || '/' || s.message_id end
         )) order by s.hits desc, s.created_at desc), '[]'::jsonb)
    into v_rows
    from s;

  return jsonb_build_object(
    'query_words', to_jsonb(v_words),
    'from', v_from,
    'to', v_to,
    'results', v_rows,
    'note', 'Faqat botga ulangan xodimlar xabarlari; guruh tarixi 90 kun saqlanadi. «🎤» — ovozli xabar transkripti.');
end;
$$;

revoke all on function public.ai_team_daily_reports(date, date, text) from public, anon;
revoke all on function public.ai_group_summaries(date, date) from public, anon;
revoke all on function public.ai_team_history_search(text, date, date, text, int) from public, anon;
grant execute on function public.ai_team_daily_reports(date, date, text) to authenticated, service_role;
grant execute on function public.ai_group_summaries(date, date) to authenticated, service_role;
grant execute on function public.ai_team_history_search(text, date, date, text, int) to authenticated, service_role;
