-- Universitetlar katalogi — TOPIK / IELTS grantlari (egasi, 2026-10-21).
--
-- 2027 qabul guideline'larining stipendiya bo'limlari o'qib chiqildi: qaysi
-- TOPIK / IELTS (va boshqa til testi) darajasiga necha foiz grant beriladi.
-- Har bir qoida guideline sahifasi va asl matni (iqtibos) bilan saqlanadi.
-- Grant guideline'ga bog'liq (universitet + daraja + qabul): bakalavr va
-- magistratura grantlari butunlay boshqa.
--
-- Excel import (import_university_guideline) bu ma'lumotga tegmaydi: Excel
-- qayta yuklanganda guideline qatori o'sha id bilan yangilanadi, grant
-- ustunlari va qoidalari saqlanib qoladi.

-- ---------------------------------------------------------------------------
-- 1. Guideline bo'yicha xulosa — katalog kartasi va saralash shu yerdan o'qiydi
-- ---------------------------------------------------------------------------
ALTER TABLE public.university_guidelines
  -- kirishda          — kirishda TOPIK/IELTS darajasiga qarab grant bor
  -- oqish_davomida    — til granti faqat o'qish davomida
  -- aniq_emas         — tilga oid grant bor, lekin TOPIK/IELTS jadvali yo'q (til kursi va h.k.)
  -- tilga_bogliq_emas — grantlar bor, lekin tilga bog'liq emas
  -- malumot_yoq       — guideline'da grant haqida ma'lumot yo'q
  ADD COLUMN grant_holat text CHECK (grant_holat IS NULL OR grant_holat IN
    ('kirishda', 'oqish_davomida', 'aniq_emas', 'tilga_bogliq_emas', 'malumot_yoq')),
  -- Kirishdagi TOPIK/IELTS grantining kontraktdan eng kichik va eng katta foizi
  -- (kontraktning faqat bir qismiga tegishli yoki qat'iy summali grantlar kirmaydi).
  ADD COLUMN grant_min numeric,
  ADD COLUMN grant_max numeric,
  -- Tilga bog'liq bo'lmagan grantlar (GPA, hammaga beriladigan va h.k.), qisqa.
  ADD COLUMN grant_boshqa text,
  ADD COLUMN grant_izoh text,
  ADD COLUMN grant_manba text,
  ADD COLUMN grant_tekshirilgan date;

-- ---------------------------------------------------------------------------
-- 2. Qoidalar — har bir daraja (tier) alohida qator
-- ---------------------------------------------------------------------------
CREATE TABLE public.university_guideline_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_uuid uuid NOT NULL
    REFERENCES public.university_guidelines(id) ON DELETE CASCADE,
  tartib int NOT NULL,
  -- Yangi qabul va o'qiyotganlarga birga tegishli grant ham 'kirishda'.
  qachon text NOT NULL CHECK (qachon IN ('kirishda', 'oqish_davomida')),
  nomi text,
  kimlar_uchun text,
  -- TOPIK | IELTS | TOPIK yoki IELTS | TOPIK va IELTS | IELTS yoki TOEFL | boshqa ...
  mezon text,
  -- Hujjatdagidek: "TOPIK 5급 이상", "IELTS 6.5 or above"
  talab text,
  topik_min numeric,
  topik_max numeric,
  ielts_min numeric,
  toefl_ibt_min numeric,
  boshqa_test text,
  grant_foiz numeric,
  -- Foiz nimadan: "kontrakt (수업료)", "kirish to'lovi (입학금)" ...
  grant_asosi text,
  grant_summa numeric,
  grant_qoshimcha text,
  muddat text,
  davom_shart text,
  kampus text,
  sahifa text,
  iqtibos text,
  -- Bir nechta faylli guideline'da qoida qaysi fayldan
  manba text
);

CREATE INDEX idx_university_guideline_grants_guideline
  ON public.university_guideline_grants(guideline_uuid, tartib);

-- RLS — boshqa katalog jadvallari bilan bir xil: o'qish investordan boshqa
-- xodimlarga, yozish katalog muharrirlariga (owner, admin, hujjatchi).
ALTER TABLE public.university_guideline_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY university_guideline_grants_staff_read ON public.university_guideline_grants
  FOR SELECT TO authenticated USING (public.is_non_investor_staff());
