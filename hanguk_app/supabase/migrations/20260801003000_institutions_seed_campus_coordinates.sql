-- ============================================================================
--  Seed main-campus coordinates for every institution so the Kakao map can
--  locate and render ALL universities on our list — even the ones that do not
--  have admission / tuition / scholarship data filled in yet.
--
--  The map filters out any institution missing latitude/longitude
--  (UniversityMapKakao.tsx -> .filter(u => u.latitude && u.longitude)), so
--  without coordinates a university never appears as a marker. These are
--  best-known main-campus coordinates (campus-level accuracy for the major
--  institutions, city-level for the smaller ones). Detail data is independent
--  and continues to be populated by the discovery worker.
--
--  Idempotent: only fills coordinates where they are currently NULL, matched on
--  primary_domain so it is robust against UUID differences between environments.
-- ============================================================================

update public.institutions as i
set latitude = c.lat,
    longitude = c.lng
from (
  values
    ('acts.ac.kr',      37.4836, 127.4914),  -- ACTS University (Yangpyeong)
    ('ajou.ac.kr',      37.2820, 127.0450),  -- Ajou University (Suwon)
    ('anu.ac.kr',       36.5444, 128.7967),  -- Andong National University
    ('bu.ac.kr',        36.8390, 127.1830),  -- Baekseok University (Cheonan)
    ('cku.ac.kr',       37.6896, 128.8430),  -- Catholic Kwandong University (Gangneung)
    ('catholic.ac.kr',  37.4874, 126.8559),  -- Catholic University of Korea (Bucheon)
    ('changwon.ac.kr',  35.2470, 128.6810),  -- Changwon National University
    ('cju.ac.kr',       36.6390, 127.4960),  -- Cheongju University
    ('cdu.ac.kr',       34.9890, 126.4360),  -- Chodang University (Muan)
    ('jnu.ac.kr',       35.1759, 126.9082),  -- Chonnam National University (Gwangju)
    ('chosun.ac.kr',    35.1399, 126.9290),  -- Chosun University (Gwangju)
    ('cau.ac.kr',       37.5050, 126.9570),  -- Chung-Ang University (Seoul)
    ('cbnu.ac.kr',      36.6280, 127.4570),  -- Chungbuk National University (Cheongju)
    ('cnu.ac.kr',       36.3620, 127.3460),  -- Chungnam National University (Daejeon)
    ('daedong.ac.kr',   35.2330, 129.0890),  -- Daedong University (Busan)
    ('cu.ac.kr',        35.8540, 128.7460),  -- Daegu Catholic University (Gyeongsan)
    ('dgist.ac.kr',     35.7050, 128.4560),  -- DGIST (Daegu)
    ('daegu.ac.kr',     35.9070, 128.8090),  -- Daegu University (Gyeongsan)
    ('dju.ac.kr',       36.3290, 127.4490),  -- Daejeon University
    ('daejin.ac.kr',    37.9430, 127.1960),  -- Daejin University (Pocheon)
    ('dankook.ac.kr',   37.3220, 127.1260),  -- Dankook University (Yongin/Jukjeon)
    ('donga.ac.kr',     35.1158, 128.9657),  -- Dong-A University (Busan)
    ('deu.ac.kr',       35.1390, 129.0290),  -- Dong-eui University (Busan)
    ('dongduk.ac.kr',   37.6060, 127.0420),  -- Dongduk Women's University (Seoul)
    ('dongguk.edu',     37.5580, 127.0000),  -- Dongguk University (Seoul)
    ('dongguk.ac.kr',   35.8580, 129.2230),  -- Dongguk University (WISE/Gyeongju)
    ('dongnam.ac.kr',   37.2880, 127.0590),  -- Dongnam Health University (Suwon)
    ('dongseo.ac.kr',   35.1080, 128.9620),  -- Dongseo University (Busan)
    ('duksung.ac.kr',   37.6520, 127.0160),  -- Duksung Women's University (Seoul)
    ('eulji.ac.kr',     37.4480, 127.1430),  -- Eulji University (Seongnam)
    ('ewha.ac.kr',      37.5620, 126.9470),  -- Ewha Womans University (Seoul)
    ('gachon.ac.kr',    37.4500, 127.1290),  -- Gachon University (Seongnam)
    ('gwnu.ac.kr',      37.7710, 128.8670),  -- Gangneung-Wonju National University
    ('gimcheon.ac.kr',  36.1390, 128.1190),  -- Gimcheon University
    ('gist.ac.kr',      35.2280, 126.8430),  -- GIST (Gwangju)
    ('gnu.ac.kr',       35.1530, 128.0980),  -- Gyeongsang National University (Jinju)
    ('halla.ac.kr',     37.3260, 127.8590),  -- Halla University (Wonju)
    ('hallym.ac.kr',    37.8880, 127.7380),  -- Hallym University (Chuncheon)
    ('hanbat.ac.kr',    36.3510, 127.2980),  -- Hanbat National University (Daejeon)
    ('handong.edu',     36.1010, 129.3890),  -- Handong Global University (Pohang)
    ('hufs.ac.kr',      37.5970, 127.0590),  -- Hankuk University of Foreign Studies (Seoul)
    ('hannam.ac.kr',    36.3540, 127.4210),  -- Hannam University (Daejeon)
    ('hansei.ac.kr',    37.3360, 126.9230),  -- Hansei University (Gunpo)
    ('hanseo.ac.kr',    36.8050, 126.4540),  -- Hanseo University (Seosan)
    ('hs.ac.kr',        37.1900, 127.0480),  -- Hanshin University (Osan)
    ('hansung.ac.kr',   37.5820, 127.0100),  -- Hansung University (Seoul)
    ('hycu.ac.kr',      37.5570, 127.0450),  -- Hanyang Cyber University (Seoul)
    ('hanyang.ac.kr',   37.5550, 127.0450),  -- Hanyang University (Seoul)
    ('honam.ac.kr',     35.1390, 126.7830),  -- Honam University (Gwangju)
    ('hongik.ac.kr',    37.5510, 126.9250),  -- Hongik University (Seoul)
    ('hoseo.edu',       36.7690, 127.0680),  -- Hoseo University (Asan)
    ('uhs.ac.kr',       37.2160, 126.9740),  -- Hyupsung University (Hwaseong)
    ('inu.ac.kr',       37.3750, 126.6320),  -- Incheon National University (Songdo)
    ('inha.ac.kr',      37.4500, 126.6540),  -- Inha University (Incheon)
    ('inje.ac.kr',      35.2530, 128.8800),  -- Inje University (Gimhae)
    ('jejunu.ac.kr',    33.4560, 126.5610),  -- Jeju National University
    ('jbnu.ac.kr',      35.8460, 127.1290),  -- Jeonbuk National University (Jeonju)
    ('kaist.ac.kr',     36.3724, 127.3605),  -- KAIST (Daejeon)
    ('kangnam.ac.kr',   37.2740, 127.1340),  -- Kangnam University (Yongin)
    ('kangwon.ac.kr',   37.8690, 127.7440),  -- Kangwon National University (Chuncheon)
    ('kmu.ac.kr',       35.8550, 128.4880),  -- Keimyung University (Daegu)
    ('kongju.ac.kr',    36.4710, 127.1390),  -- Kongju National University (Gongju)
    ('konkuk.ac.kr',    37.5410, 127.0790),  -- Konkuk University (Seoul)
    ('kku.ac.kr',       36.9700, 127.9290),  -- Konkuk University (GLOCAL/Chungju)
    ('konyang.ac.kr',   36.2330, 127.0840),  -- Konyang University (Nonsan)
    ('kookmin.ac.kr',   37.6110, 126.9970),  -- Kookmin University (Seoul)
    ('kau.ac.kr',       37.6000, 126.8650),  -- Korea Aerospace University (Goyang)
    ('kentech.ac.kr',   35.0230, 126.7900),  -- KENTECH (Naju)
    ('kmou.ac.kr',      35.0750, 129.0860),  -- Korea Maritime and Ocean University (Busan)
    ('knsu.ac.kr',      37.5170, 127.1290),  -- Korea National Sport University (Seoul)
    ('karts.ac.kr',     37.5970, 127.0510),  -- Korea National University of Arts (Seoul)
    ('knue.ac.kr',      36.7200, 127.4180),  -- Korea National University of Education (Cheongju)
    ('ut.ac.kr',        36.9690, 127.8700),  -- Korea National University of Transportation (Chungju)
    ('korea.ac.kr',     37.5890, 127.0320),  -- Korea University (Seoul)
    ('kosin.ac.kr',     35.0790, 129.0890),  -- Kosin University (Busan)
    ('kumoh.ac.kr',     36.1450, 128.3930),  -- Kumoh National Institute of Technology (Gumi)
    ('kunsan.ac.kr',    35.9460, 126.6820),  -- Kunsan National University
    ('kw.ac.kr',        37.6190, 127.0590),  -- Kwangwoon University (Seoul)
    ('kyonggi.ac.kr',   37.3010, 127.0350),  -- Kyonggi University (Suwon)
    ('khu.ac.kr',       37.5960, 127.0520),  -- Kyung Hee University (Seoul)
    ('kduniv.ac.kr',    38.3344, 128.4666),  -- Kyungdong University (Goseong)
    ('knu.ac.kr',       35.8900, 128.6110),  -- Kyungpook National University (Daegu)
    ('ks.ac.kr',        35.1430, 129.0980),  -- Kyungsung University (Busan)
    ('ikw.ac.kr',       36.1760, 128.3210),  -- Kyungwoon University (Gumi)
    ('mokpo.ac.kr',     34.9130, 126.4380),  -- Mokpo National University (Muan)
    ('mokwon.ac.kr',    36.3270, 127.3360),  -- Mokwon University (Daejeon)
    ('mju.ac.kr',       37.2237, 127.1884),  -- Myongji University (Yongin)
    ('pcu.ac.kr',       36.3520, 127.3680),  -- Pai Chai University (Daejeon)
    ('postech.ac.kr',   36.0140, 129.3220),  -- POSTECH (Pohang)
    ('pknu.ac.kr',      35.1340, 129.1060),  -- Pukyong National University (Busan)
    ('pusan.ac.kr',     35.2330, 129.0790),  -- Pusan National University (Busan)
    ('syu.ac.kr',       37.6430, 127.1050),  -- Sahmyook University (Seoul)
    ('sangji.ac.kr',    37.3770, 127.9170),  -- Sangji University (Wonju)
    ('smu.ac.kr',       37.6020, 126.9550),  -- Sangmyung University (Seoul)
    ('sejong.ac.kr',    37.5500, 127.0740),  -- Sejong University (Seoul)
    ('skuniv.ac.kr',    37.6150, 127.0130),  -- Seokyeong University (Seoul)
    ('snu.ac.kr',       37.4602, 126.9520),  -- Seoul National University (Seoul)
    ('snue.ac.kr',      37.4890, 127.0160),  -- Seoul National University of Education (Seoul)
    ('seoultech.ac.kr', 37.6310, 127.0770),  -- Seoul Nat'l University of Science and Technology (Seoul)
    ('swu.ac.kr',       37.6280, 127.0900),  -- Seoul Women's University (Seoul)
    ('silla.ac.kr',     35.1780, 128.9890),  -- Silla University (Busan)
    ('sogang.ac.kr',    37.5510, 126.9410),  -- Sogang University (Seoul)
    ('sookmyung.ac.kr', 37.5460, 126.9650),  -- Sookmyung Women's University (Seoul)
    ('sch.ac.kr',       36.7700, 126.9320),  -- Soonchunhyang University (Asan)
    ('ssu.ac.kr',       37.4960, 126.9570),  -- Soongsil University (Seoul)
    ('sunmoon.ac.kr',   36.7980, 127.0750),  -- Sun Moon University (Asan)
    ('scnu.ac.kr',      34.9740, 127.4800),  -- Sunchon National University (Suncheon)
    ('skku.edu',        37.5876, 126.9930),  -- Sungkyunkwan University (Seoul)
    ('sungshin.ac.kr',  37.5920, 127.0220),  -- Sungshin Women's University (Seoul)
    ('unist.ac.kr',     35.5720, 129.1890),  -- UNIST (Ulsan)
    ('uos.ac.kr',       37.5840, 127.0590),  -- University of Seoul (Seoul)
    ('suwon.ac.kr',     37.2150, 126.9760),  -- University of Suwon (Hwaseong)
    ('ulsan.ac.kr',     35.5430, 129.2570),  -- University of Ulsan
    ('wku.ac.kr',       35.9690, 126.9570),  -- Wonkwang University (Iksan)
    ('wsu.ac.kr',       36.3380, 127.4350),  -- Woosong University (Daejeon)
    ('yu.ac.kr',        35.8330, 128.7560),  -- Yeungnam University (Gyeongsan)
    ('yonsei.ac.kr',    37.5651, 126.9395)   -- Yonsei University (Seoul)
) as c(domain, lat, lng)
where i.primary_domain = c.domain
  and (i.latitude is null or i.longitude is null);
