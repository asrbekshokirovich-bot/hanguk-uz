-- Phase 0 of the university-admissions fix plan (docs/university-admissions-fix-plan.md).
-- Corrects institution identity from the 2026 audit: fixes PDF-extracted corrupted
-- names, backfills missing English names, sets institution KIND (cyber / junior_college /
-- specialized) and corrects national universities mislabeled `private`, and adds an
-- `is_women_only` flag. All statements are idempotent (safe to re-run).

-- 0.4 — women-only flag (new column)
alter table public.institutions
  add column if not exists is_women_only boolean not null default false;

-- 0.1 — corrupted names (extracted from PDF body text) + their English names
update public.institutions set name_ko='부산대학교',            name_en='Pusan National University'        where primary_domain='pusan.ac.kr';
update public.institutions set name_ko='상지대학교',            name_en='Sangji University'                where primary_domain='sangji.ac.kr';
update public.institutions set name_ko='군산대학교',            name_en='Kunsan National University'       where primary_domain='kunsan.ac.kr';
update public.institutions set name_ko='한국항공대학교',        name_en='Korea Aerospace University'       where primary_domain='kau.ac.kr';
update public.institutions set name_ko='한세대학교',            name_en='Hansei University'                where primary_domain='hansei.ac.kr';
-- disambiguate the GLOCAL campus from Konkuk Seoul (konkuk.ac.kr)
update public.institutions set name_ko='건국대학교 글로컬캠퍼스', name_en='Konkuk University (GLOCAL Campus)' where primary_domain='kku.ac.kr';

-- 0.1 — backfill the remaining missing English names
update public.institutions set name_en='Dongduk Women''s University' where primary_domain='dongduk.ac.kr';
update public.institutions set name_en='Halla University'            where primary_domain='halla.ac.kr';
update public.institutions set name_en='Hongik University'           where primary_domain='hongik.ac.kr';
update public.institutions set name_en='Hanyang Cyber University'    where primary_domain='hycu.ac.kr';
update public.institutions set name_en='Kyungdong University'        where primary_domain='kduniv.ac.kr';
update public.institutions set name_en='Kyonggi University'          where primary_domain='kyonggi.ac.kr';
update public.institutions set name_en='Myongji University'          where primary_domain='mju.ac.kr';
update public.institutions set name_en='Mokwon University'           where primary_domain='mokwon.ac.kr';

-- keep the display_names jsonb in sync for every row we just renamed
update public.institutions
   set display_names = jsonb_build_object('ko', name_ko, 'en', name_en)
 where primary_domain in (
   'pusan.ac.kr','sangji.ac.kr','kunsan.ac.kr','kau.ac.kr','hansei.ac.kr','kku.ac.kr',
   'dongduk.ac.kr','halla.ac.kr','hongik.ac.kr','hycu.ac.kr','kduniv.ac.kr','kyonggi.ac.kr',
   'mju.ac.kr','mokwon.ac.kr'
 );

-- 0.3 — institution KIND (overrides governance for our taxonomy)
update public.institutions set institution_type='cyber'          where primary_domain='hycu.ac.kr';                       -- online-only; D-2 ineligible
update public.institutions set institution_type='junior_college' where primary_domain in ('dongnam.ac.kr','daedong.ac.kr'); -- 2-3yr associate
update public.institutions set institution_type='specialized'    where primary_domain='acts.ac.kr';                        -- theology seminary
-- correct national universities currently mislabeled `private`
update public.institutions set institution_type='national'
 where primary_domain in ('gnu.ac.kr','hanbat.ac.kr','kumoh.ac.kr','knsu.ac.kr','kunsan.ac.kr');

-- 0.4 — women-only admission
update public.institutions set is_women_only=true
 where primary_domain in ('ewha.ac.kr','duksung.ac.kr','dongduk.ac.kr');
