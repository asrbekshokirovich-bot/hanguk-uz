-- Hanguk AI 2.0 — 1-bosqich: universitet bilimi tool'lari (reja §5.1).
--
-- Hanguk AI bazadagi yo'riqnomalarni (university_guidelines + rounds, faculties,
-- docs, grants; 2026-10-29: 173 / 3 278 / 6 435 / 2 061 / 824 qator) umuman
-- ko'rmas edi. Bu RPC'lar ularni agentga beradi:
--
--   ai_uni_search       nom / shahar / daraja / til talabi bo'yicha qidiruv
--   ai_uni_card         bitta yo'riqnoma: to'lovlar, bank, til, kontrakt, bosqichlar
--   ai_uni_faculties    fakultetlar (track, TOPIK/IELTS/TOEFL, kontrakt)
--   ai_uni_documents    hujjatlar (majburiy, apostil, notarial, muddat)
--   ai_uni_grants       grant jadvali (ilovadagi app_university_grants bilan bir manba)
--   ai_uni_deadlines    N kun ichidagi bosqichlar (talabaning universitetlari birinchi)
--   ai_uni_compare      2–4 yo'riqnoma yonma-yon
--   ai_uni_eligibility  TOPIK/IELTS → qaysi fakultetlar ochiq (faqat jadvaldagi minimumlar)
--   ai_gks_info, ai_glossary, ai_announcements
--
-- Kim nimani ko'radi (D4 standart varianti): yo'riqnoma ma'lumoti hammaga
-- (u universitetning ochiq hujjati); xodim izohlari (institution_notes) va
-- yuklagan/fayl nomi faqat xodimga. Har natijada `source` — javobda manba
-- ko'rsatish uchun. Mehmon chaqiruvlari edge funksiyadan service role bilan
-- keladi (auth.uid() bo'sh → talaba darajasi).

-- Joriy mavsum: intakes.is_default (2026-10: Spring 2027 → 2027 bahor).
create or replace function public.ai_uni_season()
returns table (qabul_yili integer, semestr text)
language sql
stable
security definer
set search_path = public
as $$
  select i.year, case i.season when 'spring' then 'bahor' when 'fall' then 'kuz' else i.season end
    from intakes i
   where i.is_default
   order by i.year desc
   limit 1;
$$;

create or replace function public.ai_uni_source(g public.university_guidelines)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'kind', 'guideline',
    'label', concat_ws(' ', coalesce(i.name_en, g.univ_nomi_en), g.qabul_yili::text, g.semestr,
                       case g.daraja when 'bakalavr' then 'bakalavr' when 'magistratura' then 'magistratura'
                                     when 'til_kursi' then 'til kursi' when 'kasbiy' then 'kasbiy' else g.daraja end),
    'file', g.guideline_fayl,
    'pages', g.sahifalar,
    'date', g.tahlil_sanasi)
    from institutions i where i.id = g.institution_id
$$;

