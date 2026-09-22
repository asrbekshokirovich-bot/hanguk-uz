-- Universitet katalogiga Excel yuklashni hujjatchilarga ham ochish.
--
-- Dastlab yozish faqat owner/admin uchun edi — yangi imkoniyat tor doiradan
-- boshlangandi. Amalda fayllarni hujjatchilar tayyorlaydi, shuning uchun
-- ular ham yuklay olishi kerak. Bu `institutions` jadvalidagi mavjud
-- institutions_staff_write qoidasiga ham mos keladi: u yozishni aynan shu
-- uchta rolga ochadi.
--
-- Qoida endi bitta funksiyada turadi: keyingi safar o'zgarsa, 4 ta siyosat
-- va RPC'ni alohida-alohida tahrirlash shart emas.

CREATE OR REPLACE FUNCTION public.can_edit_university_catalog()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'document_handler');
$$;

REVOKE ALL ON FUNCTION public.can_edit_university_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_university_catalog() TO authenticated;

-- Siyosat nomlari ham haqiqatni aytsin: endi bu "admin" emas, "editor".
ALTER POLICY university_guidelines_admin_write
  ON public.university_guidelines RENAME TO university_guidelines_editor_write;
ALTER POLICY university_guideline_rounds_admin_write
  ON public.university_guideline_rounds RENAME TO university_guideline_rounds_editor_write;
ALTER POLICY university_guideline_faculties_admin_write
  ON public.university_guideline_faculties RENAME TO university_guideline_faculties_editor_write;
ALTER POLICY university_guideline_docs_admin_write
  ON public.university_guideline_docs RENAME TO university_guideline_docs_editor_write;

ALTER POLICY university_guidelines_editor_write ON public.university_guidelines
  USING (public.can_edit_university_catalog())
  WITH CHECK (public.can_edit_university_catalog());

ALTER POLICY university_guideline_rounds_editor_write ON public.university_guideline_rounds
  USING (public.can_edit_university_catalog())
  WITH CHECK (public.can_edit_university_catalog());

ALTER POLICY university_guideline_faculties_editor_write ON public.university_guideline_faculties
  USING (public.can_edit_university_catalog())
  WITH CHECK (public.can_edit_university_catalog());

ALTER POLICY university_guideline_docs_editor_write ON public.university_guideline_docs
  USING (public.can_edit_university_catalog())
  WITH CHECK (public.can_edit_university_catalog());

-- Import RPC'si ham xuddi shu qoidani ishlatsin. Qolgan tanasi o'zgarmaydi,
-- shuning uchun faqat tekshiruv qatori almashtiriladi.
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
    'hujjatlar', v_docs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_university_guideline(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_university_guideline(jsonb) TO authenticated;
