-- ============================================================================
--  Seed the crawl's default institution work-list from the South Korea master
--  list (services/uni_db/data/south_korea_institutions.csv, 387 rows).
--
--  The nightly keyless crawl derives its work-list from public.institutions via
--  `uni-db todo` (which requires a non-null primary_domain). This adds the 82
--  institutions from the master list that were not already present — including
--  major universities the table was missing (Jeonju 전주대, Dongshin 동신대,
--  Yong-In 용인대, Daegu Haany 대구한의대, Seowon 서원대, Tech University of
--  Korea 한국공학대) and the four foreign branch campuses that admit
--  international students (George Mason, SUNY, Ghent, Utah-Asia).
--
--  Deliberately EXCLUDED (never crawled): the 7 military / police academies the
--  master list marks "not open to international admissions" — crawling them for
--  a foreign-applicant 모집요강 would be pure waste.
--
--  Idempotent: each row inserts only when no institution with that Korean name
--  (name_ko) already exists, so re-running is a no-op. name_ko is the identity
--  key the seed scripts and this crawl dedupe on. primary_domain is best-effort
--  for obscure schools (used as a non-null `todo` filter + on-domain search
--  hint); the routine crawl finds the actual guideline PDF by Korean-name web
--  search and holds every result for staff approval, so domain drift is
--  non-fatal and correctable.
-- ============================================================================

insert into public.institutions
  (name_ko, name_en, institution_type, primary_domain, region_code, ieqas_status)
