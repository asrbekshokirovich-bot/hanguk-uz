-- Universitet Excel'ining grantlar varag'i (shablon v4) importga ulandi.
--
-- 2026-10-21 da shablonga 5-varaq qo'shildi: qaysi TOPIK / IELTS / TOEFL ...
-- darajasiga necha foiz (yoki qancha) grant. Sayt bu varaqni o'qimas edi,
-- import_university_guideline() esa grantlarga umuman tegmas edi — v4 fayl
-- "yuklandi" deyilardi, grantlar esa bazaga tushmasdi.
--
-- Endi brauzer varaqni tekshirib, university_guideline_grants qatorlariga
-- o'giradi (src/lib/universityGuidelineGrants.ts) va payload.grantlar'da
-- yuboradi: { xulosa: {grant_holat, grant_min, grant_max, grant_boshqa,
-- grant_manba}, qoidalar: [...] }. Funksiya shu guideline'ning grantlarini
-- almashtiradi va xulosani yozadi. payload'da grantlar bo'lmasa (v2/v3 fayl,
-- eski sayt) — avvalgidek, grantlarga tegilmaydi.

-- ---------------------------------------------------------------------------
-- 1. Excel'dan keladigan, avval yo'q bo'lgan maydonlar
-- ---------------------------------------------------------------------------
ALTER TABLE public.university_guideline_grants
  -- Excel'dagi mezon_turi aynan: topik, ielts, toefl_ibt, gpa, hammaga ...
  -- (qo'lda yuklangan qatorlarda bo'sh)
  ADD COLUMN IF NOT EXISTS mezon_turi text,
  -- grant_summa valyutasi; bo'sh = KRW (qo'lda yuklangan qatorlar shunday)
  ADD COLUMN IF NOT EXISTS grant_valyuta text
    CHECK (grant_valyuta IS NULL OR grant_valyuta IN ('KRW', 'USD')),
  -- Grant nimani qoplaydi: kontrakt, kirish_tolovi, kontrakt_va_kirish,
  -- yotoqxona, naqd, boshqa (qo'lda yuklangan qatorlarda bo'sh — grant_asosi matni)
  ADD COLUMN IF NOT EXISTS nimaga text
    CHECK (nimaga IS NULL OR nimaga IN
      ('kontrakt', 'kirish_tolovi', 'kontrakt_va_kirish', 'yotoqxona', 'naqd', 'boshqa'));

