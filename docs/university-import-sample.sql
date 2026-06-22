-- NAMUNA — import formatini ko'rsatish uchun. BAZAGA QO'LLANMAGAN.
-- Yangi muassasalar is_visible_on_map = false bilan qo'shiladi:
-- bazada bo'ladi, lekin asosiy saytda ko'rinmaydi (tekshirilguncha).
--
-- domain/koordinata qiymatlari import paytida academyinfo + Wikidata'dan
-- olinadi va tasdiqlanadi; quyida namuna sifatida ko'rsatilgan.

INSERT INTO public.institutions
  (name_ko, name_en, institution_type, primary_domain, is_visible_on_map, is_partner)
VALUES
  ('한국기술교육대학교', 'KOREATECH',                'national',       'koreatech.ac.kr', false, false),
  ('남서울대학교',       'Namseoul University',       'private',        'nsu.ac.kr',       false, false),
  -- Junior college'lar (전문대학) — asosiy bo'shliq:
  ('영진전문대학교',     'Yeungjin University',       'junior_college', 'yjc.ac.kr',       false, false),
  ('영남이공대학교',     'Yeungnam University College','junior_college','ync.ac.kr',       false, false),
  ('인하공업전문대학',   'Inha Technical College',    'junior_college', 'inhatc.ac.kr',    false, false),
  ('동양미래대학교',     'Dongyang Mirae University', 'junior_college', 'dongyang.ac.kr',  false, false),
  ('명지전문대학',       'Myongji College',           'junior_college', 'mjc.ac.kr',       false, false)
ON CONFLICT DO NOTHING;  -- mavjud nomlar o'tkazib yuboriladi

-- Tekshirgandan keyin guruh-guruh yoqish:
-- UPDATE public.institutions SET is_visible_on_map = true
-- WHERE name_ko IN ('한국기술교육대학교', ...);
