-- ============================================================================
--  Backfill tier (0-4) and ieqas_status for institutions
--  Tier 0 = SKY + elite (user tier 1)
--  Tier 1 = Major national + strong private (user tier 2)
--  Tier 2 = Regional + mid-tier private (user tier 3)
--  Tier 3 = Smaller private + specialized (user tier 4)
--  Tier 4 = Junior colleges / 전문대학 (user tier 5)
-- ============================================================================

-- ============================================================================
--  1. UPDATE tier
-- ============================================================================

UPDATE public.institutions AS i
SET tier = v.tier
FROM (VALUES
  -- Tier 0: SKY + elite national/private
  ('서울대학교',        0),
  ('연세대학교',        0),
  ('고려대학교',        0),
  ('한국과학기술원',    0),
  ('포항공과대학교',    0),
  ('성균관대학교',      0),
  ('한양대학교',        0),
  ('서강대학교',        0),
  ('중앙대학교',        0),
  ('경희대학교',        0),
  ('한국외국어대학교',  0),
  ('이화여자대학교',    0),
  ('서울시립대학교',    0),
  ('광주과학기술원',    0),
  ('울산과학기술원',    0),
  ('대구경북과학기술원',0),

  -- Tier 1: Major national + strong private
  ('부산대학교',        1),
  ('경북대학교',        1),
  ('전남대학교',        1),
  ('전북대학교',        1),
  ('충남대학교',        1),
  ('충북대학교',        1),
  ('강원대학교',        1),
  ('경상국립대학교',    1),
  ('인천대학교',        1),
  ('건국대학교',        1),
  ('동국대학교',        1),
  ('숙명여자대학교',    1),
  ('국민대학교',        1),
  ('숭실대학교',        1),
  ('세종대학교',        1),
  ('홍익대학교',        1),
  ('아주대학교',        1),
  ('인하대학교',        1),
  ('단국대학교',        1),
  ('가톨릭대학교',      1),
  ('광운대학교',        1),
  ('서울과학기술대학교', 1),
  ('명지대학교',        1),
  ('상명대학교',        1),
  ('덕성여자대학교',    1),
  ('동덕여자대학교',    1),
  ('성신여자대학교',    1),
  ('서울여자대학교',    1),

  -- Tier 2: Regional + mid-tier private
  ('경기대학교',        2),
  ('강남대학교',        2),
  ('가천대학교',        2),
  ('대구대학교',        2),
  ('동아대학교',        2),
  ('부경대학교',        2),
  ('영남대학교',        2),
  ('울산대학교',        2),
  ('원광대학교',        2),
  ('한남대학교',        2),
  ('한동대학교',        2),
  ('한림대학교',        2),
  ('호서대학교',        2),
  ('순천향대학교',      2),
  ('목포대학교',        2),
  ('안동대학교',        2),
  ('군산대학교',        2),
  ('공주대학교',        2),
  ('창원대학교',        2),
  ('경성대학교',        2),
  ('동서대학교',        2),
  ('동의대학교',        2),
  ('신라대학교',        2),
  ('한서대학교',        2),
  ('조선대학교',        2),
  ('을지대학교',        2),
  ('삼육대학교',        2),
  ('상지대학교',        2),
  ('선문대학교',        2),
  ('수원대학교',        2),
  ('한성대학교',        2),
  ('서경대학교',        2),
  ('배재대학교',        2),
  ('경동대학교',        2),
  ('가톨릭관동대학교',  2),
  ('목원대학교',        2),
  ('대전대학교',        2),
  ('건양대학교',        2),
  ('호남대학교',        2),
  ('경운대학교',        2),
  ('고신대학교',        2),
  ('강릉원주대학교',    2),
  ('한세대학교',        2),
  ('한신대학교',        2),
  ('경남대학교',        2),
  ('국립금오공과대학교', 2),
  ('국립한밭대학교',    2),
  ('김천대학교',        2),
  ('우송대학교',        2),
  ('인제대학교',        2),
  ('차의과학대학교',    2),
  ('한국교통대학교',    2),
  ('한국교원대학교',    2),
  ('한국항공대학교',    2),
  ('한국해양대학교',    2),
  ('한경대학교',        2),
  ('부산외국어대학교',  2),
  ('백석대학교',        2),
  ('한국기술교육대학교', 2),
  ('협성대학교',        2),
  ('대진대학교',        2),
  ('한양사이버대학교',  2),
  ('경희사이버대학교',  2),
  ('청주대학교',        2),
  ('세명대학교',        2),

  -- Tier 3: Smaller private + specialized + remaining 4-year
  ('극동대학교',        3),
  ('금강대학교',        3),
  ('나사렛대학교',      3),
  ('남부대학교',        3),
  ('남서울대학교',      3),
  ('대구가톨릭대학교',  3),
  ('대구예술대학교',    3),
  ('대신대학교',        3),
  ('동국대학교 WISE캠퍼스', 3),
  ('동명대학교',        3),
  ('동양대학교',        3),
  ('루터대학교',        3),
  ('목포가톨릭대학교',  3),
  ('서울기독대학교',    3),
  ('서울신학대학교',    3),
  ('성결대학교',        3),
  ('성공회대학교',      3),
  ('세한대학교',        3),
  ('송원대학교',        3),
  ('신한대학교',        3),
  ('안양대학교',        3),
  ('영동대학교',        3),
  ('영산대학교',        3),
  ('우석대학교',        3),
  ('위덕대학교',        3),
  ('유원대학교',        3),
  ('초당대학교',        3),
  ('총신대학교',        3),
  ('추계예술대학교',    3),
  ('침례신학대학교',    3),
  ('칼빈대학교',        3),
  ('평택대학교',        3),
  ('호원대학교',        3),
  ('경일대학교',        3),
  ('광주대학교',        3),
  ('광주가톨릭대학교',  3),
  ('중부대학교',        3),
  ('중원대학교',        3),
  ('서울한영대학교',    3),
  ('서울장신대학교',    3),
  ('한국국제대학교',    3),
  ('한중대학교',        3),
  ('아신대학교',        3),
  ('감리교신학대학교',  3),
  ('장로회신학대학교',  3),
  ('한국성서대학교',    3),
  ('케이씨대학교',      3),
  ('가야대학교',        3),
  ('탐라대학교',        3),
  ('청운대학교',        3),
  ('한려대학교',        3),
  ('창신대학교',        3),
  ('목포해양대학교',    3),
  ('한국에너지공과대학교', 3),
  ('한국전통문화대학교', 3),
  ('한국체육대학교',    3),
  ('한국예술종합학교',  3),
  ('한국방송통신대학교', 3),
  ('건국대학교 글로컬캠퍼스', 3),
  ('계명대학교',        3),
  ('광주여자대학교',    3),
  ('순천대학교',        3),
  ('제주대학교',        3),
  ('제주국제대학교',    3),
  ('한라대학교',        3),
  ('한국기독교대학교',  3),
  ('신경대학교',        3),
  ('영산선학대학교',    3)
) AS v(name_ko, tier)
WHERE i.name_ko = v.name_ko;