create or replace function public.ai_uni_search(
  p_query text default null,
  p_daraja text default null,
  p_city text default null,
  p_max_topik numeric default null,
  p_max_ielts numeric default null,
  p_english_track boolean default null,
  p_limit integer default 15
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
  ql text := lower(nullif(btrim(coalesce(p_query, '')), ''));
  v jsonb;
  n integer;
begin
  with season as (select * from ai_uni_season()),
  cand as (
    select i.id as institution_id, i.name_en, i.name_ko, i.city_ko, i.ieqas_status, i.is_partner, i.visa_restricted,
           g.id as guideline_id, g.daraja, g.qabul_yili, g.semestr, g.shahar, g.topik_min, g.ielts_min,
           g.english_track, g.korean_track, g.kontrakt_min, g.kontrakt_max, g.narx_valyuta,
           g.ariza_tolovi, g.ariza_tolovi_valyuta, g.grant_holat, g.tahlil_sanasi,
           (g.qabul_yili = s.qabul_yili and g.semestr = s.semestr) as current_season,
           case when ql is null then 0 else greatest(
             similarity(lower(coalesce(i.name_en, '')), ql),
             similarity(coalesce(i.name_ko, ''), q),
             word_similarity(ql, lower(concat_ws(' ', i.name_en, i.romanization, i.name_ko_short, i.name_ko, i.display_names::text, g.univ_nomi_en))))
           end as score
      from institutions i
      cross join season s
      left join university_guidelines g
             on g.institution_id = i.id and (p_daraja is null or g.daraja = p_daraja)
     where coalesce(i.is_active, true)
       and (ql is not null or g.id is not null)
       and (ql is null
            or lower(concat_ws(' ', i.name_en, i.romanization, i.name_ko_short, i.name_ko, i.display_names::text, g.univ_nomi_en, g.univ_nomi_kr)) like '%' || ql || '%'
            or word_similarity(ql, lower(concat_ws(' ', i.name_en, i.romanization, i.name_ko_short, g.univ_nomi_en))) >= 0.5)
       and (p_city is null or i.city_ko ilike '%' || p_city || '%' or g.shahar ilike '%' || p_city || '%')
       and (p_daraja is null or g.id is not null)
       and (p_max_topik is null or (g.id is not null and coalesce(g.topik_min, 0) <= p_max_topik))
       and (p_max_ielts is null or (g.id is not null and coalesce(g.ielts_min, 0) <= p_max_ielts))
       and (p_english_track is null or g.english_track = p_english_track)
  )
  select count(*), jsonb_agg(to_jsonb(c) - 'score' order by c.score desc, c.name_en, c.daraja)
    into n, v
    from (select * from cand order by score desc, name_en, daraja limit greatest(1, least(coalesce(p_limit, 15), 50))) c;

  return jsonb_build_object(
    'season', (select to_jsonb(s) from ai_uni_season() s),
    'shown', coalesce(n, 0),
    'results', coalesce(v, '[]'::jsonb),
    'note', 'guideline_id null = this university has no guideline in the database for that level');
end;
$$;

-- Resolves (guideline | institution + level) to one guideline id.
create or replace function public.ai_uni_pick(p_guideline_id uuid, p_institution_id uuid, p_daraja text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_guideline_id,
    (select g.id from university_guidelines g, ai_uni_season() s
      where g.institution_id = p_institution_id
        and (p_daraja is null or g.daraja = p_daraja)
      order by (g.qabul_yili = s.qabul_yili and g.semestr = s.semestr) desc, g.qabul_yili desc, g.updated_at desc
      limit 1));
$$;

create or replace function public.ai_uni_card(
  p_guideline_id uuid default null,
  p_institution_id uuid default null,
  p_daraja text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_staff boolean := public.ai_is_staff(auth.uid());
  v_id uuid;
  g university_guidelines;
  v jsonb;
begin
  if p_guideline_id is null and p_institution_id is null then
    return jsonb_build_object('error', 'give guideline_id or institution_id (from uni_search)');
  end if;
  -- Several levels and none asked: list them instead of picking one.
  if p_guideline_id is null and p_daraja is null
     and (select count(*) from university_guidelines where institution_id = p_institution_id) > 1 then
    return jsonb_build_object(
      'choose_level', (select jsonb_agg(jsonb_build_object('guideline_id', id, 'daraja', daraja, 'qabul_yili', qabul_yili, 'semestr', semestr) order by daraja)
                         from university_guidelines where institution_id = p_institution_id),
      'note', 'this university has several guidelines; call again with guideline_id or daraja');
  end if;

  v_id := ai_uni_pick(p_guideline_id, p_institution_id, p_daraja);
  select * into g from university_guidelines where id = v_id;
  if g.id is null then
    return jsonb_build_object('error', 'no guideline in the database for this university / level',
      'university', (select jsonb_build_object('name_en', name_en, 'name_ko', name_ko, 'admissions_url', primary_admissions_url_ko)
                       from institutions where id = p_institution_id));
  end if;

  select jsonb_build_object(
    'university', jsonb_build_object(
      'institution_id', i.id, 'name_en', i.name_en, 'name_ko', i.name_ko, 'city', coalesce(g.shahar, i.city_ko),
      'campus', g.kampus, 'ieqas_status', i.ieqas_status, 'is_partner', i.is_partner,
      'visa_restricted', i.visa_restricted, 'admissions_url', i.primary_admissions_url_ko),
    'guideline', (to_jsonb(g) - 'yuklagan' - 'fayl_nomi' - 'format_versiya' - 'created_at' - 'id' - 'institution_id' - 'guideline_id')
                 || jsonb_build_object('guideline_id', g.id),
    'is_current_season', exists (select 1 from ai_uni_season() s where s.qabul_yili = g.qabul_yili and s.semestr = g.semestr),
    'current_season', (select to_jsonb(s) from ai_uni_season() s),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bosqich', r.bosqich, 'etap', r.etap_nomi,
               'start', r.boshlanish_sana, 'start_time', r.boshlanish_vaqt,
               'end', r.tugash_sana, 'end_time', r.tugash_vaqt,
               'holat', r.holat, 'izoh', r.izoh, 'sahifa', r.sahifa)
             order by r.bosqich, r.etap_raqam)
        from university_guideline_rounds r where r.guideline_uuid = g.id), '[]'::jsonb),
    'round_status_meaning', jsonb_build_object(
      'tasdiqlangan', 'date stated in the guideline', 'taxminiy', 'estimated date', 'nisbiy', 'relative to another step',
      'keyin_elon', 'the university will announce it later', 'etap_yoq', 'this step does not exist here'),
    'counts', jsonb_build_object(
      'faculties', (select count(*) from university_guideline_faculties f where f.guideline_uuid = g.id),
      'documents', (select count(*) from university_guideline_docs d where d.guideline_uuid = g.id),
      'grants', (select count(*) from university_guideline_grants x where x.guideline_uuid = g.id)),
    'other_levels', coalesce((
      select jsonb_agg(jsonb_build_object('guideline_id', o.id, 'daraja', o.daraja, 'qabul_yili', o.qabul_yili, 'semestr', o.semestr))
        from university_guidelines o where o.institution_id = g.institution_id and o.id <> g.id), '[]'::jsonb),
    'staff_notes', case when v_staff then coalesce((
      select jsonb_agg(jsonb_build_object('type', n.note_type, 'note', n.content, 'updated', n.updated_at::date))
        from institution_notes n where n.institution_id = g.institution_id and coalesce(n.is_active, true)), '[]'::jsonb) end,
    'source', ai_uni_source(g)
  ) into v
  from institutions i where i.id = g.institution_id;

  return v;
