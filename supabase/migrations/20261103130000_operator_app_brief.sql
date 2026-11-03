-- «Ilova lidlari» — operator ilovadan kelgan mijozni chatda ko'rganda uning
-- ilovada nima qilganini bir joyda ko'radi (Asrbek, 2026-11-03).
--
-- operator_app_brief(lead)  — bitta lid: ilovadagi javoblari (yosh, yo'nalish,
--   GPA, IELTS/TOPIK, moliya), ♥ tanlovlari va eng ko'p ochgan universitetlari
--   (har biriga kirish testi natijasi, hozirgi qabul ochiq/yopiqligi),
--   filtr va qidiruvlari, qayerda qiynalgani (kod topilmadi, bog'lanish
--   tugmasi), uning yo'nalishi va til darajasiga hali ochiq qabullar.
-- operator_app_leads(days) — ilovaga bog'langan lidlar navbati: kim yozgan va
--   javob kutyapti, qancha kutgan, issiq/iliq/ma'lumot yig'yapti.
--
-- Faqat o'qish. Ruxsat — analytics_person bilan bir xil
-- (app_events_staff_can_read: owner, admin, call_operator, document_handler),
-- har o'qish analytics_access_log'ga yoziladi.

-- Bitta universitetning hozirgi qabuli: eng yaqin onlayn topshirish muddati
-- (bugundan keyin) yoki, hammasi o'tgan bo'lsa, oxirgi yopilgan sana.
create or replace function public.fn_operator_admission_window(p_institution uuid, p_daraja text)
returns table(next_deadline date, closed_at date, ielts_min numeric, topik_min numeric, city text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with g as (
    select g.*
      from public.university_guidelines g
     where g.institution_id = p_institution
       and g.qabul_yili >= extract(year from current_date)::int
       and (case when p_daraja is null then coalesce(g.daraja, '') <> 'til_kursi'
                 else g.daraja = p_daraja end)
  ), r as (
    select r.tugash_sana, g.ielts_min, g.topik_min, g.shahar
      from g join public.university_guideline_rounds r on r.guideline_uuid = g.id
     where r.etap_nomi = 'Online hujjat topshirish' and r.tugash_sana is not null
  )
  select (select min(tugash_sana) from r where tugash_sana >= current_date),
         case when exists (select 1 from r where tugash_sana >= current_date) then null
              else (select max(tugash_sana) from r) end,
         (select min(ielts_min) from g),
         (select min(topik_min) from g),
         (select max(shahar) from g);
$$;

revoke all on function public.fn_operator_admission_window(uuid, text) from public, anon, authenticated;

create or replace function public.operator_app_brief(p_lead_id uuid)
returns jsonb
language plpgsql
-- volatile: har o'qish analytics_access_log'ga yoziladi.
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_key     text;
  v_p       public.app_person_profile%rowtype;
  v_lead    public.leads%rowtype;
  v_answers jsonb;
  v_route   text;
  v_daraja  text;
  v_ielts   numeric;
  v_topik   numeric;
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where id = p_lead_id;
  v_key := public.fn_app_person_of(p_lead_id, null);
  if v_key is null then
    return null;
  end if;
  select * into v_p from public.app_person_profile where person_key = v_key;

  insert into public.analytics_access_log (viewer, person_key, lead_id, user_id, what)
  values (auth.uid(), v_key, v_p.lead_id, v_p.user_id, 'profile');

  -- Javoblar: har savolning eng oxirgi javobi. Bir savol ikki formada
  -- (viza testi va universitet testi) turlicha javob olgan bo'lsa, boshqa
  -- formadagi javob ham beriladi — operator «ikki joyda ikki xil» deb ko'radi.
  -- Slayder har qiymatni yozgani uchun forma ichidagi oraliq qiymatlar olinmaydi.
  select coalesce(jsonb_object_agg(q, jsonb_build_object('v', v, 'at', at, 'other', other)), '{}'::jsonb)
    into v_answers
    from (
      select q,
             (array_agg(v order by at desc))[1] as v,
             max(at) as at,
             case when count(distinct v::text) > 1 then (array_agg(v order by at desc))[2] end as other
        from (
          select distinct on (e.props->>'form', e.props->>'q')
                 e.props->>'q' as q, e.props->'band' as v, e.occurred_at as at
            from public.app_events e
           where e.install_id = any (v_p.installs)
             and e.event = 'question_answer'
             and e.props ? 'q'
           order by e.props->>'form', e.props->>'q', e.occurred_at desc
        ) a
       group by q
    ) s;

  v_route := v_answers->'route'->>'v';
  v_daraja := case v_route when 'master' then 'magistratura' when 'languageCourse' then 'til_kursi'
                           when 'bachelor' then 'bakalavr' else null end;
  v_ielts := nullif(v_answers->'ielts'->>'v', '')::numeric;
  v_topik := nullif(v_answers->'topik'->>'v', '')::numeric;

  return jsonb_build_object(
    'lead', jsonb_build_object(
      'id', v_lead.id, 'name', v_lead.full_name, 'has_phone', coalesce(v_lead.phone, '') <> '',
      'channel', coalesce(v_lead.contact_channel, v_lead.source), 'link_code', v_lead.link_code,
      'how_heard', v_lead.how_heard, 'for_whom', v_lead.for_whom),
    'activity', jsonb_build_object(
      'first_seen_at', v_p.first_seen_at, 'last_seen_at', v_p.last_seen_at,
      'visits', v_p.visits, 'active_days', v_p.active_days, 'active_s', v_p.active_s,
      'platform', v_p.platform,
      'app_version', (select i.app_version from public.app_installs i where i.install_id = any (v_p.installs)
                       order by i.last_seen_at desc nulls last limit 1),
      'ui_lang', (select i.ui_lang from public.app_installs i where i.install_id = any (v_p.installs)
                   order by i.last_seen_at desc nulls last limit 1)),
    'answers', v_answers,
    'route', v_daraja,
    'visa', case when v_p.visa_band is null then null else jsonb_build_object(
      'band', v_p.visa_band, 'low', v_p.visa_low, 'income', v_p.visa_income, 'topik', v_p.visa_topik) end,
    'tariff', coalesce(v_p.tariff, v_lead.tariff_interest),
    'report_views', v_p.report_views,
    -- ♥ va eng ko'p ochilgan universitetlar, har biriga hozirgi qabul holati
    -- va ilovadagi kirish testi natijasi (eng oxirgisi).
    'universities', coalesce((
      with opened as (
        select (e.props->>'institution_id') as iid, count(*) as opens, max(e.occurred_at) as last_at
          from public.app_events e
         where e.install_id = any (v_p.installs)
           and e.event = 'university_open' and e.props ? 'institution_id'
         group by 1
      ), picks as (
        select x.iid, x.ord from unnest(v_p.picks) with ordinality as x(iid, ord)
      ), scored as (
        select distinct on (e.props->>'institution_id')
               e.props->>'institution_id' as iid, (e.props->>'score_bucket')::int as score
          from public.app_events e
         where e.install_id = any (v_p.installs)
           and e.event = 'assessment_result' and e.props->>'kind' = 'admission' and e.props ? 'institution_id'
         order by e.props->>'institution_id', e.occurred_at desc
      ), tests as (
        select e.props->>'institution_id' as iid,
               count(*) filter (where e.event = 'study_plan_test_open') as study_plan,
               count(*) filter (where e.event = 'interview_start') as interview
          from public.app_events e
         where e.install_id = any (v_p.installs)
           and e.event in ('study_plan_test_open', 'interview_start') and e.props ? 'institution_id'
         group by 1
      ), ids as (
        select iid from picks
        union
        select iid from (select iid from opened order by opens desc, last_at desc limit 8) o
      )
      select jsonb_agg(jsonb_build_object(
               'institution_id', i.id,
               'name', coalesce(i.name_en, i.name_ko),
               'name_ko', i.name_ko,
               'picked', p.iid is not null,
               'opens', coalesce(o.opens, 0),
               'last_opened_at', o.last_at,
               'admission_score', s.score,
               'study_plan_tests', coalesce(t.study_plan, 0),
               'interview_tests', coalesce(t.interview, 0),
               'next_deadline', w.next_deadline,
               'closed_at', w.closed_at,
               'ielts_min', w.ielts_min,
               'topik_min', w.topik_min)
             order by (p.iid is null), p.ord, o.opens desc nulls last)
        from ids
        join public.institutions i on i.id::text = ids.iid
        left join picks p on p.iid = ids.iid
        left join opened o on o.iid = ids.iid
        left join scored s on s.iid = ids.iid
        left join tests t on t.iid = ids.iid
        left join lateral public.fn_operator_admission_window(i.id, v_daraja) w on true
    ), '[]'::jsonb),
    'filters', (
      select e.props from public.app_events e
       where e.install_id = any (v_p.installs) and e.event = 'filter_apply'
       order by e.occurred_at desc limit 1),
    'searches', coalesce((
      select jsonb_agg(q) from (
        select distinct on (lower(e.props->>'q')) e.props->>'q' as q, e.occurred_at
          from public.app_events e
         where e.install_id = any (v_p.installs) and e.event = 'search' and coalesce(e.props->>'q', '') <> ''
         order by lower(e.props->>'q'), e.occurred_at desc
      ) s), '[]'::jsonb),
    -- Qayerda qiynalgan: operatorga «nega yozolmadi» degan savolga javob.
    'friction', jsonb_build_object(
      'code_not_found', (select count(*) from public.app_events e where e.install_id = any (v_p.installs)
                          and e.event = 'form_submit' and e.props->>'form' = 'client_code'
                          and e.props->>'result' = 'codeNotFound'),
      'contact_taps', (select count(*) from public.app_events e where e.install_id = any (v_p.installs)
                        and e.event = 'contact_tap'),
      'contact_channels', (select coalesce(jsonb_agg(distinct e.props->>'channel'), '[]'::jsonb)
                             from public.app_events e where e.install_id = any (v_p.installs)
                              and e.event = 'contact_tap' and e.props ? 'channel'),
      'rage_taps', (select count(*) from public.app_events e where e.install_id = any (v_p.installs)
                     and e.event = 'rage_tap'),
      'app_errors', (select count(*) from public.app_events e where e.install_id = any (v_p.installs)
                      and e.event in ('app_error', 'rpc_error'))),
    -- Uning yo'nalishi va tiliga hozir ochiq qabullar, eng yaqin muddat birinchi.
    'open_now', coalesce((
      select jsonb_agg(x order by (x->>'deadline')::date, x->>'name') from (
        select jsonb_build_object(
                 'institution_id', g.institution_id,
                 'name', coalesce(i.name_en, i.name_ko),
                 'city', max(g.shahar),
                 'deadline', min(r.tugash_sana),
                 'ielts_min', min(g.ielts_min),
                 'topik_min', min(g.topik_min)) as x
          from public.university_guidelines g
          join public.university_guideline_rounds r on r.guideline_uuid = g.id
          join public.institutions i on i.id = g.institution_id
         where r.etap_nomi = 'Online hujjat topshirish'
           and r.tugash_sana >= current_date
           and g.daraja = coalesce(v_daraja, 'bakalavr')
           and (
             (v_ielts is not null and v_ielts > 0 and g.ielts_min is not null and v_ielts >= g.ielts_min)
             or (v_topik is not null and v_topik > 0 and g.topik_min is not null and v_topik >= g.topik_min)
             or ((v_ielts is null or v_ielts = 0) and (v_topik is null or v_topik = 0)
                 and g.ielts_min is null and g.topik_min is null)
           )
         group by g.institution_id, i.name_en, i.name_ko
         order by min(r.tugash_sana)
         limit 8
      ) t), '[]'::jsonb),
    'ai_summary', v_p.ai_summary,
    'ai_starter', v_p.ai_starter,
    'ai_fresh', v_p.ai_seen_at is not null and v_p.ai_seen_at >= v_p.last_seen_at
  );
end;
$$;

revoke all on function public.operator_app_brief(uuid) from public, anon;
grant execute on function public.operator_app_brief(uuid) to authenticated;

-- Issiq / iliq / ma'lumot yig'yapti — «Ilova lidlari navbati» hisobotidagi
-- qoida: til sertifikati + rasmiy daromad hujjati = issiq; sertifikat bor,
-- lekin daromad hujjati yo'q yoki 18 yoshdan kichik = iliq; sertifikat yo'q =
-- ma'lumot yig'yapti.
create or replace function public.fn_operator_app_tier(p_installs uuid[])
returns text
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  with last as (
    select distinct on (e.props->>'q') e.props->>'q' as q, e.props->>'band' as v
      from public.app_events e
     where e.install_id = any (p_installs)
       and e.event = 'question_answer'
       and e.props->>'q' in ('ielts', 'topik', 'income_documented', 'age')
     order by e.props->>'q', e.occurred_at desc
  )
  select case
    when coalesce((select nullif(v, '')::numeric from last where q = 'ielts'), 0) <= 0
     and coalesce((select nullif(v, '')::numeric from last where q = 'topik'), 0) <= 0 then 'cool'
    when (select v from last where q = 'income_documented') = 'true'
     and coalesce((select nullif(v, '')::numeric from last where q = 'age'), 18) >= 18 then 'hot'
    else 'warm'
  end;
$$;

revoke all on function public.fn_operator_app_tier(uuid[]) from public, anon, authenticated;

create or replace function public.operator_app_leads(p_days integer default 14)
returns table(
  lead_id uuid,
  name text,
  link_code text,
  channel text,
  has_phone boolean,
  lead_status text,
  thread_id uuid,
  last_incoming_at timestamptz,
  last_human_out_at timestamptz,
  waiting boolean,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  visits integer,
  tier text,
  route text,
  tariff text,
  picks text[]
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if not public.app_events_staff_can_read() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with th as (
    select t.lead_id, t.id, t.last_incoming_at, t.last_human_out_at,
           row_number() over (partition by t.lead_id order by t.last_incoming_at desc nulls last) as rn
      from public.get_thread_previews(null) t
     where t.lead_id is not null
  )
  select l.id,
         l.full_name::text,
         l.link_code::text,
         coalesce(l.contact_channel, l.source)::text,
         coalesce(l.phone, '') <> '',
         l.status::text,
         th.id,
         th.last_incoming_at,
         th.last_human_out_at,
         th.last_incoming_at is not null
           and (th.last_human_out_at is null or th.last_human_out_at < th.last_incoming_at),
         p.first_seen_at,
         p.last_seen_at,
         p.visits::integer,
         public.fn_operator_app_tier(p.installs),
         (select e.props->>'band' from public.app_events e
           where e.install_id = any (p.installs) and e.event = 'question_answer' and e.props->>'q' = 'route'
           order by e.occurred_at desc limit 1),
         coalesce(p.tariff, l.tariff_interest)::text,
         (select array_agg(coalesce(i.name_en, i.name_ko) order by x.ord)
            from unnest(p.picks) with ordinality as x(iid, ord)
            join public.institutions i on i.id::text = x.iid)
    from public.app_person_profile p
    join public.leads l on l.id = p.lead_id
    left join th on th.lead_id = l.id and th.rn = 1
   where not coalesce(p.is_test, false)
     and l.converted_to_student_id is null
     and greatest(p.last_seen_at, th.last_incoming_at, l.created_at) >= now() - make_interval(days => greatest(p_days, 1))
   order by
     (th.last_incoming_at is not null
       and (th.last_human_out_at is null or th.last_human_out_at < th.last_incoming_at)) desc,
     th.last_incoming_at asc nulls last,
     p.last_seen_at desc nulls last;
end;
$$;

revoke all on function public.operator_app_leads(integer) from public, anon;
grant execute on function public.operator_app_leads(integer) to authenticated;
