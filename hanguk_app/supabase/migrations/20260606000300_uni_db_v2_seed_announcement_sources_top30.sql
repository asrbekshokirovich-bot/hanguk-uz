-- ============================================================================
--  uni_db v2 — expand seed announcement_sources from top-15 to top-30
--  Plan §I-Phase-2 + audit §1.2 priority list.
--
--  Adds 15 more priority Korean admission boards on top of the Phase-0
--  seed (20260601000201). The next 15 are picked per audit §1.2:
--    - Remaining T1 mid-Seoul privates (Konkuk, Hongik, Dongguk, Inha,
--      Sookmyung)
--    - STEM-specialized: UNIST, GIST, DGIST
--    - Remaining 거점국립대 flagships: CNU (Chonnam), CNU-D (Chungnam),
--      CBNU (Chungbuk), JBNU (Jeonbuk), Kangwon, Jeju, Incheon
--
--  All ko-side URLs (§P.1). All status='discovered' so they don't go
--  live until a reviewer promotes them via the proposed_sources flow
--  (Phase 2 migration 000200) OR the operator manually flips status to
--  'live' in Studio.
--
--  Idempotent — `on conflict (url_ko) do update set notes = excluded.notes`.
-- ============================================================================

set local search_path = public, pg_catalog;

insert into public.announcement_sources (
  source_type, url_ko, status, notes
) values
  -- T1 stragglers (mid-Seoul privates not in the original top-15)
  ('university_admission_board', 'https://enter.konkuk.ac.kr/',
   'discovered', 'Konkuk admissions board'),
  ('university_admission_board', 'https://www.hongik.ac.kr/kr/admission/intro.do',
   'discovered', 'Hongik admissions section'),
  ('university_admission_board', 'https://ipsi.dongguk.edu/admission/html/abroad/guide.asp',
   'discovered', 'Dongguk abroad/외국인전형 track'),
  ('university_admission_board', 'https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160',
   'discovered', 'Inha admissions board'),
  ('university_admission_board', 'https://www.sookmyung.ac.kr/kr/admission/admission-guide.do',
   'discovered', 'Sookmyung admissions guide'),

  -- STEM specialized (audit Tier 1, archetype G)
  ('university_admission_board', 'https://admission.unist.ac.kr/',
   'discovered', 'UNIST admissions board (archetype G)'),
  ('university_admission_board', 'https://www.gist.ac.kr/kr/html/sub06/060101.html',
   'discovered', 'GIST 입학안내 (archetype G)'),
  ('university_admission_board', 'https://www.dgist.ac.kr/kr/html/sub05/050202.html',
   'discovered', 'DGIST 입학안내 (archetype G)'),

  -- Flagship 거점국립대 nationals (audit Tier 2 — remaining 7 of 10)
  ('university_admission_board', 'https://international.jnu.ac.kr/',
   'discovered', 'CNU (Chonnam National) intl admissions'),
  ('university_admission_board', 'https://plus.cnu.ac.kr/html/kr/',
   'discovered', 'CNU-D (Chungnam National) admissions board'),
  ('university_admission_board', 'https://ipsi.chungbuk.ac.kr/',
   'discovered', 'CBNU (Chungbuk National) admissions board'),
  ('university_admission_board', 'https://enter.jbnu.ac.kr/',
   'discovered', 'JBNU (Jeonbuk National) admissions board'),
  ('university_admission_board', 'https://admission.kangwon.ac.kr/',
   'discovered', 'Kangwon National admissions board'),
  ('university_admission_board', 'https://ipsi.jejunu.ac.kr/',
   'discovered', 'Jeju National admissions board'),
  ('university_admission_board', 'https://www.inu.ac.kr/admission/index.do',
   'discovered', 'Incheon National admissions section')
on conflict (url_ko) do update
  set source_type = excluded.source_type,
      notes       = excluded.notes;