end;
$$;

create or replace function public.ai_uni_faculties(
  p_guideline_id uuid,
  p_query text default null,
  p_track text default null,
  p_max_topik numeric default null,
  p_max_ielts numeric default null,
  p_limit integer default 60
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  g university_guidelines;
  ql text := lower(nullif(btrim(coalesce(p_query, '')), ''));
  v jsonb;
  total integer;
begin
  select * into g from university_guidelines where id = p_guideline_id;
  if g.id is null then return jsonb_build_object('error', 'guideline not found'); end if;

  select count(*) into total from university_guideline_faculties f where f.guideline_uuid = g.id;

  select jsonb_agg(x order by (x->>'tartib')::int) into v from (
    select jsonb_build_object(
             'tartib', f.tartib, 'track', f.track,
             'college', coalesce(f.kollej_en, f.kollej_kr), 'college_ko', f.kollej_kr,
             'major', coalesce(f.fakultet_en, f.fakultet_kr), 'major_ko', f.fakultet_kr,
             'topik_min', coalesce(f.topik_min, case when f.track = 'korean' then g.topik_min end),
             'ielts_min', coalesce(f.ielts_min, case when f.track = 'english' then g.ielts_min end),
             'toefl_ibt_min', f.toefl_ibt_min, 'language_note', f.til_izoh,
             'tuition', f.kontrakt_summa, 'tuition_period', coalesce(f.kontrakt_davri, g.kontrakt_davri),
             'tuition_currency', g.narx_valyuta, 'tuition_note', f.kontrakt_izoh, 'note', f.izoh, 'sahifa', f.sahifa) as x
      from university_guideline_faculties f
     where f.guideline_uuid = g.id
       and (p_track is null or f.track = p_track)
       and (ql is null or lower(concat_ws(' ', f.kollej_en, f.kollej_kr, f.fakultet_en, f.fakultet_kr)) like '%' || ql || '%')
       and (p_max_topik is null or coalesce(f.topik_min, g.topik_min) <= p_max_topik)
       and (p_max_ielts is null or coalesce(f.ielts_min, g.ielts_min) <= p_max_ielts)
     order by f.tartib
     limit greatest(1, least(coalesce(p_limit, 60), 150))
  ) s;

  return jsonb_build_object('total_faculties', total, 'shown', coalesce(jsonb_array_length(v), 0),
                            'faculties', coalesce(v, '[]'::jsonb), 'source', ai_uni_source(g));
end;
$$;

create or replace function public.ai_uni_documents(p_guideline_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  g university_guidelines;
begin
  select * into g from university_guidelines where id = p_guideline_id;
  if g.id is null then return jsonb_build_object('error', 'guideline not found'); end if;
  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tartib', d.tartib, 'stage', d.etap_raqam, 'document', d.hujjat_nomi, 'original_name', d.hujjat_nomi_asl,
               'who', d.kimlar_uchun, 'required', d.majburiy, 'form', d.shakli, 'apostille', d.apostil,
               'notarized_translation', d.notarial_tarjima, 'deadline', d.muddat, 'deadline_type', d.muddat_turi,
               'note', d.izoh, 'sahifa', d.sahifa)
             order by d.tartib)
        from university_guideline_docs d where d.guideline_uuid = g.id), '[]'::jsonb),
    'send_address', g.hujjat_yuborish_manzili,
    'recommendation_letter', g.tavsiyanoma, 'recommendation_note', g.tavsiyanoma_izoh,
    'required_meaning', jsonb_build_object('ha', 'required', 'shartli', 'required only in some cases (see who / note)', 'ixtiyoriy', 'optional'),
    'source', ai_uni_source(g));
