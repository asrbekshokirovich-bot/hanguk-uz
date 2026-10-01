-- Universitetlar katalogidan yopilgan, boshqa universitetga qo'shilgan va
-- xorijiy talabaga D-2 viza bera olmaydigan (onlayn) oliygohlarni yashirish.
-- Qatorlar o'chirilmaydi — keyinchalik kerak bo'lsa is_active = true qilib
-- qaytarish kifoya.

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactive_reason text;

COMMENT ON COLUMN public.institutions.is_active IS
  'false — Universitetlar katalogida ko''rsatilmaydi (yopilgan, qo''shilgan yoki xorijiy talaba qabul qilmaydi)';
COMMENT ON COLUMN public.institutions.inactive_reason IS
  'Nima uchun is_active = false ekanligi (xodimlar uchun izoh)';

-- Yopilgan yoki boshqa universitetga qo'shilgan
UPDATE public.institutions AS i
SET is_active = false, inactive_reason = v.reason
FROM (VALUES
  ('gtc.ac.kr',       'Yopilgan (2024-02, o''z xohishi bilan)'),
  ('gc.ac.kr',        'Qo''shilgan: 2026-03 dan Changwon National University (Geochang kampusi)'),
  ('namhae.ac.kr',    'Qo''shilgan: 2026-03 dan Changwon National University (Namhae kampusi)'),
  ('gpc.ac.kr',       'Qo''shilgan: 2025-03 dan Gyeongkuk National University'),
  ('anu.ac.kr',       'Qo''shilgan: 2025-03 dan Gyeongkuk National University (gknu.ac.kr)'),
  ('gwnu.ac.kr',      'Qo''shilgan: 2026-03 dan Kangwon National University'),
  ('dorip.ac.kr',     'Qo''shilgan: 2026-03 dan Mokpo National University'),
  ('gyhu.ac.kr',      'Yopilgan (2026)'),
  ('dpc.ac.kr',       'Yopilgan (2021)'),
  ('bs.ac.kr',        'Yopilgan (2014)'),
  ('sy.ac.kr',        'Qo''shilgan: 2020-03 dan Sangji University'),
  ('sorabol.ac.kr',   'Qo''shilgan: Gyeongju University bilan SinGyeongju University bo''lgan'),
  ('shjc.ac.kr',      'Qo''shilgan: Eulji University (Seongnam kampusi)'),
  ('sungsim.ac.kr',   'Yopilgan (2015)'),
  ('crc.ac.kr',       'Qo''shilgan: 2011 dan Chung-Ang University'),
  ('tnu.ac.kr',       'Qo''shilgan: Jeju International University'),
  ('iuk.ac.kr',       'Yopilgan (2023-08)'),
  ('knuw.ac.kr',      'Qo''shilgan: 2023-03 dan Hankyong National University'),
  ('hanlyo.ac.kr',    'Yopilgan (2022)'),
  ('hanjung.ac.kr',   'Yopilgan (2018)'),
  ('kyeyak.ac.kr',    'Yopilgan (2023-03)'),
  ('busanarts.ac.kr', 'Yopilmoqda (2027-02), yangi qabul yo''q'),
  ('knou.ac.kr',      'Masofaviy (onlayn) universitet — xorijiy talabaga D-2 viza bermaydi')
) AS v(domain, reason)
WHERE i.primary_domain = v.domain;

-- Kiber (onlayn) universitetlar: talabalik vizasi (D-2) berilmaydi
UPDATE public.institutions
SET is_active = false,
    inactive_reason = 'Kiber (onlayn) universitet — xorijiy talabaga D-2 viza bermaydi'
WHERE institution_type = 'cyber';