-- Remaining: all cyber universities -> tier 3
UPDATE public.institutions
SET tier = 3
WHERE institution_type = 'cyber' AND tier IS NULL;

-- Remaining: all education universities -> tier 3
UPDATE public.institutions
SET tier = 3
WHERE institution_type = 'education_university' AND tier IS NULL;

-- Remaining: all specialized -> tier 3
UPDATE public.institutions
SET tier = 3
WHERE institution_type = 'specialized' AND tier IS NULL;

-- Remaining: all national_special not already assigned -> tier 3
UPDATE public.institutions
SET tier = 3
WHERE institution_type = 'national_special' AND tier IS NULL;

-- Any remaining 4-year universities not yet assigned -> tier 3
UPDATE public.institutions
SET tier = 3
WHERE institution_type IN ('national','public','private') AND tier IS NULL;

-- Tier 4: All junior colleges
UPDATE public.institutions
SET tier = 4
WHERE institution_type = 'junior_college' AND tier IS NULL;


-- ============================================================================
--  2. UPDATE ieqas_status
--  Based on IEQAS (국제교육품질인증제도) 2024 certified university list.
--  Sources: studyinkorea.go.kr, KCUE announcements.
-- ============================================================================

UPDATE public.institutions AS i
SET ieqas_status = v.status
FROM (VALUES
  -- IEQAS 인증 우수 (outstanding)
  ('서울대학교',          'accredited'),
  ('연세대학교',          'accredited'),
  ('고려대학교',          'accredited'),
  ('성균관대학교',        'accredited'),
  ('한양대학교',          'accredited'),
  ('서강대학교',          'accredited'),
  ('중앙대학교',          'accredited'),
  ('경희대학교',          'accredited'),
  ('한국외국어대학교',    'accredited'),
  ('이화여자대학교',      'accredited'),
  ('서울시립대학교',      'accredited'),
  ('건국대학교',          'accredited'),
  ('동국대학교',          'accredited'),
  ('홍익대학교',          'accredited'),
  ('숙명여자대학교',      'accredited'),
  ('국민대학교',          'accredited'),
  ('숭실대학교',          'accredited'),
  ('세종대학교',          'accredited'),
  ('단국대학교',          'accredited'),
  ('가톨릭대학교',        'accredited'),
  ('인하대학교',          'accredited'),
  ('아주대학교',          'accredited'),
  ('광운대학교',          'accredited'),
  ('명지대학교',          'accredited'),
  ('상명대학교',          'accredited'),
  ('서울과학기술대학교',  'accredited'),
  ('덕성여자대학교',      'accredited'),
  ('동덕여자대학교',      'accredited'),
  ('성신여자대학교',      'accredited'),
  ('서울여자대학교',      'accredited'),
  ('삼육대학교',          'accredited'),
  ('한성대학교',          'accredited'),
  ('서경대학교',          'accredited'),
  ('성결대학교',          'accredited'),
  ('성공회대학교',        'accredited'),
  ('총신대학교',          'accredited'),
  ('추계예술대학교',      'accredited'),
  ('감리교신학대학교',    'accredited'),
  ('장로회신학대학교',    'accredited'),
  ('한국성서대학교',      'accredited'),
  ('부산대학교',          'accredited'),
  ('경북대학교',          'accredited'),
  ('전남대학교',          'accredited'),
  ('전북대학교',          'accredited'),
  ('충남대학교',          'accredited'),
  ('충북대학교',          'accredited'),
  ('강원대학교',          'accredited'),
  ('경상국립대학교',      'accredited'),
  ('인천대학교',          'accredited'),
  ('제주대학교',          'accredited'),
  ('창원대학교',          'accredited'),
  ('공주대학교',          'accredited'),
  ('군산대학교',          'accredited'),
  ('목포대학교',          'accredited'),
  ('안동대학교',          'accredited'),
  ('순천대학교',          'accredited'),
  ('강릉원주대학교',      'accredited'),
  ('한국교원대학교',      'accredited'),
  ('한국교통대학교',      'accredited'),
  ('한국해양대학교',      'accredited'),
  ('한경대학교',          'accredited'),
  ('서울교육대학교',      'accredited'),
  ('국립금오공과대학교',  'accredited'),
  ('국립한밭대학교',      'accredited'),
  ('한국기술교육대학교',  'accredited'),
  ('경기대학교',          'accredited'),
  ('가천대학교',          'accredited'),
  ('대구대학교',          'accredited'),
  ('동아대학교',          'accredited'),
  ('영남대학교',          'accredited'),
  ('울산대학교',          'accredited'),
  ('한남대학교',          'accredited'),
  ('한동대학교',          'accredited'),
  ('한림대학교',          'accredited'),
  ('호서대학교',          'accredited'),
  ('순천향대학교',        'accredited'),
  ('조선대학교',          'accredited'),
  ('부경대학교',          'accredited'),
  ('원광대학교',          'accredited'),
  ('인제대학교',          'accredited'),
  ('배재대학교',          'accredited'),
  ('선문대학교',          'accredited'),
  ('백석대학교',          'accredited'),
  ('대전대학교',          'accredited'),
  ('건양대학교',          'accredited'),
  ('우송대학교',          'accredited'),
  ('을지대학교',          'accredited'),
  ('차의과학대학교',      'accredited'),
  ('경성대학교',          'accredited'),
  ('동서대학교',          'accredited'),
  ('동의대학교',          'accredited'),
  ('부산외국어대학교',    'accredited'),
  ('신라대학교',          'accredited'),
  ('한서대학교',          'accredited'),
  ('목원대학교',          'accredited'),
  ('강남대학교',          'accredited'),
  ('수원대학교',          'accredited'),
  ('협성대학교',          'accredited'),
  ('대진대학교',          'accredited'),
  ('한양사이버대학교',    'accredited'),
  ('경희사이버대학교',    'accredited'),
  ('고려사이버대학교',    'accredited'),
  ('한국항공대학교',      'accredited'),
  ('계명대학교',          'accredited'),
  ('대구가톨릭대학교',    'accredited'),
  ('남서울대학교',        'accredited'),
  ('세명대학교',          'accredited'),
  ('청주대학교',          'accredited'),
  ('호남대학교',          'accredited'),
  ('경남대학교',          'accredited'),
  ('김천대학교',          'accredited'),
  ('한세대학교',          'accredited'),
  ('한신대학교',          'accredited'),
  ('경동대학교',          'accredited'),
  ('가톨릭관동대학교',    'accredited'),
  ('고신대학교',          'accredited'),
  ('상지대학교',          'accredited'),
  ('동명대학교',          'accredited'),
  ('안양대학교',          'accredited'),
  ('평택대학교',          'accredited'),
  ('나사렛대학교',        'accredited'),
  ('경운대학교',          'accredited')
) AS v(name_ko, status)
WHERE i.name_ko = v.name_ko;

-- Set remaining institutions to 'none' (not IEQAS certified)
UPDATE public.institutions
SET ieqas_status = 'none'
WHERE ieqas_status IS NULL;
