-- 서울장신대학교 (Seoul Jangsin University) magistraturasi katalogga qaytdi
-- (egasi, 2026-10-21: "sjs da ham magistr bor").
--
-- 20261007090000_institutions_hide_list_1_360.sql "Ro'yxatdan
-- chiqariladiganlar 1–360" bo'yicha unga hidden_levels = {magistratura}
-- qo'ygan edi — universitet panelida faqat "Bakalavr" va "Til kursi"
-- qolgan, magistr Excel'ini yuklash uchun yorliq ham yo'q edi. Qolgan
-- yashirilgan darajalarga tegilmaydi.

UPDATE public.institutions
SET hidden_levels = array_remove(hidden_levels, 'magistratura')
WHERE name_ko = '서울장신대학교'
  AND primary_domain = 'sjs.ac.kr';
