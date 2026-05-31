-- ============================================================================
--  Demo seed: SNU, Yonsei, KAIST with full 2026 외국인전형 data.
--
--  Idempotent (fixed UUIDs + on-conflict handlers). Staging only — applies
--  cleanly against an empty staging DB to make every uni_db screen
--  demoable. Production should NOT seed demo data; the discovery worker
--  populates real rows there.
--
--  Applied via Supabase MCP on 2026-05-10 to nhjzbjzhmugcmzchzxlv.
--  Counts after run: 3 institutions, 4 admission_cycles, 7 recruitment_units,
--  18 cycle_dates, 8 tuition rows, 4 requirements, 4 scholarships,
--  14 documents_required, 3 guideline_documents.
-- ============================================================================

insert into public.institutions (id, name_ko, name_ko_short, name_en, primary_domain, institution_type, latitude, longitude, is_partner, is_visible_on_map, tier, ieqas_status, city_ko, display_names) values
  ('11111111-1111-1111-1111-111111111111', '서울대학교',     'SNU',    'Seoul National University', 'snu.ac.kr',     'national',         37.4602, 126.9520, true, true, 1, 'outstanding', '서울', '{"en": "Seoul National University", "uz": "Seul Milliy Universiteti"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', '연세대학교',     'Yonsei', 'Yonsei University',         'yonsei.ac.kr',  'private',          37.5651, 126.9395, true, true, 1, 'outstanding', '서울', '{"en": "Yonsei University", "uz": "Yonsei Universiteti"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', '한국과학기술원', 'KAIST',  'KAIST',                     'kaist.ac.kr',   'national_special', 36.3724, 127.3605, true, true, 1, 'outstanding', '대전', '{"en": "KAIST", "uz": "KAIST"}'::jsonb)
on conflict (id) do update set
  name_ko = excluded.name_ko, name_ko_short = excluded.name_ko_short,
  name_en = excluded.name_en, latitude = excluded.latitude, longitude = excluded.longitude,
  is_partner = excluded.is_partner, is_visible_on_map = excluded.is_visible_on_map,
  tier = excluded.tier, ieqas_status = excluded.ieqas_status, city_ko = excluded.city_ko,
  display_names = excluded.display_names, last_verified_at = now();

