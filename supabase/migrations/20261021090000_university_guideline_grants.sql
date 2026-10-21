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

-- Ma'lumot migratsiyada emas: supabase/data/university_grants_2027.json,
-- yuklash skripti — supabase/data/load_university_grants.sql.