select v.name_ko, v.name_en, v.institution_type, v.primary_domain, v.region_code, v.ieqas_status
from (values
  ('한국복지사이버대학', 'Korea Welfare Cyber College', 'cyber', 'kwcc.ac.kr', '대구', 'none'),
  ('영진사이버대학', 'Yeungjin Cyber College', 'cyber', 'ycc.ac.kr', '대구', 'none'),
  ('농협대학교', 'Agricultural Cooperative University', 'junior_college', 'nonghyup.ac.kr', '경기', 'none'),
  ('백석예술대학교', 'Baekseok Arts University', 'junior_college', 'bau.ac.kr', '서울', 'none'),
  ('배화여자대학교', 'Baewha Women''s University', 'junior_college', 'baewha.ac.kr', '서울', 'none'),
  ('가톨릭상지대학교', 'Catholic Sangji College', 'junior_college', 'csj.ac.kr', '경북', 'none'),
  ('춘해보건대학교', 'Choonhae College of Health Sciences', 'junior_college', 'ch.ac.kr', '울산', 'none'),
  ('조선이공대학교', 'Chosun College of Science and Technology', 'junior_college', 'cst.ac.kr', '광주', 'none'),
  ('전남과학대학교', 'Chunnam Techno University', 'junior_college', 'cntu.ac.kr', '전남', 'none'),
  ('대전과학기술대학교', 'Daejeon Institute of Science and Technology', 'junior_college', 'dst.ac.kr', '대전', 'none'),
  ('대경대학교', 'Daekyeung University', 'junior_college', 'tk.ac.kr', '경북', 'none'),
  ('동아보건대학교', 'Donga College of Health', 'junior_college', 'dhc.ac.kr', '전남', 'none'),
  ('강릉영동대학교', 'Gangneung Yeongdong University', 'junior_college', 'gyc.ac.kr', '강원', 'none'),
  ('경북보건대학교', 'Gyeongbuk College of Health', 'junior_college', 'gbhc.ac.kr', '경북', 'none'),
  ('한영대학교', 'Hanyeong University College', 'junior_college', 'hanyeong.ac.kr', '전남', 'none'),
  ('호산대학교', 'Hosan University', 'junior_college', 'hosan.ac.kr', '경북', 'none'),
  ('정화예술대학교', 'Jeonghwa Arts College', 'junior_college', 'jeonghwa.ac.kr', '서울', 'none'),
  ('강동대학교', 'Kangdong University', 'junior_college', 'kangdong.ac.kr', '충북', 'none'),
  ('고구려대학교', 'Koguryeo College', 'junior_college', 'koguryeo.ac.kr', '전남', 'none'),
  ('거제대학교', 'Koje College', 'junior_college', 'koje.ac.kr', '경남', 'none'),
  ('국제대학교', 'Kookje University', 'junior_college', 'kookje.ac.kr', '경기', 'none'),
  ('한국폴리텍대학', 'Korea Polytechnics (multi-campus)', 'junior_college', 'kopo.ac.kr', '인천', 'none'),
  ('경북과학대학교', 'Kyongbuk College of Science', 'junior_college', 'kbsc.ac.kr', '경북', 'none'),
  ('경북전문대학교', 'Kyungbuk College', 'junior_college', 'kbc.ac.kr', '경북', 'none'),
  ('서울여자간호대학교', 'Seoul Women''s College of Nursing', 'junior_college', 'snjc.ac.kr', '서울', 'none'),
  ('숭의여자대학교', 'Soongeui Women''s College', 'junior_college', 'sewc.ac.kr', '서울', 'none'),
  ('수성대학교', 'Suseong College', 'junior_college', 'sc.ac.kr', '대구', 'none'),
  ('대구과학대학교', 'Taegu Science University', 'junior_college', 'tsu.ac.kr', '대구', 'none'),
  ('국립경국대학교', 'Gyeongkuk National University', 'national', 'gknu.ac.kr', '경북', 'accredited'),
  ('한국학중앙연구원', 'Graduate School of Korean Studies (Academy of Korean Studies)', 'national_special', 'aks.ac.kr', '경기', 'accredited'),
  ('국제암대학원대학교', 'National Cancer Center Graduate School of Cancer Science and Policy', 'national_special', 'ncc.re.kr', '경기', 'outstanding'),
  ('과학기술연합대학원대학교', 'University of Science and Technology (UST)', 'national_special', 'ust.ac.kr', '대전', 'outstanding'),
  ('아시아라이프대학교', 'Asia LIFE University', 'private', 'asialife.ac.kr', '대전', 'none'),
  ('부산장신대학교', 'Busan Presbyterian University', 'private', 'bpu.ac.kr', '경남', 'none'),
  ('꽃동네대학교', 'Catholic Kkottongnae University', 'private', 'kkot.ac.kr', '충북', 'none'),
  ('대전가톨릭대학교', 'Catholic University of Daejeon', 'private', 'dcatholic.ac.kr', '세종', 'none'),
  ('부산가톨릭대학교', 'Catholic University of Pusan', 'private', 'cup.ac.kr', '부산', 'none'),
  ('대구한의대학교', 'Daegu Haany University', 'private', 'dhu.ac.kr', '경북', 'accredited'),
  ('대전신학대학교', 'Daejeon Theological University', 'private', 'djtu.ac.kr', '대전', 'none'),
  ('동신대학교', 'Dongshin University', 'private', 'dsu.ac.kr', '전남', 'accredited'),
  ('한일장신대학교', 'Hanil University and Presbyterian Theological Seminary', 'private', 'hanil.ac.kr', '전북', 'none'),
  ('호남신학대학교', 'Honam Theological University and Seminary', 'private', 'htus.ac.kr', '광주', 'none'),
  ('인천가톨릭대학교', 'Incheon Catholic University', 'private', 'iccu.ac.kr', '인천', 'none'),
  ('전주대학교', 'Jeonju University', 'private', 'jj.ac.kr', '전북', 'accredited'),
  ('예수대학교', 'Jesus University', 'private', 'jesus.ac.kr', '전북', 'none'),
  ('중앙승가대학교', 'Joongang Sangha University', 'private', 'sangha.ac.kr', '경기', 'none'),
  ('광신대학교', 'Kwangshin University', 'private', 'kwangshin.ac.kr', '광주', 'none'),
  ('서원대학교', 'Seowon University', 'private', 'seowon.ac.kr', '충북', 'none'),
  ('신경주대학교', 'SinGyeongju University', 'private', 'gju.ac.kr', '경북', 'none'),
  ('수원가톨릭대학교', 'Suwon Catholic University', 'private', 'suwoncatholic.ac.kr', '경기', 'none'),
  ('태재대학교', 'Taejae University', 'private', 'taejae.ac.kr', '서울', 'none'),
  ('한국공학대학교', 'Tech University of Korea', 'private', 'tukorea.ac.kr', '경기', 'none'),
  ('용인대학교', 'Yong-In University', 'private', 'yongin.ac.kr', '경기', 'none'),
  ('베뢰아국제대학원대학교', 'Berea International Theological Graduate University', 'specialized', 'berea.ac.kr', '서울', 'none'),
  ('청심신학대학원대학교', 'Cheongshim Graduate School of Theology', 'specialized', 'csgst.ac.kr', '경기', 'none'),
  ('대한신학대학원대학교', 'Daehan Theological Graduate University', 'specialized', 'daehanshin.ac.kr', '경기', 'none'),
  ('동방문화대학원대학교', 'Dongbang Culture Graduate University', 'specialized', 'dongbang.ac.kr', '서울', 'accredited'),
  ('한국조지메이슨대학교', 'George Mason University Korea', 'specialized', 'masonkorea.gmu.edu', '인천', 'none'),
  ('겐트대학교글로벌캠퍼스', 'Ghent University Global Campus', 'specialized', 'ghent.ac.kr', '인천', 'none'),
  ('실천신학대학원대학교', 'Graduate School of Practical Theology', 'specialized', 'kictt.ac.kr', '경기', 'none'),
  ('합동신학대학원대학교', 'Hapdong Theological Seminary', 'specialized', 'hapdong.ac.kr', '경기', 'none'),
  ('국제어학대학원대학교', 'International Graduate School of Language Education', 'specialized', 'igse.ac.kr', '서울', 'accredited'),
  ('한국전력국제원자력대학원대학교', 'KEPCO International Nuclear Graduate School', 'specialized', 'kings.ac.kr', '울산', 'outstanding'),
  ('한국상담대학원대학교', 'Korea Counseling Graduate University', 'specialized', 'kcgu.ac.kr', '서울', 'none'),
  ('계약신학대학원대학교', 'Kyeyak Graduate School of Theology', 'specialized', 'kyeyak.ac.kr', '경기', 'none'),
  ('온석대학원대학교', 'Onseok University', 'specialized', 'onseok.ac.kr', '경기', 'accredited'),
  ('개혁신학대학원대학교', 'Reformed Graduate University', 'specialized', 'rgu.ac.kr', '서울', 'outstanding'),
  ('서울성경신학대학원대학교', 'Seoul Bible Graduate School of Theology', 'specialized', 'sbgst.ac.kr', '서울', 'none'),
  ('서울미디어대학원대학교', 'Seoul Media Institute of Technology', 'specialized', 'smit.ac.kr', '서울', 'accredited'),
  ('서울과학종합대학원대학교', 'Seoul School of Integrated Sciences and Technologies (aSSIST)', 'specialized', 'assist.ac.kr', '서울', 'accredited'),
  ('서울외국어대학원대학교', 'Seoul University of Foreign Studies', 'specialized', 'sufs.ac.kr', '서울', 'accredited'),
  ('한국뉴욕주립대학교', 'State University of New York Korea', 'specialized', 'sunykorea.ac.kr', '인천', 'none'),
  ('수도국제대학원대학교', 'Sudo International University', 'specialized', 'sudo.ac.kr', '서울', 'accredited'),
  ('성산효대학원대학교', 'Sungsan Hyodo Graduate School', 'specialized', 'hyo.ac.kr', '인천', 'none'),
  ('선학유피대학원대학교', 'Sunhak Universal Peace Graduate University', 'specialized', 'supu.ac.kr', '경기', 'accredited'),
  ('횃불트리니티신학대학원대학교', 'Torch Trinity Graduate University', 'specialized', 'ttgu.ac.kr', '서울', 'accredited'),
  ('국제뇌교육종합대학원대학교', 'University of Brain Education', 'specialized', 'ube.ac.kr', '충남', 'none'),
  ('유타대학교아시아캠퍼스', 'University of Utah Asia Campus', 'specialized', 'utah.ac.kr', '인천', 'none'),
  ('웨스트민스터신학대학원대학교', 'Westminster Graduate School of Theology', 'specialized', 'wgst.ac.kr', '경기', 'none'),
  ('원불교대학원대학교', 'Won Buddhism Graduate School', 'specialized', 'wbgs.ac.kr', '전북', 'none'),
  ('예일신학대학원대학교', 'Yaeil Theological Graduate University', 'specialized', 'yaeil.ac.kr', '서울', 'none'),
  ('예명대학원대학교', 'Yemyung Graduate University', 'specialized', 'yemyung.ac.kr', '서울', 'accredited')
) as v(name_ko, name_en, institution_type, primary_domain, region_code, ieqas_status)
where not exists (select 1 from public.institutions i where i.name_ko = v.name_ko);
