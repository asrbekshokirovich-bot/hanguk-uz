-- ============================================================================
--  uni_db v1 — seed term_glossary
--  Plan §C.16 / §P.3
--
--  Authoritative names for the top-15 priority institutions in en + uz +
--  the canonical Korean admissions vocabulary (외국인전형, 재외국민…).
--
--  These rows pin LLM translation outputs so "서울대학교" never gets
--  back-translated to "Capital University".
--
--  Idempotent via ON CONFLICT.
-- ============================================================================

set local search_path = public, pg_catalog;

-- ----------------------------------------------------------------------------
--  Top-15 institution names — English
-- ----------------------------------------------------------------------------
insert into public.term_glossary (term_ko, term_lang, term_value, category, authoritative) values
  ('서울대학교',         'en', 'Seoul National University',                'institution_name', true),
  ('연세대학교',         'en', 'Yonsei University',                        'institution_name', true),
  ('고려대학교',         'en', 'Korea University',                         'institution_name', true),
  ('한국과학기술원',     'en', 'KAIST',                                    'institution_name', true),
  ('포항공과대학교',     'en', 'POSTECH',                                  'institution_name', true),
  ('성균관대학교',       'en', 'Sungkyunkwan University',                  'institution_name', true),
  ('한양대학교',         'en', 'Hanyang University',                       'institution_name', true),
  ('서강대학교',         'en', 'Sogang University',                        'institution_name', true),
  ('중앙대학교',         'en', 'Chung-Ang University',                     'institution_name', true),
  ('경희대학교',         'en', 'Kyung Hee University',                     'institution_name', true),
  ('한국외국어대학교',   'en', 'Hankuk University of Foreign Studies',     'institution_name', true),
  ('이화여자대학교',     'en', 'Ewha Womans University',                   'institution_name', true),
  ('서울시립대학교',     'en', 'University of Seoul',                      'institution_name', true),
  ('부산대학교',         'en', 'Pusan National University',                'institution_name', true),
  ('경북대학교',         'en', 'Kyungpook National University',            'institution_name', true)
on conflict (term_ko, term_lang, category) do update
  set term_value = excluded.term_value,
      authoritative = excluded.authoritative;

-- ----------------------------------------------------------------------------
--  Top-15 institution names — Uzbek (transliterations are best-effort;
--  HITL Phase 3 confirms with native speakers).
-- ----------------------------------------------------------------------------
insert into public.term_glossary (term_ko, term_lang, term_value, category, authoritative) values
  ('서울대학교',         'uz', 'Seul Milliy Universiteti',                'institution_name', true),
  ('연세대학교',         'uz', 'Yonsei Universiteti',                     'institution_name', true),
  ('고려대학교',         'uz', 'Koreya Universiteti',                     'institution_name', true),
  ('한국과학기술원',     'uz', 'KAIST',                                    'institution_name', true),
  ('포항공과대학교',     'uz', 'POSTECH',                                  'institution_name', true),
  ('성균관대학교',       'uz', 'Sungkyunkwan Universiteti',               'institution_name', true),
  ('한양대학교',         'uz', 'Hanyang Universiteti',                    'institution_name', true),
  ('서강대학교',         'uz', 'Sogang Universiteti',                     'institution_name', true),
  ('중앙대학교',         'uz', 'Chung-Ang Universiteti',                  'institution_name', true),
  ('경희대학교',         'uz', 'Kyung Hee Universiteti',                  'institution_name', true),
  ('한국외국어대학교',   'uz', 'Koreya Chet Tillar Universiteti',          'institution_name', true),
  ('이화여자대학교',     'uz', 'Ewha Ayollar Universiteti',                'institution_name', true),
  ('서울시립대학교',     'uz', 'Seul Shahar Universiteti',                 'institution_name', true),
  ('부산대학교',         'uz', 'Pusan Milliy Universiteti',               'institution_name', true),
  ('경북대학교',         'uz', 'Kyungpook Milliy Universiteti',           'institution_name', true)
on conflict (term_ko, term_lang, category) do update
  set term_value = excluded.term_value,
      authoritative = excluded.authoritative;

-- ----------------------------------------------------------------------------
--  Official admissions terminology — English
--  These keep prompt outputs consistent so 외국인전형 never gets translated
--  inconsistently across screens.
-- ----------------------------------------------------------------------------
insert into public.term_glossary (term_ko, term_lang, term_value, category, authoritative) values
  ('모집요강',           'en', 'Admission Guidelines',                    'official_term',    true),
  ('수시모집',           'en', 'Early Admission (Susi)',                  'official_term',    true),
  ('정시모집',           'en', 'Regular Admission (Jeongsi)',             'official_term',    true),
  ('외국인전형',         'en', 'Foreign Applicant Track',                 'official_term',    true),
  ('외국인특별전형',     'en', 'Foreign Special Admission',               'official_term',    true),
  ('재외국민',           'en', 'Overseas Korean',                         'official_term',    true),
  ('재외국민특별전형',   'en', 'Overseas Korean Special Admission',       'official_term',    true),
  ('편입학',             'en', 'Transfer Admission',                      'official_term',    true),
  ('정정공고',           'en', 'Notice of Correction',                    'official_term',    true),
  ('변경공고',           'en', 'Notice of Amendment',                     'official_term',    true),
  ('일정변경',           'en', 'Schedule Change',                         'official_term',    true),
  ('추가모집',           'en', 'Additional Recruitment',                  'official_term',    true),
  ('충원합격',           'en', 'Waitlist Replacement',                    'official_term',    true),
  ('합격자발표',         'en', 'Successful Applicants Announcement',      'official_term',    true),
  ('원서접수',           'en', 'Application Period',                      'official_term',    true),
  ('등록금',             'en', 'Tuition',                                 'official_term',    true),
  ('장학금',             'en', 'Scholarship',                             'official_term',    true),
  ('입학금',             'en', 'Admission Fee',                           'official_term',    true),
  ('학과',               'en', 'Department',                              'official_term',    true),
  ('학부',               'en', 'Division (Hakbu)',                        'official_term',    true),
  ('단과대학',           'en', 'College',                                 'official_term',    true),
  ('전공',               'en', 'Major',                                   'official_term',    true)
on conflict (term_ko, term_lang, category) do update
  set term_value = excluded.term_value,
      authoritative = excluded.authoritative;

-- ----------------------------------------------------------------------------
--  Official admissions terminology — Uzbek
-- ----------------------------------------------------------------------------
insert into public.term_glossary (term_ko, term_lang, term_value, category, authoritative) values
  ('모집요강',           'uz', 'Qabul qoidalari',                         'official_term',    true),
  ('외국인전형',         'uz', 'Xorijliklar uchun qabul',                 'official_term',    true),
  ('재외국민특별전형',   'uz', 'Xorijdagi koreyaliklar uchun maxsus qabul','official_term',    true),
  ('정정공고',           'uz', 'Tuzatish e''loni',                        'official_term',    true),
  ('합격자발표',         'uz', 'Qabul natijalari e''loni',                'official_term',    true),
  ('등록금',             'uz', 'O''qish to''lovi',                        'official_term',    true),
  ('장학금',             'uz', 'Stipendiya',                              'official_term',    true)
on conflict (term_ko, term_lang, category) do update
  set term_value = excluded.term_value,
      authoritative = excluded.authoritative;
