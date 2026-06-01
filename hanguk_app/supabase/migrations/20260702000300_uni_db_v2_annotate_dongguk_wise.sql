-- Phase 3.4 (v1 "annotate one record"): our dongguk.ac.kr record is specifically
-- Dongguk University's WISE (Gyeongju) campus — a separate admissions system from
-- the well-known Seoul main campus (dongguk.edu). Label it so students searching
-- for "Dongguk University" aren't misled into thinking this is the Seoul campus.
-- (The other multi-campus universities use their main domain, so their campus
-- nuance is added together with the per-campus data in Phase 1.) Idempotent.
update public.institutions
   set name_ko = '동국대학교 WISE캠퍼스',
       name_en = 'Dongguk University (WISE/Gyeongju Campus)',
       display_names = jsonb_build_object(
         'ko', '동국대학교 WISE캠퍼스',
         'en', 'Dongguk University (WISE/Gyeongju Campus)'
       )
 where primary_domain = 'dongguk.ac.kr';