end;
$$;

create or replace function public.ai_uni_grants(p_guideline_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  g university_guidelines;
begin
  select * into g from university_guidelines where id = p_guideline_id;
  if g.id is null then return jsonb_build_object('error', 'guideline not found'); end if;
  return jsonb_build_object(
    'grant_status', g.grant_holat, 'grant_min_pct', g.grant_min, 'grant_max_pct', g.grant_max,
    'grant_other', g.grant_boshqa, 'grant_note', g.grant_izoh, 'grant_checked', g.grant_tekshirilgan,
    'status_meaning', jsonb_build_object(
      'kirishda', 'granted at admission', 'oqish_davomida', 'only during studies (by GPA)',
      'tilga_bogliq_emas', 'not tied to language level', 'malumot_yoq', 'the guideline has no grant information',
      'aniq_emas', 'unclear in the guideline'),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tartib', x.tartib, 'when', x.qachon, 'name', x.nomi, 'who', x.kimlar_uchun,
               'criterion', x.mezon, 'requirement', x.talab,
               'topik_min', x.topik_min, 'topik_max', x.topik_max, 'ielts_min', x.ielts_min,
               'toefl_ibt_min', x.toefl_ibt_min, 'other_test', x.boshqa_test,
               'percent', x.grant_foiz, 'percent_of', x.grant_asosi,
               'amount', x.grant_summa, 'amount_currency', x.grant_valyuta, 'extra', x.grant_qoshimcha,
               'duration', x.muddat, 'keep_condition', x.davom_shart, 'campus', x.kampus,
               'for_what', x.nimaga, 'quote', x.iqtibos, 'sahifa', x.sahifa)
             order by x.tartib)
        from university_guideline_grants x where x.guideline_uuid = g.id), '[]'::jsonb),
    'source', ai_uni_source(g));
end;
$$;

