-- Qirg'iziston (reja claude/qirgiziston-reja.md, KG3 / M2; Asrbek 2026-11-11):
-- ilovaning lid formasi Qirg'iziston raqamini (+996, 9 raqam) qabul qiladi,
-- lidning mamlakati yoziladi va Qirg'iziston lidlari Madinaga biriktiriladi
-- (Q1: «KG lidlari bilan Madina ishlaydi»).
--
--   leads.country            'UZ' / 'KG'; ilova lidlarida to'ldiriladi, qolganlarida
--                            null (O'zbekiston deb olinadi).
--   lead_country_assignees   qaysi mamlakat lidi kimga tushadi: KG → Madina.
--                            Boshqa xodimga berish — shu jadvalni o'zgartirish.
--   fn_national_phone        9 xonali milliy raqam: UZ (998…), KG (996…).
--   fn_phone_digit_parts     maydondagi har raqamning faqat raqamlari.
--   normalize_phone          996 + 9 raqamga ham '+' qo'yadi.
--   app_quiz_submit          p_country qo'shildi (default 'UZ': eski ilovalar
--                            o'zgarishsiz ishlaydi).
--
-- CRM'ning telefon kalitlari (fn_phone_keys, phone_key — oxirgi 9 raqam)
-- o'zgarmaydi. Shuning uchun KG raqami bu yerda to'liq (996 + 9) solishtiriladi:
-- 9 raqami bir xil O'zbekiston lidi yoki talabasi bilan qo'shilib ketmaydi, va
-- O'zbekiston raqami KG lidiga yopishmaydi.

-- 1. Lidning mamlakati -----------------------------------------------------------
alter table public.leads add column if not exists country text;
alter table public.leads drop constraint if exists leads_country_check;
alter table public.leads add constraint leads_country_check
  check (country is null or country ~ '^[A-Z]{2}$');
comment on column public.leads.country is
  'Lid mamlakati (ISO 3166-1, ''UZ'' / ''KG''): ilova lid formasidan (KG3). null — O''zbekiston deb olinadi.';

-- 2. Mamlakat lidlari kimga tushadi ------------------------------------------------
create table if not exists public.lead_country_assignees (
  country    text primary key check (country ~ '^[A-Z]{2}$'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
comment on table public.lead_country_assignees is
  'Ilovadan kelgan shu mamlakat lidi avtomatik kimga biriktiriladi (leads.assigned_to). Qator yo''q — biriktirilmaydi.';
alter table public.lead_country_assignees enable row level security;
drop policy if exists lead_country_assignees_owner on public.lead_country_assignees;
create policy lead_country_assignees_owner on public.lead_country_assignees
  for all to authenticated
  using (public.has_role((select auth.uid()), 'owner'::public.app_role))
  with check (public.has_role((select auth.uid()), 'owner'::public.app_role));

-- Madina (call_operator) — Asrbek, 2026-11-11.
insert into public.lead_country_assignees (country, user_id)
values ('KG', '42d0c8db-17d0-4824-9ad5-7b01e4829ad2')
on conflict (country) do nothing;

-- 3. Milliy raqam --------------------------------------------------------------------
create or replace function public.fn_national_phone(p_phone text, p_country text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case
    when d ~ ('^' || cc || '[0-9]{9}$') then right(d, 9)
    when d ~ '^[0-9]{9}$' then d
  end
  from (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d,
           case upper(btrim(coalesce(p_country, ''))) when 'KG' then '996' else '998' end as cc
  ) x
$$;
comment on function public.fn_national_phone(text, text) is
  '9 xonali milliy raqam: UZ — 998 + 9 yoki 9 raqam, KG — 996 + 9 yoki 9 raqam; boshqasi null.';

create or replace function public.fn_phone_digit_parts(p_text text)
returns text[]
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select coalesce(array_agg(d) filter (where d <> ''), '{}')
  from (
    select regexp_replace(part, '\D', '', 'g') as d
    from regexp_split_to_table(coalesce(p_text, ''), '[/,;|]') as part
  ) x
$$;
comment on function public.fn_phone_digit_parts(text) is
  'Maydondagi har raqam (/ , ; | bilan ajratilgan) faqat raqamlari bilan — to''liq raqamni solishtirish uchun.';

-- 4. normalize_phone: 996 + 9 raqam ham xalqaro yoziladi ------------------------------
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
as $function$
DECLARE n text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  n := regexp_replace(p, '\D', '', 'g');
  IF n = '' THEN RETURN NULL; END IF;
  IF left(n, 3) = '998' THEN n := '+' || n;
  ELSIF left(n, 3) = '996' AND length(n) = 12 THEN n := '+' || n;
  ELSIF left(n, 1) = '9' AND length(n) = 9 THEN n := '+998' || n;
  END IF;
  RETURN n;
END; $function$;

-- 5. Ilova lid formasi: mamlakat bilan ---------------------------------------------------
-- Eski 4 argumentli versiya o'chiriladi: yangisi p_country'siz chaqiruvni ham
-- qabul qiladi (ikkalasi qolsa PostgREST qaysi birini tanlashni bilmaydi).
drop function if exists public.app_quiz_submit(text, text, jsonb, jsonb);

create or replace function public.app_quiz_submit(
  p_phone   text,
  p_name    text,
  p_answers jsonb,
  p_result  jsonb,
  p_country text default 'UZ'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  -- The country the app is set up for (KG2); an older app sends none.
  v_country  text := case when upper(btrim(coalesce(p_country, ''))) = 'KG' then 'KG' else 'UZ' end;
  v_national text := public.fn_national_phone(p_phone, v_country);
  v_full     text;
  v_assignee uuid;
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
  v_heard    text;
  v_for      text;
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

  if v_country = 'KG' then
    -- A Kyrgyz number is matched whole (996 + 9 digits): the CRM's phone keys
    -- are the last 9 digits, which an Uzbek number can share.
    v_full := '996' || v_national;
    if exists (
      select 1 from public.profiles p
       where p.magic_code is not null
         and (v_full = any (public.fn_phone_digit_parts(p.phone))
              or v_full = any (public.fn_phone_digit_parts(p.additional_phone)))
    ) or exists (
      select 1 from public.student_phones sp
        join public.profiles p on p.id = sp.student_id
       where p.magic_code is not null
         and (v_full = any (public.fn_phone_digit_parts(sp.phone_norm))
              or v_full = any (public.fn_phone_digit_parts(sp.phone)))
    ) then
      return jsonb_build_object('status', 'student');
    end if;
    v_phone := '+' || v_full;
    v_pretty := '+996 ' || substr(v_national, 1, 3) || ' ' || substr(v_national, 4, 3)
             || ' ' || substr(v_national, 7, 3);
  else
    if public.fn_is_student_phone(v_national) then
      return jsonb_build_object('status', 'student');
    end if;
    v_phone := '+998' || v_national;
    v_pretty := '+998 ' || substr(v_national, 1, 2) || ' ' || substr(v_national, 3, 3)
             || ' ' || substr(v_national, 6, 2) || ' ' || substr(v_national, 8, 2);
  end if;
  -- Who works this country's leads (Asrbek, 2026-11-11: Kyrgyzstan → Madina).
  select a.user_id into v_assignee from public.lead_country_assignees a where a.country = v_country;

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
  -- «Bizni qayerdan topdingiz?» and «Kim uchun?», when the form asked them.
  select h.label_uz into v_heard from public.lead_how_heard h where h.key = p_answers ->> 'how_heard' and h.in_app;
  v_for := case when p_answers ->> 'for_whom' in ('self', 'child', 'relative')
                then p_answers ->> 'for_whom' end;

  v_note := 'Ilovada imkoniyat testi: '
         || coalesce(case v_band when 'high' then 'yuqori' when 'mid' then 'o''rta' when 'low' then 'past' end, '—')
         || ' · ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI')
         || case when v_country = 'KG' then ' · Qirg''iziston' else '' end;

  select l.* into v_lead
    from public.leads l
   where case when v_country = 'KG'
              then v_full = any (public.fn_phone_digit_parts(l.phone))
              else v_national = any (public.fn_phone_keys(l.phone))
                   and coalesce(l.country, 'UZ') <> 'KG'
                   and not ('996' || v_national) = any (public.fn_phone_digit_parts(l.phone))
         end
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
           -- The person's own answer is the source (S3).
           how_heard = coalesce(v_heard, l.how_heard),
           for_whom = coalesce(v_for, l.for_whom),
           country = coalesce(l.country, v_country),
           assigned_to = coalesce(l.assigned_to, v_assignee),
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
                              education_level, cert_level, korean_level, budget_range, city, age, target_intake,
                              how_heard, for_whom, country, assigned_to)
    values (coalesce(v_name, 'Ilova: ' || v_pretty), v_phone, 'app', 'new', 'Ilova', v_note,
            now(), public.fn_lead_sla_start(now()),
            p_answers, p_result, v_band, p_result ->> 'tariff',
            coalesce((p_result ->> 'needs_operator')::boolean, false), now(),
            v_edu, v_cert, v_cert, p_result ->> 'budget_label', nullif(p_answers ->> 'region', ''), v_age, v_intake,
            v_heard, v_for, v_country, v_assignee)
    returning id, link_code into v_lead_id, v_code;
  end if;

  return jsonb_build_object('status', 'ok', 'phone', v_phone, 'link_code', v_code);
end;
$$;

revoke all on function public.app_quiz_submit(text, text, jsonb, jsonb, text) from public;
grant execute on function public.app_quiz_submit(text, text, jsonb, jsonb, text) to anon, authenticated, service_role;