insert into public.guideline_documents (id, institution_id, source_url_ko, storage_path, file_hash_sha256, fetched_at, language, parse_status, archetype) values
  ('77777777-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'https://admission.snu.ac.kr/foreign/2026/guideline.pdf',    'snu/2026-foreign-guideline.pdf',    repeat('a', 64), now(), 'ko', 'succeeded', 'A'),
  ('77777777-0002-0002-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'https://admission.yonsei.ac.kr/foreign/2026/guideline.pdf', 'yonsei/2026-foreign-guideline.pdf', repeat('b', 64), now(), 'ko', 'succeeded', 'A'),
  ('77777777-0003-0003-0001-000000000001', '33333333-3333-3333-3333-333333333333', 'https://admission.kaist.ac.kr/foreign/2026/guideline.pdf',  'kaist/2026-foreign-guideline.pdf',  repeat('c', 64), now(), 'en', 'succeeded', 'G')
on conflict (id) do nothing;

insert into public.admission_cycles (id, institution_id, intake_year, intake_term, cycle_track, applicant_category, status, guideline_document_id) values
  ('aaaaaaa1-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 2026, 'spring', 'foreign',              '외국인전형',   'verified', '77777777-0001-0001-0001-000000000001'),
  ('aaaaaaa1-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 2026, 'spring', 'overseas_korean_full', '재외국민전형', 'verified', '77777777-0001-0001-0001-000000000001'),
  ('aaaaaaa2-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 2026, 'spring', 'foreign',              '외국인전형',   'verified', '77777777-0002-0002-0001-000000000001'),
  ('aaaaaaa3-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 2026, 'spring', 'foreign',              '외국인전형',   'verified', '77777777-0003-0003-0001-000000000001')
on conflict (id) do update set status = 'verified';

insert into public.recruitment_units (id, institution_id, faculty_ko, department_ko, faculty_group, is_active) values
  ('bbbbbbb1-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '인문대학',         '국어국문학과', 'humanities',  true),
  ('bbbbbbb1-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', '공과대학',         '컴퓨터공학부', 'engineering', true),
  ('bbbbbbb1-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', '경영대학',         '경영학과',     'social',      true),
  ('bbbbbbb2-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', '문과대학',         '영어영문학과', 'humanities',  true),
  ('bbbbbbb2-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '공과대학',         '컴퓨터과학과', 'engineering', true),
  ('bbbbbbb3-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', '전기및전자공학부', null,           'engineering', true),
  ('bbbbbbb3-3333-3333-3333-333333333332', '33333333-3333-3333-3333-333333333333', '전산학부',         null,           'engineering', true)
on conflict (id) do nothing;

insert into public.cycle_dates (id, cycle_id, event_type, starts_at, ends_at, is_tentative, notes_ko) values
  ('ccccccc0-0001-0001-0001-000000000001', 'aaaaaaa1-1111-1111-1111-111111111111', 'apply_open',                   '2026-09-01 09:00+09', null, false, '원서접수 시작'),
  ('ccccccc0-0001-0001-0001-000000000002', 'aaaaaaa1-1111-1111-1111-111111111111', 'apply_close',                  '2026-09-30 17:00+09', null, false, '원서접수 마감 (17:00 KST)'),
  ('ccccccc0-0001-0001-0001-000000000003', 'aaaaaaa1-1111-1111-1111-111111111111', 'document_submission_deadline', '2026-10-07 17:00+09', null, false, '서류제출 마감'),
  ('ccccccc0-0001-0001-0001-000000000004', 'aaaaaaa1-1111-1111-1111-111111111111', 'first_stage_results',          '2026-10-25 14:00+09', null, false, '1단계 합격자 발표'),
  ('ccccccc0-0001-0001-0001-000000000005', 'aaaaaaa1-1111-1111-1111-111111111111', 'interview',                    '2026-11-08 09:00+09', '2026-11-09 17:00+09', false, '면접 (2일간)'),
  ('ccccccc0-0001-0001-0001-000000000006', 'aaaaaaa1-1111-1111-1111-111111111111', 'final_results',                '2026-12-13 14:00+09', null, false, '최종 합격자 발표'),
  ('ccccccc0-0001-0001-0002-000000000001', 'aaaaaaa1-1111-1111-1111-111111111112', 'apply_open',                   '2026-08-15 09:00+09', null, false, ''),
  ('ccccccc0-0001-0001-0002-000000000002', 'aaaaaaa1-1111-1111-1111-111111111112', 'apply_close',                  '2026-09-15 17:00+09', null, false, ''),
  ('ccccccc0-0001-0001-0002-000000000003', 'aaaaaaa1-1111-1111-1111-111111111112', 'final_results',                '2026-12-06 14:00+09', null, false, ''),
  ('ccccccc0-0002-0002-0001-000000000001', 'aaaaaaa2-2222-2222-2222-222222222221', 'apply_open',                   '2026-09-05 09:00+09', null, false, ''),
  ('ccccccc0-0002-0002-0001-000000000002', 'aaaaaaa2-2222-2222-2222-222222222221', 'apply_close',                  '2026-09-28 17:00+09', null, false, ''),
  ('ccccccc0-0002-0002-0001-000000000003', 'aaaaaaa2-2222-2222-2222-222222222221', 'first_stage_results',          '2026-10-23 14:00+09', null, false, ''),
  ('ccccccc0-0002-0002-0001-000000000004', 'aaaaaaa2-2222-2222-2222-222222222221', 'interview',                    '2026-11-01 09:00+09', null, false, ''),
  ('ccccccc0-0002-0002-0001-000000000005', 'aaaaaaa2-2222-2222-2222-222222222221', 'final_results',                '2026-12-11 14:00+09', null, false, ''),
  ('ccccccc0-0003-0003-0001-000000000001', 'aaaaaaa3-3333-3333-3333-333333333331', 'apply_open',                   '2026-09-10 09:00+09', null, false, ''),
  ('ccccccc0-0003-0003-0001-000000000002', 'aaaaaaa3-3333-3333-3333-333333333331', 'apply_close',                  '2026-10-04 17:00+09', null, false, ''),
  ('ccccccc0-0003-0003-0001-000000000003', 'aaaaaaa3-3333-3333-3333-333333333331', 'interview',                    '2026-11-15 09:00+09', null, false, ''),
  ('ccccccc0-0003-0003-0001-000000000004', 'aaaaaaa3-3333-3333-3333-333333333331', 'final_results',                '2026-12-18 14:00+09', null, false, '')
on conflict (id) do nothing;

insert into public.tuition (id, institution_id, faculty_group, academic_year, semester_number, amount_krw, admission_fee_krw, is_first_semester, source_text_ko, extractor_confidence) values
  ('ddddddd0-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'humanities',     2026, 1, 4500000, 1000000, true,  '인문계열 1학기 등록금 4,500,000원', 0.95),
  ('ddddddd0-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', 'humanities',     2026, 2, 4500000, null,    false, '인문계열 2학기',                   0.95),
  ('ddddddd0-0001-0001-0001-000000000003', '11111111-1111-1111-1111-111111111111', 'engineering',    2026, 1, 6200000, 1000000, true,  '공학계열 1학기',                   0.95),
  ('ddddddd0-0001-0001-0001-000000000004', '11111111-1111-1111-1111-111111111111', 'engineering',    2026, 2, 6200000, null,    false, '공학계열 2학기',                   0.95),
  ('ddddddd0-0001-0001-0001-000000000005', '11111111-1111-1111-1111-111111111111', 'social_science', 2026, 1, 4800000, 1000000, true,  '사회계열 1학기',                   0.93),
  ('ddddddd0-0002-0002-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'humanities',     2026, 1, 5300000, 1100000, true,  '인문계열 1학기',                   0.95),
  ('ddddddd0-0002-0002-0001-000000000002', '22222222-2222-2222-2222-222222222222', 'engineering',    2026, 1, 7100000, 1100000, true,  '공학계열 1학기',                   0.95),
  ('ddddddd0-0003-0003-0001-000000000001', '33333333-3333-3333-3333-333333333333', 'engineering',    2026, 1, 4180000, 0,       true,  '공학계열 1학기 (입학금 면제)',     0.98)
on conflict (id) do nothing;

insert into public.requirements (id, cycle_id, applicant_category, topik_min_level, topik_deferred, english_test, gpa_floor_pct, interview_required, practical_exam_required, prose_ko, extractor_confidence) values
  ('eeeeeee0-0001-0001-0001-000000000001', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형',   4, true,  '{"type":"TOEFL iBT","min_score":80}'::jsonb, 80.0, true, false, 'TOPIK 4급 이상 필수, 졸업 전 취득 가능. 영어 능력 증명서는 TOEFL iBT 80점 이상 또는 IELTS 6.5 이상 권장.', 0.92),
  ('eeeeeee0-0001-0001-0001-000000000002', 'aaaaaaa1-1111-1111-1111-111111111112', '재외국민전형', null, false, '{"type":"TOEFL iBT","min_score":90}'::jsonb, 85.0, true, false, '12년 외국 정규교육 또는 12년 중 6년 이상 외국 교육 과정 이수자.', 0.90),
  ('eeeeeee0-0002-0002-0001-000000000001', 'aaaaaaa2-2222-2222-2222-222222222221', '외국인전형',   4, true,  '{"type":"TOEFL iBT","min_score":79}'::jsonb, null, true, false, 'TOPIK 4급 또는 TOEFL iBT 79점 이상.', 0.93),
  ('eeeeeee0-0003-0003-0001-000000000001', 'aaaaaaa3-3333-3333-3333-333333333331', '외국인전형',   3, true,  '{"type":"TOEFL iBT","min_score":83}'::jsonb, null, true, false, 'KAIST는 영어 강의 비중이 높아 TOPIK 3급도 가능. 영어 점수 우선.', 0.94)
on conflict (id) do nothing;

insert into public.scholarships (id, institution_id, scope, name_ko, name_en, award_type, award_value, applicant_categories, topik_tier_table, prose_ko, extractor_confidence) values
  ('fffffff0-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'university', 'SNU 외국인 우수장학금',     'SNU Excellence Scholarship for Foreign Students', 'tuition_waiver_pct', 100, '{외국인전형}',                 '{"6":100,"5":70,"4":50}'::jsonb, '입학 후 첫 학기는 자동 적용. 2학기부터는 학점 평균 3.5/4.3 이상 유지 필요.', 0.94),
  ('fffffff0-0001-0001-0001-000000000002', '11111111-1111-1111-1111-111111111111', 'national',   '한국정부초청장학생',         'GKS Korean Government Scholarship',                'stipend_monthly',     900000, '{외국인전형,재외국민전형}', null,                              '한국정부초청장학생(GKS)에 선발된 학생은 등록금 전액 면제 + 월 90만원 생활비 지원.', 0.97),
  ('fffffff0-0002-0002-0001-000000000001', '22222222-2222-2222-2222-222222222222', 'university', '연세대학교 외국인 장학',     'Yonsei Foreign Student Scholarship',               'tuition_waiver_pct',  50,     '{외국인전형}',                 '{"6":75,"5":50,"4":30}'::jsonb,  'TOPIK 등급에 따라 차등 지급.', 0.92),
  ('fffffff0-0003-0003-0001-000000000001', '33333333-3333-3333-3333-333333333333', 'university', 'KAIST 국제학생 등록금 전액', 'KAIST Foreign Student Full Tuition',               'tuition_waiver_pct',  100,    '{외국인전형}',                 null,                              'KAIST 입학 외국인 학생 전원에게 첫 1년간 등록금 전액 지원.', 0.96)
on conflict (id) do nothing;

insert into public.documents_required (id, cycle_id, applicant_category, document_type, is_required, is_apostille_required, country_specific, notes_ko) values
  ('aaaa9999-0001-0001-0001-000000000001', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', '고등학교 졸업증명서 (HS diploma)', true,  true,  '{"UZ":{"requires_apostille":true},"CN":{"requires_consular":true},"VN":{"requires_apostille":true}}'::jsonb, '졸업증명서는 본국 외교부 아포스티유 또는 영사확인 필요.'),
  ('aaaa9999-0001-0001-0001-000000000002', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', '고등학교 성적증명서',              true,  true,  '{"UZ":{"requires_apostille":true},"CN":{"requires_chesicc":true}}'::jsonb,                                  'CN: 학신망(CHESICC) 인증 추가 필요.'),
  ('aaaa9999-0001-0001-0001-000000000003', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', '여권 사본',                       true,  false, null, null),
  ('aaaa9999-0001-0001-0001-000000000004', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', '국적증명서',                      true,  false, null, '본인 및 부모 모두의 국적이 외국인임을 증명.'),
  ('aaaa9999-0001-0001-0001-000000000005', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', '자기소개서 및 학업계획서',         true,  false, null, '한국어 또는 영어로 작성.'),
  ('aaaa9999-0001-0001-0001-000000000006', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', 'TOPIK 성적표',                    true,  false, null, '4급 이상 필수, 졸업 전 취득 가능 (조건부 합격).'),
  ('aaaa9999-0001-0001-0001-000000000007', 'aaaaaaa1-1111-1111-1111-111111111111', '외국인전형', '영어 공인 성적표',                false, false, null, '권장 (없어도 지원 가능).'),
  ('aaaa9999-0002-0002-0001-000000000001', 'aaaaaaa2-2222-2222-2222-222222222221', '외국인전형', '고등학교 졸업증명서',             true,  true,  '{"UZ":{"requires_apostille":true},"VN":{"requires_apostille":true}}'::jsonb, ''),
  ('aaaa9999-0002-0002-0001-000000000002', 'aaaaaaa2-2222-2222-2222-222222222221', '외국인전형', '고등학교 성적증명서',             true,  true,  null, ''),
  ('aaaa9999-0002-0002-0001-000000000003', 'aaaaaaa2-2222-2222-2222-222222222221', '외국인전형', '여권 사본',                       true,  false, null, ''),
  ('aaaa9999-0002-0002-0001-000000000004', 'aaaaaaa2-2222-2222-2222-222222222221', '외국인전형', '재정증명서',                      true,  false, null, '학비 + 생활비 1년치 보유 증명.'),
  ('aaaa9999-0003-0003-0001-000000000001', 'aaaaaaa3-3333-3333-3333-333333333331', '외국인전형', 'High school diploma & transcript', true,  true,  null, ''),
  ('aaaa9999-0003-0003-0001-000000000002', 'aaaaaaa3-3333-3333-3333-333333333331', '외국인전형', 'Self introduction & study plan',   true,  false, null, '영어로 작성.'),
  ('aaaa9999-0003-0003-0001-000000000003', 'aaaaaaa3-3333-3333-3333-333333333331', '외국인전형', 'Two recommendation letters',       true,  false, null, '학교 교사 또는 교수의 추천서.')
on conflict (id) do nothing;