create or replace function public.ai_uni_deadlines(
  p_days integer default 30,
  p_daraja text default null,
  p_etap text default null,
  p_mine boolean default false,
  p_student_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_student uuid;
  v jsonb;
begin
  -- A student only ever sees their own list; staff may name a student.
  v_student := case when public.ai_is_staff(auth.uid()) then p_student_id else auth.uid() end;
  with mine as (
    select u.institution_id from student_universities_of(v_student) u where v_student is not null
  )
  select jsonb_agg(x order by (x->>'date')::date, x->>'university') into v from (
    select jsonb_build_object(
             'university', coalesce(i.name_en, i.name_ko), 'guideline_id', g.id, 'daraja', g.daraja,
             'qabul_yili', g.qabul_yili, 'semestr', g.semestr, 'etap', r.etap_nomi, 'bosqich', r.bosqich,
             'date', coalesce(r.tugash_sana, r.boshlanish_sana),
             'date_is', case when r.tugash_sana is not null then 'end' else 'start' end,
             'holat', r.holat,
             'days_left', coalesce(r.tugash_sana, r.boshlanish_sana) - v_today,
             'is_mine', g.institution_id in (select institution_id from mine)) as x
      from university_guideline_rounds r
      join university_guidelines g on g.id = r.guideline_uuid
      join institutions i on i.id = g.institution_id
      cross join ai_uni_season() s
     where g.qabul_yili = s.qabul_yili and g.semestr = s.semestr
       and coalesce(r.tugash_sana, r.boshlanish_sana) between v_today and v_today + greatest(1, least(coalesce(p_days, 30), 180))
       and coalesce(r.holat, '') <> 'etap_yoq'
       and (p_daraja is null or g.daraja = p_daraja)
       and (p_etap is null or r.etap_nomi ilike '%' || p_etap || '%')
       and (not coalesce(p_mine, false) or g.institution_id in (select institution_id from mine))
     limit 200
  ) t;
  return jsonb_build_object('today', v_today, 'days', p_days, 'items', coalesce(v, '[]'::jsonb),
    'note', 'etap names: Online hujjat topshirish, Offline hujjat topshirish, Application fee to''lash, Intervyu, Natija e''lon qilinishi, Kontrakt to''lash, Certificate of Admission berilishi, Vizaga hujjat topshirish');
end;
$$;

create or replace function public.ai_uni_compare(p_guideline_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
  select jsonb_build_object('universities', coalesce(jsonb_agg(jsonb_build_object(
      'university', coalesce(i.name_en, i.name_ko), 'guideline_id', g.id, 'daraja', g.daraja,
      'qabul_yili', g.qabul_yili, 'semestr', g.semestr, 'city', coalesce(g.shahar, i.city_ko),
      'topik_min', g.topik_min, 'ielts_min', g.ielts_min, 'english_track', g.english_track,
      'application_fee', g.ariza_tolovi, 'application_fee_currency', g.ariza_tolovi_valyuta,
      'bank_amount', g.bank_summa, 'bank_currency', g.bank_valyuta,
      'tuition_min', g.kontrakt_min, 'tuition_max', g.kontrakt_max, 'tuition_currency', g.narx_valyuta,
      'tuition_period', g.kontrakt_davri, 'entrance_fee', g.kirish_tolovi,
      'grant_status', g.grant_holat, 'grant_min_pct', g.grant_min, 'grant_max_pct', g.grant_max,
      'faculties', g.fakultet_soni,
      'documents', (select count(*) from university_guideline_docs d where d.guideline_uuid = g.id),
      'online_end', (select min(r.tugash_sana) from university_guideline_rounds r
                      where r.guideline_uuid = g.id and r.etap_nomi = 'Online hujjat topshirish'),
      'ieqas_status', i.ieqas_status,
      'source', ai_uni_source(g)) order by array_position(p_guideline_ids, g.id)), '[]'::jsonb))
    from university_guidelines g join institutions i on i.id = g.institution_id
   where g.id = any (p_guideline_ids[1:4]);
$$;

create or replace function public.ai_uni_eligibility(
  p_topik numeric default null,
  p_ielts numeric default null,
  p_daraja text default 'bakalavr',
  p_guideline_ids uuid[] default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '6s'
as $$
declare
  v_topik numeric := p_topik;
  v_ielts numeric := p_ielts;
  v_from_profile boolean := false;
  v jsonb;
begin
  -- A student who gives no score is checked with their own profile values.
  if v_topik is null and v_ielts is null and auth.uid() is not null and not public.ai_is_staff(auth.uid()) then
    select p.topik_level, p.ielts_score into v_topik, v_ielts from profiles p where p.user_id = auth.uid();
    v_from_profile := true;
  end if;
  if v_topik is null and v_ielts is null then
    return jsonb_build_object('error', 'give topik and/or ielts (no scores on the profile)');
  end if;

  with season as (select * from ai_uni_season()),
  gl as (
    select g.* from university_guidelines g, season s
     where (p_guideline_ids is not null and g.id = any (p_guideline_ids))
        or (p_guideline_ids is null and g.daraja = coalesce(p_daraja, 'bakalavr')
            and g.qabul_yili = s.qabul_yili and g.semestr = s.semestr)
  ),
  per as (
    select g.id, g.institution_id, g.daraja, g.topik_min, g.ielts_min,
           count(f.*) as total,
           count(f.*) filter (where f.track = 'korean' and v_topik is not null
                                and coalesce(f.topik_min, g.topik_min) is not null
                                and coalesce(f.topik_min, g.topik_min) <= v_topik) as open_korean,
           count(f.*) filter (where f.track = 'english' and v_ielts is not null
                                and coalesce(f.ielts_min, g.ielts_min) is not null
                                and coalesce(f.ielts_min, g.ielts_min) <= v_ielts) as open_english,
           count(f.*) filter (where (f.track = 'korean' and coalesce(f.topik_min, g.topik_min) is null)
                                 or (f.track = 'english' and coalesce(f.ielts_min, g.ielts_min) is null)) as no_requirement_listed,
           min(coalesce(f.topik_min, g.topik_min)) filter (where f.track = 'korean') as lowest_topik,
           min(coalesce(f.ielts_min, g.ielts_min)) filter (where f.track = 'english') as lowest_ielts
      from gl g left join university_guideline_faculties f on f.guideline_uuid = g.id
     group by g.id, g.institution_id, g.daraja, g.topik_min, g.ielts_min
  )
  select jsonb_agg(x order by (x->>'open_faculties')::int desc, x->>'university') into v from (
    select jsonb_build_object(
             'university', coalesce(i.name_en, i.name_ko), 'guideline_id', per.id, 'daraja', per.daraja,
             'total_faculties', per.total,
             'open_faculties', per.open_korean + per.open_english,
             'open_korean_track', per.open_korean, 'open_english_track', per.open_english,
             'no_requirement_listed', per.no_requirement_listed,
             'lowest_topik_required', per.lowest_topik, 'lowest_ielts_required', per.lowest_ielts,
             'guideline_topik_min', per.topik_min, 'guideline_ielts_min', per.ielts_min) as x
      from per join institutions i on i.id = per.institution_id
     order by per.open_korean + per.open_english desc, i.name_en
     limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) t;

  return jsonb_build_object(
    'checked_with', jsonb_build_object('topik', v_topik, 'ielts', v_ielts, 'from_profile', v_from_profile),
    'rule', 'open = the faculty''s own minimum (or the guideline''s general minimum) is listed and met; only the language requirement is checked, not GPA, documents or interview; this is NOT an admission chance',
    'results', coalesce(v, '[]'::jsonb));
end;
$$;

create or replace function public.ai_gks_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('programs', coalesce(jsonb_agg(jsonb_build_object(
      'year', p.year, 'level', p.program_level, 'track', p.track_type, 'sub_track', p.sub_track,
      'total_slots', p.total_slots, 'announcement', p.announcement_date,
      'application_start', p.application_start, 'application_end', p.application_end,
      'review', concat_ws(' – ', p.review_period_start::text, p.review_period_end::text),
      'result', p.result_date, 'benefits', p.benefits, 'eligibility', p.eligibility,
      'contact', p.contact_email, 'notes', p.notes,
      'designated_universities', (select count(*) from gks_designated_universities d where d.gks_program_info_id = p.id))
      order by p.year desc, p.program_level, p.track_type), '[]'::jsonb))
    from gks_program_info p;
$$;

create or replace function public.ai_glossary(p_term text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('terms', coalesce(jsonb_agg(jsonb_build_object(
      'ko', t.term_ko, 'lang', t.term_lang, 'value', t.term_value, 'category', t.category, 'official', t.authoritative)), '[]'::jsonb))
    from (select * from term_glossary
           where term_ko ilike '%' || coalesce(p_term, '') || '%' or term_value ilike '%' || coalesce(p_term, '') || '%'
           limit 20) t;
$$;

create or replace function public.ai_announcements(p_institution_id uuid default null, p_days integer default 60)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('announcements', coalesce(jsonb_agg(jsonb_build_object(
      'university', coalesce(i.name_en, i.name_ko), 'title_ko', a.title_ko, 'url', a.url_ko,
      'posted', a.posted_at::date, 'detected', a.detected_at::date, 'label', a.classifier_label)
      order by coalesce(a.posted_at, a.detected_at) desc), '[]'::jsonb))
    from (select a.* from announcements a
            join announcement_sources s on s.id = a.source_id
           where (p_institution_id is null or s.institution_id = p_institution_id)
             and coalesce(a.posted_at, a.detected_at) >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 60), 365)))
           order by coalesce(a.posted_at, a.detected_at) desc
           limit 30) a
    join announcement_sources s on s.id = a.source_id
    left join institutions i on i.id = s.institution_id;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'ai_uni_season()', 'ai_uni_source(public.university_guidelines)',
    'ai_uni_search(text, text, text, numeric, numeric, boolean, integer)',
    'ai_uni_pick(uuid, uuid, text)', 'ai_uni_card(uuid, uuid, text)',
    'ai_uni_faculties(uuid, text, text, numeric, numeric, integer)', 'ai_uni_documents(uuid)',
    'ai_uni_grants(uuid)', 'ai_uni_deadlines(integer, text, text, boolean, uuid)',
    'ai_uni_compare(uuid[])', 'ai_uni_eligibility(numeric, numeric, text, uuid[], integer)',
    'ai_gks_info()', 'ai_glossary(text)', 'ai_announcements(uuid, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- query_database (owner/admin) can now count and join over the guidelines too.
