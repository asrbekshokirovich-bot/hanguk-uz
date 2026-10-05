-- "Viza imkoniyatim" — the app's new first screens (owner, 2026-10-05).
--
-- The app opens on a 6-question check (S02), shows a result (S03) and asks for
-- a name and phone only when the person wants an operator to confirm it (S04).
-- Signing up with a password is gone; the phone given in S04 is the lead.
--
--   * leads gain the quiz answers, the computed result and its band, the
--     recommended tariff and the time of the last submission. The CRM lead
--     page shows them in an "Ilova" block.
--   * eligibility_rules holds every number the result is computed from, so
--     operators can change a rule without an app release. The app reads it
--     (anon) and falls back to the same defaults built into the app.
--   * v_app_university_catalog gains ieqas_status (the "Akkreditatsiyalangan"
--     badge) and is_active (inactive universities are never suggested).
--   * app_quiz_submit(phone, name, answers, result) is called from S04. It
--     works like app_register did: a student's number is sent to the Magic
--     Code screen; a known number updates its lead; a new number becomes a
--     lead in "Yangi lid". It returns the lead's Telegram link code.
--   * claim_lead_link also returns the result's plan text, so the bot can send
--     it when the person opens Telegram from the app.

-- 1. Lead columns --------------------------------------------------------------
alter table public.leads
  add column if not exists quiz_answers jsonb,
  add column if not exists eligibility_result jsonb,
  add column if not exists eligibility_band text
    check (eligibility_band is null or eligibility_band in ('high', 'mid', 'low')),
  add column if not exists tariff_interest text,
  add column if not exists needs_operator boolean not null default false,
  add column if not exists quiz_submitted_at timestamptz;

-- 2. Rules ---------------------------------------------------------------------
create table if not exists public.eligibility_rules (
  key        text primary key,
  value      jsonb not null,
  note       text,
  updated_at timestamptz not null default now()
);

alter table public.eligibility_rules enable row level security;
grant select on public.eligibility_rules to anon, authenticated;
do $p$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'eligibility_rules'
                   and policyname = 'eligibility_rules_read') then
    create policy eligibility_rules_read on public.eligibility_rules for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'eligibility_rules'
                   and policyname = 'eligibility_rules_staff_write') then
    create policy eligibility_rules_staff_write on public.eligibility_rules for all
      using (has_role((select auth.uid()), 'owner'::app_role) or has_role((select auth.uid()), 'admin'::app_role))
      with check (has_role((select auth.uid()), 'owner'::app_role) or has_role((select auth.uid()), 'admin'::app_role));
  end if;
end $p$;
grant insert, update on public.eligibility_rules to authenticated;

-- Starting values (app spec, section 5). A starting heuristic, not an embassy
-- decision — the result screen says so.
insert into public.eligibility_rules (key, value, note) values
  ('base_score',              '2',          'Boshlang''ich ball (o''rta)'),
  ('band_high_min',           '4',          'Ball shundan katta yoki teng bo''lsa — yuqori'),
  ('band_mid_min',            '2',          'Ball shundan katta yoki teng bo''lsa — o''rta, aks holda past'),
  ('d2_topik_ok_bonus',       '2',          'Bakalavr/magistr: TOPIK 3+ (magistr: yoki IELTS 5.5+)'),
  ('d2_topik2_cap',           '"mid"',      'Bakalavr/magistr: TOPIK 2 — eng ko''pi o''rta'),
  ('d2_no_cert_cap',          '"low"',      'Bakalavr/magistr: sertifikat yo''q yoki TOPIK 1 — past'),
  ('voc_topik3_bonus',        '2',          'Kasbiy kollej: TOPIK 3+'),
  ('voc_topik2_bonus',        '1',          'Kasbiy kollej: TOPIK 2'),
  ('d4_cert_bonus',           '1',          'Til kursi: Sejong 1A / TOPIK 1 va yuqori'),
  ('fin_both_ok_bonus',       '2',          'Rasmiy daromad bor va bank spravkasi bor'),
  ('fin_no_income_cap',       '"mid"',      'Rasmiy daromad yo''q, spravka bor — eng ko''pi o''rta'),
  ('fin_none_cap',            '"low"',      'Daromad ham, spravka ham yo''q — past (kasbiy + TOPIK 3+ bundan mustasno)'),
  ('d4_gap_years_max',        '3',          'Til kursi: bitiruvdan shuncha yildan ko''p o''tsa −1'),
  ('d4_age_soft_max',         '30',         'Til kursi: shu yoshdan katta bo''lsa −1'),
  ('d2_bachelor_age_soft_max','30',         'Bakalavr: shu yoshdan katta bo''lsa −1'),
  ('budget_penalty',          '1',          'Byudjet eng arzon mos OTM xarajatidan past bo''lsa −1'),
  ('krw_per_usd',             '1400',       'Von kursi (1 $ uchun), xarajatni $ da ko''rsatish uchun'),
  ('living_seoul_month_usd',  '[900, 1100]','Seulda oylik yashash, $'),
  ('living_region_month_usd', '[450, 750]', 'Viloyatda oylik yashash, $'),
  ('app_fee_usd',             '70',         'Ariza to''lovi (default), $'),
  ('max_universities',        '3',          'Natijada ko''rsatiladigan OTM soni')
on conflict (key) do nothing;

-- 3. Catalogue: accreditation and is_active --------------------------------------
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
  i.is_active
from public.university_guidelines g
join public.institutions i on i.id = g.institution_id;

grant select on public.v_app_university_catalog to anon, authenticated;

-- 4. Submit ---------------------------------------------------------------------
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

-- 5. Telegram: the plan travels with the claim ------------------------------------
create or replace function public.claim_lead_link(
  p_code       text,
  p_channel    text,
  p_identifier text,
  p_label      text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
  v_ci   record;
begin
  select id, full_name, eligibility_result ->> 'plan_text' as plan_text
    into v_lead from leads where link_code = lower(trim(p_code));
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select id, lead_id, student_id into v_ci
    from communication_identities
   where channel = p_channel and identifier = p_identifier;

  if not found then
    insert into communication_identities
      (channel, identifier, identifier_label, lead_id, display_name, confidence, source, notes)
    values
      (p_channel, p_identifier, p_label, v_lead.id, v_lead.full_name,
       'confirmed', 'auto', 'Mijoz shaxsiy havolani bosdi');
  elsif v_ci.student_id is null then
    -- The customer pressed a link that only this lead was given: that outranks
    -- whatever the webhook guessed earlier.
    update communication_identities
       set lead_id = v_lead.id, confidence = 'confirmed',
           notes = 'Mijoz shaxsiy havolani bosdi', updated_at = now()
     where id = v_ci.id;
  end if;
  -- A student's link is left as it is.

  if p_channel = 'telegram' then
    update leads
       set telegram_handle = coalesce(telegram_handle, lower(nullif(ltrim(p_label, '@'), '')), p_identifier),
           updated_at = now()
     where id = v_lead.id;
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_lead.id, 'name', v_lead.full_name,
                            'plan_text', v_lead.plan_text);
end;
$$;

revoke all on function public.claim_lead_link(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_lead_link(text, text, text, text) to service_role;
