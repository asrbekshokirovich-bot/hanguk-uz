-- "Viza imkoniyatim" follows the Korean embassy in Tashkent (owner, 2026-10-05).
--
-- The embassy's student visa notice of 2026-06-12 (overseas.mofa.go.kr,
-- uz-ko m_8550 seq 1329502) is the basis. The result is now three checks:
--   * language: TOPIK 1 for the language course, 2 for a college, 3 for a
--     bachelor's, 4 for a master's, or IELTS 5.5+ for an English-taught
--     programme. Without it the application is refused without an interview:
--     the result is low;
--   * money: the KDB deposit in the student's name (new question 9) and the
--     parents' formal income, both required; a budget under the deposit;
--   * soft points: age, the gap since school, a budget under the yearly cost.
-- The Korean answer "TOPIK 3 va yuqori" is split into "TOPIK 3" and
-- "TOPIK 4 va yuqori" (codes topik3, topik4plus; old leads keep topik3plus).
--
-- 1. The rules the app reads (eligibility_rules), with the embassy's numbers.
-- 2. institutions.visa_restricted: the universities the embassy gives almost no
--    visas to from the fall 2026 semester, for a year. The app never suggests
--    them. The 7 named degree universities are marked; the 9 graduate schools
--    and 4 language institutes the notice does not name are not.
-- 3. v_app_university_catalog: + region_code (the deposit and the cost of
--    living follow the university's area: Seoul/Gyeonggi/Incheon or elsewhere)
--    and visa_restricted.
-- 4. app_quiz_submit: the new Korean codes onto the CRM's certificate field.

-- 1. Rules -----------------------------------------------------------------------
insert into public.eligibility_rules (key, value, note) values
  ('lang_ok_bonus',            '2',              'Til talabi bajarilgan'),
  ('lang_unknown_bonus',       '1',              'Til darajasi "Hali bilmayman" (eng ko''pi o''rta)'),
  ('lang_missing_cap',         '"low"',          'Til talabi bajarilmagan — elchixona suhbatsiz rad etadi'),
  ('money_ok_bonus',           '2',              'KDB depozit tayyor va ota-onada rasmiy daromad bor'),
  ('money_unknown_bonus',      '1',              'KDB depozit "Hali bilmayman" (eng ko''pi o''rta)'),
  ('money_partial_cap',        '"mid"',          'Depozit qabulgacha / daromad yo''q / byudjet depozitdan kam — eng ko''pi o''rta'),
  ('money_missing_cap',        '"low"',          'KDB depozit yo''q yoki byudjet depozitning yarmidan kam — past'),
  ('d4_topik_min',             '1',              'Til kursi: elchixona talab qiladigan TOPIK'),
  ('voc_topik_min',            '2',              'Kasbiy kollej: elchixona talab qiladigan TOPIK'),
  ('d2_bachelor_topik_min',    '3',              'Bakalavr: elchixona talab qiladigan TOPIK'),
  ('d2_master_topik_min',      '4',              'Magistratura: elchixona talab qiladigan TOPIK'),
  ('d4_kdb_usd',               '[6300, 7800]',   'Til kursi: KDB depozit, $ [boshqa shaharlar, Seul/Gyeonggi/Incheon]'),
  ('d2_kdb_usd',               '[12500, 15500]', 'Kollej, bakalavr, magistr: KDB depozit, $ [boshqa shaharlar, Seul/Gyeonggi/Incheon]'),
  ('d4_kdb_hold_months',       '3',              'Til kursi: depozit kamida shuncha oy turishi kerak'),
  ('d2_kdb_hold_months',       '1',              'Kollej, bakalavr, magistr: depozit kamida shuncha oy turishi kerak'),
  ('budget_kdb_missing_share', '0.5',            'Byudjet depozitning shu ulushidan kam bo''lsa — moliya talabi bajarilmagan'),
  ('soft_penalty',             '1',              'Yosh yoki bitiruvdan keyingi tanaffus uchun −1')
on conflict (key) do nothing;

-- High needs both checks met and no soft point: 2 + 2 + 2 = 6.
update public.eligibility_rules set value = '6', note = 'Ball shundan katta yoki teng bo''lsa — yuqori (til + moliya bajarilgan, yumshoq omil yo''q)', updated_at = now()
 where key = 'band_high_min';
update public.eligibility_rules set value = '3', note = 'Ball shundan katta yoki teng bo''lsa — o''rta, aks holda past', updated_at = now()
 where key = 'band_mid_min';
update public.eligibility_rules set note = 'Bakalavr/magistr ingliz tilidagi dastur: shu IELTS va yuqori — til talabi bajarilgan', updated_at = now()
 where key = 'd2_master_ielts_min';

update public.eligibility_rules set note = 'Ishlatilmaydi (2026-10-05 dan: lang_*, money_*, *_topik_min)', updated_at = now()
 where key in ('d2_topik_ok_bonus', 'd2_topik2_cap', 'd2_no_cert_cap', 'voc_topik3_bonus', 'voc_topik2_bonus',
               'd4_cert_bonus', 'fin_both_ok_bonus', 'fin_no_income_cap', 'fin_none_cap');

-- 2. Restricted universities ----------------------------------------------------
alter table public.institutions
  add column if not exists visa_restricted boolean not null default false;

comment on column public.institutions.visa_restricted is
  'Elchixona viza deyarli bermaydigan universitet (비자정밀 심사대학, 2026 kuzidan 1 yil). Ilova testi uni taklif qilmaydi.';

-- 금강대, 수원가톨릭대, 중앙승가대, 협성대, 부산경상대, 부산예술대, 한영대.
update public.institutions
   set visa_restricted = true
 where name_ko in ('금강대학교', '수원가톨릭대학교', '중앙승가대학교', '협성대학교',
                   '부산경상대학교', '부산예술대학교', '한영대학교');

-- 3. Catalogue ------------------------------------------------------------------
create or replace view public.v_app_university_catalog as
select
  g.id as guideline_id,
  g.institution_id,
  i.name_ko,
  i.name_ko_short,
  i.name_en,
  i.city_ko,
  i.institution_type,
  g.univ_nomi_en,
  g.univ_nomi_kr,
  g.kampus,
  g.shahar,
  g.qabul_yili,
  g.semestr,
  g.daraja,
  g.english_track,
  g.korean_track,
  g.topik_min,
  g.ielts_min,
  g.toefl_ibt_min,
  g.narx_valyuta,
  g.kirish_tolovi,
  g.kontrakt_min,
  g.kontrakt_max,
  g.kontrakt_davri,
  g.fakultet_soni,
  g.ariza_tolovi,
  g.ariza_tolovi_valyuta,
  g.bank_summa,
  g.bank_valyuta,
  g.tavsiyanoma,
  g.updated_at,
  i.ieqas_status,
  i.is_active,
  i.is_partner,
  i.region_code,
  i.visa_restricted
from public.university_guidelines g
join public.institutions i on i.id = g.institution_id;

grant select on public.v_app_university_catalog to anon, authenticated;

-- 4. Quiz submit: TOPIK 3 and TOPIK 4+ -------------------------------------------
-- As in 20261005090000_app_quiz.sql, with the two new Korean codes.
create or replace function public.app_quiz_submit(
  p_phone   text,
  p_name    text,
  p_answers jsonb,
  p_result  jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_national text := public.fn_uz_national_phone(p_phone);
  v_phone    text;
  v_pretty   text;
  v_name     text := nullif(btrim(coalesce(p_name, '')), '');
  v_lead     public.leads%rowtype;
  v_lead_id  uuid;
  v_code     text;
  v_band     text := p_result ->> 'band';
  v_note     text;
  v_edu      text;
  v_cert     text;
  v_intake   text;
  v_age      int;
begin
  if v_national is null then
    return jsonb_build_object('status', 'invalid_phone');
  end if;
  if v_name is null or length(v_name) > 80 then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or p_result is null or jsonb_typeof(p_result) <> 'object'
     or length(p_answers::text) > 4000 or length(p_result::text) > 20000 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_band is not null and v_band not in ('high', 'mid', 'low') then
    v_band := null;
  end if;

  if public.fn_is_student_phone(v_national) then
    return jsonb_build_object('status', 'student');
  end if;

  v_phone := '+998' || v_national;
  v_pretty := '+998 ' || substr(v_national, 1, 2) || ' ' || substr(v_national, 3, 3)
           || ' ' || substr(v_national, 6, 2) || ' ' || substr(v_national, 8, 2);

  -- Answers mapped onto the CRM's own buckets (src/components/crm/leads/intake/options.ts).
  v_edu := case p_answers ->> 'route'
             when 'bachelor' then 'Bakalavr'
             when 'master'   then 'Magistr'
             when 'college'  then 'Kasbiy ta’lim'
           end;
  v_cert := case p_answers ->> 'korean'
              when 'none'       then 'Yo''q'
              when 'learning'   then 'Yo''q'
              when 'topik1'     then 'TOPIK 1'
              when 'topik2'     then 'TOPIK 2'
              when 'topik3plus' then 'TOPIK 3'
              when 'topik3'     then 'TOPIK 3'
              when 'topik4plus' then 'TOPIK 4'
            end;
  v_intake := case p_answers ->> 'intake'
                when '2027_spring' then 'Bahorgi 2027'
                when '2027_fall'   then 'Kuzgi 2027'
              end;
  v_age := case when (p_answers ->> 'age') ~ '^\d{1,2}$' then (p_answers ->> 'age')::int end;
  if v_age is not null and (v_age < 10 or v_age > 99) then v_age := null; end if;

  v_note := 'Ilovada imkoniyat testi: '
         || coalesce(case v_band when 'high' then 'yuqori' when 'mid' then 'o''rta' when 'low' then 'past' end, '—')
         || ' · ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI');

  select l.* into v_lead
    from public.leads l
   where v_national = any (public.fn_phone_keys(l.phone))
   order by l.updated_at desc
   limit 1;

  if v_lead.id is not null then
    -- The same number pressing the button twice within a minute is one request.
    if v_lead.quiz_submitted_at is not null and v_lead.quiz_submitted_at > now() - interval '1 minute' then
      return jsonb_build_object('status', 'ok', 'phone', v_phone, 'link_code', v_lead.link_code);
    end if;
    update public.leads l
       set full_name = case when l.full_name is null or l.full_name like 'Ilova: %' then v_name else l.full_name end,
           notes = concat_ws(E'\n', nullif(trim(l.notes), ''), v_note),
           quiz_answers = p_answers,
           eligibility_result = p_result,
           eligibility_band = v_band,
           tariff_interest = p_result ->> 'tariff',
           needs_operator = coalesce((p_result ->> 'needs_operator')::boolean, false),
           quiz_submitted_at = now(),
           education_level = coalesce(v_edu, l.education_level),
           cert_level = coalesce(v_cert, l.cert_level),
           korean_level = coalesce(v_cert, l.korean_level),
           budget_range = coalesce(p_result ->> 'budget_label', l.budget_range),
           city = coalesce(nullif(p_answers ->> 'region', ''), l.city),
           age = coalesce(v_age, l.age),
           target_intake = coalesce(v_intake, l.target_intake),
           new_lead_at = now(),
           sla_start_at = public.fn_lead_sla_start(now()),
           sla_alerted_at = null,
           quick_contact_alerted_at = case when l.last_contacted_at is not null then now() end,
           updated_at = now()
     where l.id = v_lead.id
     returning l.id, l.link_code into v_lead_id, v_code;
  else
    insert into public.leads (full_name, phone, source, status, contact_channel, notes,
                              new_lead_at, sla_start_at,
                              quiz_answers, eligibility_result, eligibility_band, tariff_interest,
                              needs_operator, quiz_submitted_at,
                              education_level, cert_level, korean_level, budget_range, city, age, target_intake)
    values (coalesce(v_name, 'Ilova: ' || v_pretty), v_phone, 'app', 'new', 'Ilova', v_note,
            now(), public.fn_lead_sla_start(now()),
            p_answers, p_result, v_band, p_result ->> 'tariff',
            coalesce((p_result ->> 'needs_operator')::boolean, false), now(),
            v_edu, v_cert, v_cert, p_result ->> 'budget_label', nullif(p_answers ->> 'region', ''), v_age, v_intake)
    returning id, link_code into v_lead_id, v_code;
  end if;

  return jsonb_build_object('status', 'ok', 'phone', v_phone, 'link_code', v_code);
end;
$$;

revoke all on function public.app_quiz_submit(text, text, jsonb, jsonb) from public;
grant execute on function public.app_quiz_submit(text, text, jsonb, jsonb) to anon, authenticated;