create or replace view ai.guidelines as
  select g.id as guideline_id, g.institution_id, coalesce(i.name_en, g.univ_nomi_en) as university_name,
         g.qabul_yili, g.semestr, g.daraja, g.shahar, g.english_track, g.korean_track,
         g.topik_min, g.ielts_min, g.toefl_ibt_min, g.ariza_tolovi, g.ariza_tolovi_valyuta,
         g.bank_summa, g.bank_valyuta, g.kontrakt_min, g.kontrakt_max, g.narx_valyuta, g.kontrakt_davri,
         g.kirish_tolovi, g.fakultet_soni, g.grant_holat, g.grant_min, g.grant_max, g.tahlil_sanasi
    from public.university_guidelines g join public.institutions i on i.id = g.institution_id;

create or replace view ai.guideline_rounds as
  select r.guideline_uuid as guideline_id, r.bosqich, r.etap_nomi, r.boshlanish_sana, r.tugash_sana, r.holat
    from public.university_guideline_rounds r;

create or replace view ai.guideline_faculties as
  select f.guideline_uuid as guideline_id, f.track, f.kollej_en, f.fakultet_en, f.fakultet_kr,
         f.topik_min, f.ielts_min, f.toefl_ibt_min, f.kontrakt_summa, f.kontrakt_davri
    from public.university_guideline_faculties f;

create or replace view ai.guideline_docs as
  select d.guideline_uuid as guideline_id, d.hujjat_nomi, d.kimlar_uchun, d.majburiy, d.apostil, d.notarial_tarjima, d.muddat
    from public.university_guideline_docs d;

create or replace view ai.guideline_grants as
  select x.guideline_uuid as guideline_id, x.qachon, x.mezon, x.topik_min, x.topik_max, x.ielts_min,
         x.grant_foiz, x.grant_summa, x.grant_valyuta, x.muddat
    from public.university_guideline_grants x;