-- ---------------------------------------------------------------------------
-- 2. Import — 20260922060000 dagi bilan bir xil, oxirida grantlar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_university_guideline(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u              jsonb := payload -> 'universitet';
  v_univ_kod     text  := u ->> 'univ_kod';
  v_guideline_id text  := u ->> 'guideline_id';
  v_institution  uuid;
  v_guideline    uuid;
  v_rounds       int;
  v_faculties    int;
  v_docs         int;
  v_grants       int;
  v_xulosa       jsonb := payload -> 'grantlar' -> 'xulosa';
BEGIN
  IF NOT public.can_edit_university_catalog() THEN
    RAISE EXCEPTION 'Universitet Excel faylini faqat admin yoki hujjatchi yuklay oladi'
      USING ERRCODE = '42501';
  END IF;

  IF v_guideline_id IS NULL OR v_univ_kod IS NULL THEN
    RAISE EXCEPTION 'guideline_id yoki univ_kod bo''sh' USING ERRCODE = '22023';
  END IF;

  -- Universitetni topish: avval ko'rsatilgan id bo'yicha, bo'lmasa univ_kod
  -- domen prefiksiga mos kelgan yagona universitet bo'yicha.
  v_institution := NULLIF(payload ->> 'institution_id', '')::uuid;

  IF v_institution IS NULL THEN
    SELECT id INTO v_institution
    FROM public.institutions
    WHERE split_part(primary_domain, '.', 1) = lower(v_univ_kod)
    ORDER BY tier NULLS LAST, name_ko
    LIMIT 1;
  END IF;

  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'univ_kod "%" bo''yicha universitet topilmadi', v_univ_kod
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.university_guidelines AS g (
    guideline_id, institution_id, univ_kod, univ_nomi_en, univ_nomi_kr, kampus,
    shahar, qabul_yili, semestr, daraja, guideline_sarlavha, guideline_fayl,
    ariza_sayti, ariza_tolovi, ariza_tolovi_valyuta, ariza_tolovi_usuli,
    bank_summa, bank_valyuta, bank_saqlash_muddati, bank_turi, bank_vaqti,
    bank_izoh, english_track, korean_track, topik_min, ielts_min, toefl_ibt_min,
    til_izoh, tavsiyanoma, tavsiyanoma_izoh, narx_valyuta, kirish_tolovi,
    io_manzil_en, io_manzil_kr, io_zip, io_telefon, io_email,
    hujjat_yuborish_manzili, sahifalar, izoh, tahlil_sanasi, format_versiya,
    fayl_nomi, yuklagan
  )
  SELECT
    v_guideline_id, v_institution, lower(v_univ_kod),
    u ->> 'univ_nomi_en', u ->> 'univ_nomi_kr', u ->> 'kampus',
    u ->> 'shahar', (u ->> 'qabul_yili')::int, u ->> 'semestr', u ->> 'daraja',
    u ->> 'guideline_sarlavha', u ->> 'guideline_fayl', u ->> 'ariza_sayti',
    (u ->> 'ariza_tolovi')::numeric, u ->> 'ariza_tolovi_valyuta',
    u ->> 'ariza_tolovi_usuli', (u ->> 'bank_summa')::numeric,
    u ->> 'bank_valyuta', u ->> 'bank_saqlash_muddati', u ->> 'bank_turi',
    u ->> 'bank_vaqti', u ->> 'bank_izoh',
    (u ->> 'english_track')::boolean, (u ->> 'korean_track')::boolean,
    (u ->> 'topik_min')::numeric, (u ->> 'ielts_min')::numeric,
    (u ->> 'toefl_ibt_min')::numeric, u ->> 'til_izoh',
    u ->> 'tavsiyanoma', u ->> 'tavsiyanoma_izoh', u ->> 'narx_valyuta',
    (u ->> 'kirish_tolovi')::numeric, u ->> 'io_manzil_en', u ->> 'io_manzil_kr',
    u ->> 'io_zip', u ->> 'io_telefon', u ->> 'io_email',
    u ->> 'hujjat_yuborish_manzili', u ->> 'sahifalar', u ->> 'izoh',
    (u ->> 'tahlil_sanasi')::date, (u ->> 'format_versiya')::int,
    payload ->> 'fayl_nomi', auth.uid()
  ON CONFLICT (guideline_id) DO UPDATE SET
    institution_id = EXCLUDED.institution_id,
    univ_kod = EXCLUDED.univ_kod,
    univ_nomi_en = EXCLUDED.univ_nomi_en,
    univ_nomi_kr = EXCLUDED.univ_nomi_kr,
    kampus = EXCLUDED.kampus,
    shahar = EXCLUDED.shahar,
    qabul_yili = EXCLUDED.qabul_yili,
    semestr = EXCLUDED.semestr,
    daraja = EXCLUDED.daraja,
    guideline_sarlavha = EXCLUDED.guideline_sarlavha,
    guideline_fayl = EXCLUDED.guideline_fayl,
    ariza_sayti = EXCLUDED.ariza_sayti,
    ariza_tolovi = EXCLUDED.ariza_tolovi,
    ariza_tolovi_valyuta = EXCLUDED.ariza_tolovi_valyuta,
    ariza_tolovi_usuli = EXCLUDED.ariza_tolovi_usuli,
    bank_summa = EXCLUDED.bank_summa,
    bank_valyuta = EXCLUDED.bank_valyuta,
    bank_saqlash_muddati = EXCLUDED.bank_saqlash_muddati,
    bank_turi = EXCLUDED.bank_turi,
    bank_vaqti = EXCLUDED.bank_vaqti,
    bank_izoh = EXCLUDED.bank_izoh,
    english_track = EXCLUDED.english_track,
    korean_track = EXCLUDED.korean_track,
    topik_min = EXCLUDED.topik_min,
    ielts_min = EXCLUDED.ielts_min,
    toefl_ibt_min = EXCLUDED.toefl_ibt_min,
    til_izoh = EXCLUDED.til_izoh,
    tavsiyanoma = EXCLUDED.tavsiyanoma,
    tavsiyanoma_izoh = EXCLUDED.tavsiyanoma_izoh,
    narx_valyuta = EXCLUDED.narx_valyuta,
    kirish_tolovi = EXCLUDED.kirish_tolovi,
    io_manzil_en = EXCLUDED.io_manzil_en,
    io_manzil_kr = EXCLUDED.io_manzil_kr,
    io_zip = EXCLUDED.io_zip,
    io_telefon = EXCLUDED.io_telefon,
    io_email = EXCLUDED.io_email,
    hujjat_yuborish_manzili = EXCLUDED.hujjat_yuborish_manzili,
    sahifalar = EXCLUDED.sahifalar,
    izoh = EXCLUDED.izoh,
    tahlil_sanasi = EXCLUDED.tahlil_sanasi,
    format_versiya = EXCLUDED.format_versiya,
    fayl_nomi = EXCLUDED.fayl_nomi,
    yuklagan = EXCLUDED.yuklagan,
    updated_at = now()
  RETURNING g.id INTO v_guideline;

  -- Bolalar jadvallari to'liq almashtiriladi: qayta yuklangan fayl
  -- guideline'ning yagona haqiqati.
  DELETE FROM public.university_guideline_rounds WHERE guideline_uuid = v_guideline;
  DELETE FROM public.university_guideline_faculties WHERE guideline_uuid = v_guideline;
  DELETE FROM public.university_guideline_docs WHERE guideline_uuid = v_guideline;

  INSERT INTO public.university_guideline_rounds (
    guideline_uuid, bosqich, etap_raqam, etap_nomi, boshlanish_sana,
    boshlanish_vaqt, tugash_sana, tugash_vaqt, holat, izoh, sahifa
  )
  SELECT
    v_guideline, (r ->> 'bosqich')::int, (r ->> 'etap_raqam')::int,
    r ->> 'etap_nomi', (r ->> 'boshlanish_sana')::date, r ->> 'boshlanish_vaqt',
    (r ->> 'tugash_sana')::date, r ->> 'tugash_vaqt', r ->> 'holat',
    r ->> 'izoh', r ->> 'sahifa'
  FROM jsonb_array_elements(COALESCE(payload -> 'muddatlar', '[]'::jsonb)) AS r;
  GET DIAGNOSTICS v_rounds = ROW_COUNT;

  INSERT INTO public.university_guideline_faculties (
    guideline_uuid, tartib, track, kollej_en, kollej_kr, fakultet_en,
    fakultet_kr, topik_min, ielts_min, toefl_ibt_min, til_izoh,
    kontrakt_summa, kontrakt_davri, kontrakt_izoh, izoh, sahifa
  )
  SELECT
    v_guideline, (f.ord)::int, f.val ->> 'track', f.val ->> 'kollej_en',
    f.val ->> 'kollej_kr', f.val ->> 'fakultet_en', f.val ->> 'fakultet_kr',
    (f.val ->> 'topik_min')::numeric, (f.val ->> 'ielts_min')::numeric,
    (f.val ->> 'toefl_ibt_min')::numeric, f.val ->> 'til_izoh',
    (f.val ->> 'kontrakt_summa')::numeric, f.val ->> 'kontrakt_davri',
    f.val ->> 'kontrakt_izoh', f.val ->> 'izoh', f.val ->> 'sahifa'
  FROM jsonb_array_elements(COALESCE(payload -> 'fakultetlar', '[]'::jsonb))
       WITH ORDINALITY AS f(val, ord);
  GET DIAGNOSTICS v_faculties = ROW_COUNT;

  INSERT INTO public.university_guideline_docs (
    guideline_uuid, tartib, etap_raqam, hujjat_nomi, hujjat_nomi_asl,
    kimlar_uchun, majburiy, shakli, apostil, notarial_tarjima, muddat,
    muddat_turi, izoh, sahifa
  )
  SELECT
    v_guideline, COALESCE((d.val ->> 'tartib')::int, (d.ord)::int),
    (d.val ->> 'etap_raqam')::int, d.val ->> 'hujjat_nomi',
    d.val ->> 'hujjat_nomi_asl', d.val ->> 'kimlar_uchun', d.val ->> 'majburiy',
    d.val ->> 'shakli', d.val ->> 'apostil', d.val ->> 'notarial_tarjima',
    (d.val ->> 'muddat')::date, d.val ->> 'muddat_turi', d.val ->> 'izoh',
    d.val ->> 'sahifa'
  FROM jsonb_array_elements(COALESCE(payload -> 'hujjatlar', '[]'::jsonb))
       WITH ORDINALITY AS d(val, ord);
  GET DIAGNOSTICS v_docs = ROW_COUNT;

  -- Grantlar faqat fayl grantlar varag'ini olib kelganda (format v4)
  -- almashtiriladi. v2/v3 fayl yoki eski sayt yuborgan payload'da bu kalit
  -- yo'q — qo'lda yuklangan grantlar (supabase/data/university_grants_2027.json)
  -- saqlanib qoladi.
  IF payload ? 'grantlar' THEN
    DELETE FROM public.university_guideline_grants WHERE guideline_uuid = v_guideline;

    INSERT INTO public.university_guideline_grants (
      guideline_uuid, tartib, qachon, nomi, kimlar_uchun, mezon, mezon_turi,
      talab, topik_min, topik_max, ielts_min, toefl_ibt_min, boshqa_test,
      grant_foiz, grant_asosi, grant_summa, grant_valyuta, grant_qoshimcha,
      nimaga, muddat, davom_shart, sahifa, iqtibos, manba
    )
    SELECT
      v_guideline, r.tartib, r.qachon, r.nomi, r.kimlar_uchun, r.mezon,
      r.mezon_turi, r.talab, r.topik_min, r.topik_max, r.ielts_min,
      r.toefl_ibt_min, r.boshqa_test, r.grant_foiz, r.grant_asosi,
      r.grant_summa, r.grant_valyuta, r.grant_qoshimcha, r.nimaga, r.muddat,
      r.davom_shart, r.sahifa, r.iqtibos, r.manba
    FROM jsonb_to_recordset(COALESCE(payload -> 'grantlar' -> 'qoidalar', '[]'::jsonb)) AS r (
      tartib int, qachon text, nomi text, kimlar_uchun text, mezon text,
      mezon_turi text, talab text, topik_min numeric, topik_max numeric,
      ielts_min numeric, toefl_ibt_min numeric, boshqa_test text,
      grant_foiz numeric, grant_asosi text, grant_summa numeric,
      grant_valyuta text, grant_qoshimcha text, nimaga text, muddat text,
      davom_shart text, sahifa text, iqtibos text, manba text
    );
    GET DIAGNOSTICS v_grants = ROW_COUNT;

    UPDATE public.university_guidelines
    SET grant_holat        = v_xulosa ->> 'grant_holat',
        grant_min          = (v_xulosa ->> 'grant_min')::numeric,
        grant_max          = (v_xulosa ->> 'grant_max')::numeric,
        grant_boshqa       = v_xulosa ->> 'grant_boshqa',
        grant_izoh         = NULL,
        grant_manba        = v_xulosa ->> 'grant_manba',
        grant_tekshirilgan = (u ->> 'tahlil_sanasi')::date
    WHERE id = v_guideline;
  END IF;

  UPDATE public.university_guidelines g
  SET kontrakt_min = s.min_summa,
      kontrakt_max = s.max_summa,
      fakultet_soni = s.soni,
      -- Kartada bitta davr ko'rsatiladi; fakultetlar bo'yicha aniqrog'i
      -- detal oynasida turadi.
      kontrakt_davri = (
        SELECT kontrakt_davri
        FROM public.university_guideline_faculties
        WHERE guideline_uuid = v_guideline AND kontrakt_davri IS NOT NULL
        GROUP BY kontrakt_davri
        ORDER BY COUNT(*) DESC, kontrakt_davri
        LIMIT 1
      )
  FROM (
    SELECT MIN(kontrakt_summa) AS min_summa,
           MAX(kontrakt_summa) AS max_summa,
           COUNT(*)            AS soni
    FROM public.university_guideline_faculties
    WHERE guideline_uuid = v_guideline
  ) AS s
  WHERE g.id = v_guideline;

  RETURN jsonb_build_object(
    'guideline_uuid', v_guideline,
    'institution_id', v_institution,
    'muddatlar', v_rounds,
    'fakultetlar', v_faculties,
    'hujjatlar', v_docs,
    -- Grantlar varag'i bo'lmagan faylda — null (grantlarga tegilmadi).
    'grantlar', v_grants
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_university_guideline(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_university_guideline(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ilova: kirish to'lovi, yotoqxona yoki naqd stipendiya foizi kontrakt
--    granti emas. Qo'lda yuklangan qatorlarda nimaga bo'sh — ular avvalgidek.
-- ---------------------------------------------------------------------------
create or replace function public.app_grant_tiers()
returns table (
  guideline_id uuid,
  mezon text,
  topik_min numeric,
  topik_max numeric,
  ielts_min numeric,
  grant_pct integer
)
language sql
stable
security definer
set search_path = public
as $$
  select g.guideline_uuid, g.mezon, g.topik_min, g.topik_max, g.ielts_min, g.grant_foiz::int
    from public.university_guideline_grants g
   where g.qachon = 'kirishda'
     and g.grant_foiz is not null
     and g.mezon <> 'boshqa'
     and (g.nimaga is null or g.nimaga in ('kontrakt', 'kontrakt_va_kirish'));
$$;

revoke all on function public.app_grant_tiers() from public;
grant execute on function public.app_grant_tiers() to anon, authenticated;