CREATE POLICY university_guideline_grants_editor_write ON public.university_guideline_grants
  FOR ALL TO authenticated
  USING (public.can_edit_university_catalog())
  WITH CHECK (public.can_edit_university_catalog());

-- ---------------------------------------------------------------------------
-- 3. Yuklash — supabase/data/university_grants_2027.json
--
-- Fayl guideline_id bo'yicha: xulosa ustunlari va qoidalar ro'yxati. Har bir
-- guideline'ning eski qoidalari almashtiriladi; bazada yo'q guideline_id'lar
-- "topilmadi" ro'yxatida qaytadi. Ilovadan chaqirilmaydi — faqat
-- ma'lumot yangilanganda bazadan (service role) ishlatiladi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.load_university_guideline_grants(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  g            jsonb;
  v_guideline  uuid;
  v_inserted   int;
  v_guidelines int    := 0;
  v_grants     int    := 0;
  v_missing    text[] := '{}';
  v_checked    date   := nullif(data ->> 'tekshirilgan', '')::date;
BEGIN
  FOR g IN SELECT value FROM jsonb_array_elements(data -> 'guidelines') LOOP
    SELECT id INTO v_guideline
    FROM university_guidelines
    WHERE guideline_id = g ->> 'guideline_id';

    IF v_guideline IS NULL THEN
      v_missing := v_missing || (g ->> 'guideline_id');
      CONTINUE;
    END IF;

    UPDATE university_guidelines SET
      grant_holat        = g ->> 'grant_holat',
      grant_min          = (g ->> 'grant_min')::numeric,
      grant_max          = (g ->> 'grant_max')::numeric,
      grant_boshqa       = g ->> 'grant_boshqa',
      grant_izoh         = g ->> 'grant_izoh',
      grant_manba        = g ->> 'grant_manba',
      grant_tekshirilgan = v_checked
    WHERE id = v_guideline;

    DELETE FROM university_guideline_grants WHERE guideline_uuid = v_guideline;

    INSERT INTO university_guideline_grants (
      guideline_uuid, tartib, qachon, nomi, kimlar_uchun, mezon, talab,
      topik_min, topik_max, ielts_min, toefl_ibt_min, boshqa_test,
      grant_foiz, grant_asosi, grant_summa, grant_qoshimcha,
      muddat, davom_shart, kampus, sahifa, iqtibos, manba
    )
    SELECT
      v_guideline, r.tartib, r.qachon, r.nomi, r.kimlar_uchun, r.mezon, r.talab,
      r.topik_min, r.topik_max, r.ielts_min, r.toefl_ibt_min, r.boshqa_test,
      r.grant_foiz, r.grant_asosi, r.grant_summa, r.grant_qoshimcha,
      r.muddat, r.davom_shart, r.kampus, r.sahifa, r.iqtibos, r.manba
    FROM jsonb_to_recordset(coalesce(g -> 'grantlar', '[]'::jsonb)) AS r (
      tartib int, qachon text, nomi text, kimlar_uchun text, mezon text, talab text,
      topik_min numeric, topik_max numeric, ielts_min numeric, toefl_ibt_min numeric,
      boshqa_test text, grant_foiz numeric, grant_asosi text, grant_summa numeric,
      grant_qoshimcha text, muddat text, davom_shart text, kampus text, sahifa text,
      iqtibos text, manba text
    );
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    v_guidelines := v_guidelines + 1;
    v_grants := v_grants + v_inserted;
  END LOOP;

  RETURN jsonb_build_object(
    'guidelines', v_guidelines,
    'grantlar', v_grants,
    'topilmadi', to_jsonb(v_missing)
  );
END;
$$;

-- Default privilege orqali anon va authenticated'ga ham EXECUTE beriladi
-- (20260921090000 dagi izohga qarang) — ikkalasini nomma-nom yopamiz.
REVOKE ALL ON FUNCTION public.load_university_guideline_grants(jsonb) FROM PUBLIC, anon, authenticated;
