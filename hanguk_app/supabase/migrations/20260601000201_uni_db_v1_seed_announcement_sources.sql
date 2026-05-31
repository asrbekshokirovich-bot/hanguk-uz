-- ============================================================================
--  uni_db v1 — seed announcement_sources for top-15 priority universities
--  Plan §E.3 / §I-Phase-0 step 3
--
--  Korean URLs only — no /eng/ paths (§P.1). Status starts at 'discovered';
--  the operator promotes to 'live' via Studio after a smoke test.
-- ============================================================================

set local search_path = public, pg_catalog;

-- Each row keys off the institution row created during Phase 1 backfill.
-- For Phase 0 we INSERT the source rows even if the matching institution
-- doesn't exist yet — the institution_id stays NULL and is back-filled by
-- the discovery worker once the institution row lands. The unique
-- constraint on url_ko keeps re-runs idempotent.

insert into public.announcement_sources (
  source_type, url_ko, status, notes
) values
  -- T0
  ('university_admission_board', 'https://admission.snu.ac.kr/international/notice',
   'discovered', 'SNU intl notices — archetype A anchor'),
  ('university_admission_board', 'https://admission.yonsei.ac.kr/',
   'discovered', 'Yonsei Sinchon main admissions board'),
  ('university_admission_board', 'https://admission.yonsei.ac.kr/mirae',
   'discovered', 'Yonsei Mirae (Wonju) admissions board'),
  ('university_admission_board', 'https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=700',
   'discovered', 'Korea University KO admissions board'),
  ('university_admission_board', 'https://admission.kaist.ac.kr/',
   'discovered', 'KAIST admissions board (KO surface)'),
  ('university_admission_board', 'https://admission.postech.ac.kr/',
   'discovered', 'POSTECH admissions board'),

  -- T1
  ('university_admission_board', 'https://admission.skku.edu/',
   'discovered', 'SKKU admissions board'),
  ('university_admission_board', 'https://go.hanyang.ac.kr/web/mojib/mojib.do?m_type=JEOEGUK',
   'discovered', 'Hanyang admissions board (JEOEGUK = 외국인전형)'),
  ('university_admission_board', 'https://admission.sogang.ac.kr/enter/html/abroad/notice.asp',
   'discovered', 'Sogang abroad/재외국민 notice board'),
  ('university_admission_board', 'https://admission.cau.ac.kr/main.do',
   'discovered', 'CAU admissions board'),
  ('university_admission_board', 'https://iphak.khu.ac.kr/',
   'discovered', 'Kyung Hee 입학 main board'),
  ('university_admission_board', 'https://adms.hufs.ac.kr/cms/FrCon/index.do?MENU_ID=230',
   'discovered', 'HUFS admissions board'),
  ('university_admission_board', 'https://admission.ewha.ac.kr/admission/html/abroad/guide.asp',
   'discovered', 'Ewha abroad track'),
  ('university_admission_board', 'https://admission.uos.ac.kr/',
   'discovered', 'University of Seoul admissions board'),

  -- Flagship nationals
  ('university_admission_board', 'https://international.pusan.ac.kr/',
   'discovered', 'PNU international admissions board'),
  ('university_admission_board', 'https://admission.knu.ac.kr/',
   'discovered', 'KNU admissions board'),

  -- National upstreams (audit §3 / §6.4)
  ('moe_okep',      'https://okep.moe.go.kr/board/list.do?board_manager_seq=16&menu_seq=22',
   'discovered', 'MOE okep — university 모집요강 board (#1 upstream)'),
  ('adiga',         'https://www.adiga.kr/',
   'discovered', 'Adiga (KCUE) — #2 upstream'),
  ('study_in_korea','https://www.studyinkorea.go.kr/',
   'discovered', 'NIIED Study in Korea — directory + GKS')
on conflict (url_ko) do update
  set source_type = excluded.source_type,
      notes       = excluded.notes;
