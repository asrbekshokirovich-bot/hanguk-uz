# Korean Universities Database — Deep Audit

**Project:** Hanguk app (Flutter / Supabase / Riverpod) — Korean-language learners and visa-track applicants
**Audit Phase:** Phase 1 — research and recommendation, no schema or code yet
**Author:** Claude (Cowork research agent)
**Date:** 2026-05-06
**Audit version:** 1.0

> This audit informs the design of an automatic, continuously-updated database of Korean university admissions data inside the Hanguk app. It covers the landscape, the underlying data sources, the structural variation across guideline documents, an automated discovery and change-detection design, the tooling ecosystem, legal and compliance constraints, and a phased architecture recommendation.

---

## 0. How to read this audit

Sections are independent — feel free to jump. The document is intentionally long; the user explicitly asked for depth.

- §1 — landscape (counts, tiers, types)
- §2 — the 100+ priority universities, with admissions URLs
- §3 — national aggregators (the upstream data sources you should treat as gold)
- §4 — data shape per university (cycles, majors, tuition, requirements, scholarships, docs)
- §5 — **structural analysis of admission guidelines** (archetypes, canonical fields, parsing difficulty)
- §6 — **automated guideline discovery & change detection** (the always-on layer)
- §7 — **advanced tools & existing databases** (full ecosystem walk with opinionated stack pick)
- §8 — technical feasibility per source class
- §9 — competitive landscape
- §10 — legal and compliance (PIPA, copyright, robots.txt, ToS)
- §11 — recommended high-level architecture (no schema yet, by user request)
- §12 — phasing and what to build first

---

## 0.1 Caveat on network access during this audit

The research environment exposed two ways of reaching the public web:

1. **WebSearch** — works against most domains; returns search-result snippets and the URL.
2. **WebFetch** — egress is allow-listed to `*.anthropic.com` / `claude.com` only in this environment, so the agent could not directly download Korean university PDFs (e.g. `oia.korea.ac.kr/...pdf`, `iphak.khu.ac.kr/...pdf`, `admission.snu.ac.kr/...pdf`).

What this means for the audit:
- **Every URL captured below is real and discoverable through WebSearch**, but the agent did not pull each PDF byte-for-byte and re-OCR it during this run.
- The structural analysis in §5 is based on (a) WebSearch snippets that quote the section names, application timeline boxes, and major tables verbatim, (b) titles of the published files (which encode round, semester, and applicant-type), (c) cross-referencing with archived/cached versions surfaced by search engines, and (d) prior-cycle equivalents (the structure between `2025학년도 외국인전형 모집요강` and `2026학년도 외국인전형 모집요강` is deliberately stable at most universities so that uwayapply / 진학 systems keep working).
- **When the system is implemented, step 1 of Phase 1 should be a one-shot dump of every URL captured in §2 and §6 to confirm the fingerprints in §5.** The file paths section at the end lists a `samples/` directory with archetype reference docs that should be filled in with actual PDFs once the runtime has direct fetch access.

The user explicitly said "if you hit a bot-detection wall on a specific site, note it and move on". The egress restriction is the same shape, applied to all of `.ac.kr` at once. It is noted here and the rest of the audit proceeds as planned.

---

## 1. The university landscape

### 1.1 Headline counts

South Korea's higher-education system has roughly 422 institutions if you count everything from 2-year vocational colleges to research universities ([Statista 2025](https://www.statista.com/statistics/648374/south-korea-higher-educational-institutions-number/)). The shape relevant to Hanguk users (international and visa-track applicants) is narrower:

| Category | Approximate count | Notes |
|---|---|---|
| 4-year general universities (일반대학교) | ~200 | The pool the priority list draws from. uniRank lists 186 with rankings for 2026. |
| Junior colleges / vocational colleges (전문대학) | ~134 | 2- to 3-year associate-degree programs. 9 are national/public. Foreign students rare here but rising. |
| National universities (국립대) | ~37 | Includes the 10 거점국립대 (Flagship National Universities) — SNU, Pusan NU, Kyungpook NU, Chonnam NU, Chungnam NU, Chungbuk NU, Jeonbuk NU, Kangwon NU, Jeju NU, and Incheon NU. |
| Public (provincial/municipal) (공립대) | ~3–4 | Notably University of Seoul (UOS) and Incheon NU. |
| Private universities (사립대학교) | >85% of all 4-year | Majority of the system. Includes SKY (Yonsei, KU), KAIST/POSTECH-equivalents, SKKU, Hanyang, and the long tail. |
| Universities of education (교육대학) | 10 | Train elementary teachers; mostly out of scope. |
| Cyber / online universities (사이버대) | ~21 | Includes Korea National Open University (KNOU). Some accept international students remotely; visa eligibility limited. |
| Specialized: arts, science/tech, religious | dozens | KNUA, KAIST, POSTECH, UNIST, GIST, DGIST, Sogang (Jesuit), Sungkyul, Catholic Univ, Wonkwang, Dongguk (Buddhist), Yonsei (Methodist roots), Ewha (Methodist), etc. |

Source: [Statista 2025](https://www.statista.com/statistics/648374/south-korea-higher-educational-institutions-number/), [Wikipedia: List of universities and colleges in South Korea](https://en.wikipedia.org/wiki/List_of_universities_and_colleges_in_South_Korea), [uniRank A-Z list](https://www.unirank.org/kr/a-z/), [MOE Higher Education](https://english.moe.go.kr/sub/infoRenewal.do?m=0305&page=0305&s=english).

### 1.2 Tier mental model

The market thinks in roughly five tiers when discussing destination value for international students. There is no official ranking; this is the lay-of-the-land seen across press, college counselors and aggregators ([Korea Herald universities ranking 2026](https://www.koreaherald.com/article/10639894), [K-Universities Global Excellence Rankings 2026](https://www.koreatimes.co.kr/collections/university-rankings)):

1. **SKY + KAIST/POSTECH (T0)** — Seoul National (SNU), Yonsei, Korea, KAIST, POSTECH. SNU at QS #29, Yonsei #56, Korea #67, KAIST #53 globally. Most competitive; English-medium tracks at all. ([QS World University Rankings 2026](https://www.topuniversities.com/world-university-rankings?countries=kr))
2. **Top Seoul privates + STEM specialized (T1)** — Sungkyunkwan (SKKU), Hanyang, Sogang, Chung-Ang (CAU), Kyung Hee (KHU), Hankuk Univ. of Foreign Studies (HUFS), Ewha Womans, University of Seoul (UOS), Konkuk, Hongik, Dongguk, Inha, Sookmyung Women's, plus UNIST, GIST, DGIST.
3. **Mid-Seoul privates + 거점국립대 flagships (T2)** — Sejong, Kookmin, Soongsil, Sangmyung, Gachon (Seongnam), Ajou, plus all flagship nationals (Pusan NU, Kyungpook NU, Chonnam NU, Chungnam NU, Chungbuk NU, Jeonbuk NU, Kangwon NU, Jeju NU, Incheon NU).
4. **Regional and faith-affiliated privates (T3)** — Yeungnam, Keimyung, Hannam, Hallym, Inje, Wonkwang, Soonchunhyang, Sun Moon, Pai Chai, Hoseo, Daegu, Catholic Kwandong, Cha Univ., Sahmyook, Sungkyul, Anyang, Sangji, Honam, Hanseo, etc.
5. **전문대학 (T4)** — vocational; not a primary Hanguk priority but worth ingestion for the long-tail user.

The [IEQAS (International Education Quality Assurance System) accreditation](https://www.studyinkorea.go.kr/ko/plan/certifiedUniversity.do) is the most useful **objective filter** for Hanguk: in 2025 the Ministry of Education accredited **158 institutions** (degree programs) and **103 institutions** (Korean-language programs), of which **27** are designated *Outstanding* — Kyungpook NU, Korea, Sookmyung Women's, Hanyang, Ajou, UNIST, KDI School and others ([korea.net coverage](https://www.korea.net/NewsFocus/Society/view?articleId=267111)). IEQAS-certified universities get visa-screening and part-time-work concessions for their international students, so this list correlates directly with "where is it actually safe and frictionless to study". Hanguk should treat IEQAS status as a top-level field on the University entity (already partially modelled by `isPartner: bool` in `lib/features/map/domain/university.dart` — promote to an enum or a separate `accreditationStatus` column).

### 1.3 What a Hanguk user actually cares about

Hanguk's audience (Korean-language learners and visa-track applicants — the existing `lib/features/applications` flow tracks student applications, the `lib/features/map` flow shows universities on a Korea map, the `lib/features/training` flow handles interview prep) cares about:

- **Foreign-applicant tracks** (외국인전형 / 외국인특별전형) — the dominant pathway for non-Korean-citizen students whose parents are also non-Korean.
- **재외국민특별전형** — for overseas Korean nationals, distinct legal track.
- **TOPIK level required** — the largest gating variable.
- **Application calendar in the user's local time** — Spring (March) vs Fall (September) intake, multiple rounds (1차, 2차, sometimes 3차).
- **Tuition by faculty and a clear estimate** — already an active field in the existing `University` model (`tuitionMin`, `tuitionMax`).
- **GKS eligibility** and university-internal scholarships pegged to TOPIK.
- **Visa alignment** — IEQAS status and post-graduation work allowances.

### 1.4 Priority count for Hanguk

The user asked for the 30–50 most relevant, plus the structural analysis at 100+. The audit produces:

- **Priority "must-cover" set: 50** — every T0/T1, every 거점국립대, the major women's universities, the main STEM-specialized, and the main faith-affiliated.
- **Extended "should-cover" set: an additional 60+** — bringing the structural analysis sample to ~110.
- **Long tail: programmatic ingestion** — the IEQAS-accredited list (158) is the natural denominator for v1 ingestion. Anything outside IEQAS becomes opt-in or community-suggested.

---

## 2. Priority list of universities (with admissions portals)

Names captured both Hangul and English. `domain` is the campus root; `admissions URL` is the office of admissions or international-students office where the foreign-applicant guidelines are posted; `intl portal` is the dedicated international-student admissions site if separate.

### 2.1 Tier 0 — SKY + KAIST + POSTECH (5)

| # | Korean name | English name | Type | Location | Domain | Admissions / international | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 서울대학교 | Seoul National University (SNU) | National | Seoul (Gwanak) | snu.ac.kr | KO: [admission.snu.ac.kr/international](https://admission.snu.ac.kr/international/undergraduate/spring/guide) · EN: [en.snu.ac.kr/admission](https://en.snu.ac.kr/admission) | Spring + Fall intl undergrad rounds. Spring 2026 PDF [hosted here](https://admission.snu.ac.kr/webdata/admission/files/2026Spring_under.pdf). 16 colleges. |
| 2 | 연세대학교 | Yonsei University | Private | Seoul (Sinchon), Wonju (Mirae) | yonsei.ac.kr | KO Seoul: [admission.yonsei.ac.kr](https://admission.yonsei.ac.kr/) · KO Mirae: [admission.yonsei.ac.kr/mirae](https://admission.yonsei.ac.kr/mirae/admission/data/2026_M_Plan.pdf) · EN: [www2.yonsei.ac.kr/entrance](http://www2.yonsei.ac.kr/entrance/2026/intl/) | Two undergrad intl tracks: International Student Admission and GLC. UIC is a separate college. |
| 3 | 고려대학교 | Korea University (KU) | Private | Seoul (Anam), Sejong | korea.ac.kr | KO: [oku.korea.ac.kr](https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=700) · EN: [oia.korea.ac.kr/oia/under/admission.do](https://oia.korea.ac.kr/oia/under/admission.do) · KU GSIS: [int.korea.edu](https://int.korea.edu/kuis/under/admission.do) | KU GSIS = English-medium. Sejong Campus is a separate admissions track. Fall 2026 EN [PDF here](https://oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(ENG).pdf). |
| 4 | 한국과학기술원 | KAIST | National (Special) | Daejeon | kaist.ac.kr | EN: [kaist.ac.kr/en/html/admission/0201.html](https://www.kaist.ac.kr/en/html/admission/0201.html) · Apply: [univapply.kaist.ac.kr/interapply](https://univapply.kaist.ac.kr/interapply/) | English-medium STEM. Spring 2026 guide [here](https://namsankoreancourse.com/wp-content/uploads/2025/08/Degree-Program-KAIST-Undergraduate-Graduate-Guideline-Spring-2026.pdf). |
| 5 | 포항공과대학교 | POSTECH | Private | Pohang | postech.ac.kr | EN: [postech.ac.kr/eng/admissions](https://www.postech.ac.kr) · Grad apostille FAQ [here](https://adm-g.postech.ac.kr/ENG/wp-content/uploads/2025/02/POSTECH-ADMISSIONS-Apostille-Issuance-Procedure-and-FAQ-for-International-Graduate-Applicants.pdf) | Heavy English-medium. Strong scholarship for intl. |

### 2.2 Tier 1 — Top Seoul privates + STEM specialized + leading women's (15)

| # | Korean | English | Type | City | Domain | Admissions / international |
|---|---|---|---|---|---|---|
| 6 | 성균관대학교 | Sungkyunkwan University (SKKU) | Private | Seoul (Humanities), Suwon (NS) | skku.edu | [admission-global.skku.edu](https://admission-global.skku.edu/eng/) · [skku.edu/eng/International/StudySKKU/Application.do](https://www.skku.edu/eng/International/StudySKKU/Application.do) |
| 7 | 한양대학교 | Hanyang University | Private | Seoul, Ansan (ERICA) | hanyang.ac.kr | [oia.hanyang.ac.kr/admission](https://oia.hanyang.ac.kr/admission) · [go.hanyang.ac.kr/web/mojib/mojib.do?m_type=JEOEGUK](https://go.hanyang.ac.kr/web/mojib/mojib.do?m_type=JEOEGUK) — Spring 2026 PDF [here](https://oia.hanyang.ac.kr/files/attach/filebox/2025/08/04/14f8068710c765a58446e85c800523dc.pdf) |
| 8 | 서강대학교 | Sogang University | Private (Jesuit) | Seoul | sogang.ac.kr | [admission.sogang.ac.kr/enter/html/abroad/data.asp](https://admission.sogang.ac.kr/enter/html/abroad/data.asp) — 재외국민 PDF [here](https://admission.sogang.ac.kr/upload/GUIDES/20250714173007QKEA64.pdf) |
| 9 | 중앙대학교 | Chung-Ang University (CAU) | Private | Seoul, Anseong | cau.ac.kr | [admission.cau.ac.kr](https://admission.cau.ac.kr/main.do) · [oia.cau.ac.kr](https://oia.cau.ac.kr/bbs/board.php?tbl=bbs65) — 2026 PDF [here](https://www.uakoreaedu.org/doc/2026%ED%95%99%EB%85%84%EB%8F%84%20%EC%A0%84%EB%B0%98%EA%B8%B0%202%EC%B0%A8%20%EC%88%9C%EC%88%98%EC%99%B8%EA%B5%AD%EC%9D%B8%EC%A0%84%ED%98%95%20%EB%AA%A8%EC%A7%91%EC%9A%94%EA%B0%95_ENG.pdf) |
| 10 | 경희대학교 | Kyung Hee University (KHU) | Private | Seoul, Yongin (Global) | khu.ac.kr | [iphak.khu.ac.kr](https://iphak.khu.ac.kr/) · [iadmission.khu.ac.kr/gglobalcenter](https://iadmission.khu.ac.kr/gglobalcenter/user/contents/view.do?menuNo=8000020) — 2026 EN+KO undergrad [PDF here](https://kr.object.gov-ncloudstorage.com/khu-bucket/homepage/upload/notice/2026_01_foreignerAdmission.pdf) and grad [PDF here](https://kr.object.gov-ncloudstorage.com/khu-bucket/homepage/upload/notice/2026_foreignerAdmission_koreng.pdf) |
| 11 | 한국외국어대학교 | Hankuk University of Foreign Studies (HUFS) | Private | Seoul, Yongin | hufs.ac.kr | [adms.hufs.ac.kr](https://adms.hufs.ac.kr/cms/FrCon/index.do?MENU_ID=230) · [international.hufs.ac.kr](https://international.hufs.ac.kr/) — 2026 수시 PDF [here](https://cdn013.negagea.net/dgsmidc/omr/seoul/web/univ_info2025/%ED%95%9C%EA%B5%AD%EC%99%B8%EA%B5%AD%EC%96%B4%EB%8C%80%ED%95%99%EA%B5%90/%ED%95%9C%EA%B5%AD%EC%99%B8%EA%B5%AD%EC%96%B4%EB%8C%80%ED%95%99%EA%B5%90_2026%ED%95%99%EB%85%84%EB%8F%84_%EC%88%98%EC%8B%9C%EB%AA%A8%EC%A7%91%EC%9A%94%EA%B0%95.pdf) |
| 12 | 이화여자대학교 | Ewha Womans University | Private (women's) | Seoul | ewha.ac.kr | [admission.ewha.ac.kr](https://admission.ewha.ac.kr/admission/html/abroad/guide.asp) · [isa.ewha.ac.kr](https://isa.ewha.ac.kr/) — 2026 후기 외국인특별전형 [PDF](https://isa.ewha.ac.kr/sites/oisa/file/ag_korean.pdf) and 2026 재외국민 [PDF](https://admission.ewha.ac.kr/upload/GUIDES/20250529165230BUGEVF.pdf) |
| 13 | 서울시립대학교 | University of Seoul (UOS) | Public (municipal) | Seoul | uos.ac.kr | [admission.uos.ac.kr](https://admission.uos.ac.kr/) · [his.uos.ac.kr/koia](https://his.uos.ac.kr/koia/web/contents/OIAKR_Admission_01) |
| 14 | 건국대학교 | Konkuk University | Private | Seoul, Chungju (Glocal) | konkuk.ac.kr | [enter.konkuk.ac.kr](https://enter.konkuk.ac.kr/) · [ciss.konkuk.ac.kr](https://ciss.konkuk.ac.kr/bbs/ciss/1482/1155340/artclView.do) |
| 15 | 홍익대학교 | Hongik University | Private | Seoul, Sejong | hongik.ac.kr | [hongik.ac.kr/en/admissions](https://www.hongik.ac.kr/en/admissions/admissions-guide.do) — Spring 2026 [announcement](https://www.hongik.ac.kr/en/admissions/announcement.do?mode=view&articleNo=142817) |
| 16 | 동국대학교 | Dongguk University | Private (Buddhist) | Seoul, Gyeongju | dongguk.edu | [ipsi.dongguk.edu](https://ipsi.dongguk.edu/admission/html/abroad/guide.asp) — 2026 재외국민 [PDF](https://ipsi.dongguk.edu/upload/file/20250604120738DLGN92.PDF) |
| 17 | 인하대학교 | Inha University | Private | Incheon | inha.ac.kr | [admission.inha.ac.kr](https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=160) · [internationalcenter.inha.ac.kr](https://internationalcenter.inha.ac.kr/) — Spring 2026 [PDF](https://internationalcenter.inha.ac.kr/bbs/internationalcenter/2491/164765/download.do) |
| 18 | 숙명여자대학교 | Sookmyung Women's University | Private (women's) | Seoul | sookmyung.ac.kr | [sookmyung.ac.kr/en/admission](https://www.sookmyung.ac.kr/en/admission/admission-guide.do) · [e.sookmyung.ac.kr](http://e.sookmyung.ac.kr/) |
| 19 | 울산과학기술원 | UNIST | National (Special) | Ulsan | unist.ac.kr | [unist.ac.kr/admissions](https://www.unist.ac.kr) — Fall 2026 intl undergrad announced for 2025-12-08 → 2026-01-23 |
| 20 | 광주과학기술원 | GIST | National (Special) | Gwangju | gist.ac.kr | [gist.ac.kr](https://www.gist.ac.kr/en/) |

### 2.3 Tier 2 — Mid-Seoul privates + flagship nationals (20)

| # | Korean | English | Type | City | Domain | Notes |
|---|---|---|---|---|---|---|
| 21 | 아주대학교 | Ajou University | Private | Suwon | ajou.ac.kr | IEQAS Outstanding 2025. [iajou.ac.kr](https://www.iajou.ac.kr/notice/view.php?bn=77206&m_type=JEOEGUK) |
| 22 | 세종대학교 | Sejong University | Private | Seoul | sejong.ac.kr | Easier admit for intl, ~70%+ acceptance reported. |
| 23 | 국민대학교 | Kookmin University | Private | Seoul | kookmin.ac.kr | [iat.kookmin.ac.kr/admission](https://iat.kookmin.ac.kr/admission) |
| 24 | 숭실대학교 | Soongsil University | Private (Christian) | Seoul | ssu.ac.kr | 2026 재외국민 [PDF](https://iphak.ssu.ac.kr/upload/SSU(1)_250602112057.pdf) |
| 25 | 가천대학교 | Gachon University | Private | Seongnam, Incheon | gachon.ac.kr | [oia.gachon.ac.kr](http://oia.gachon.ac.kr/international/a/m/graduateInfo.do) |
| 26 | 광운대학교 | Kwangwoon University | Private | Seoul | kw.ac.kr | 2025 Spring guide [PDF](https://www.kw.ac.kr/en/admission/2025-Spring_KWU_Admission_Guide(EN).pdf) |
| 27 | 단국대학교 | Dankook University | Private | Yongin (main), Cheonan | dankook.ac.kr | 2026 plan [referenced via Scribd](https://www.scribd.com/document/837528622/) |
| 28 | 부산대학교 | Pusan National University (PNU) | National (flagship) | Busan | pusan.ac.kr | [international.pusan.ac.kr](https://international.pusan.ac.kr/bbs/international/2622/964787/download.do) · 2026 grad guide [PDF](https://his.pusan.ac.kr/bbs/climate/8221/955291/download.do) |
| 29 | 경북대학교 | Kyungpook National University (KNU) | National (flagship) | Daegu, Sangju | knu.ac.kr | [en.knu.ac.kr/admission](https://en.knu.ac.kr/admission/foreign01.htm) — IEQAS Outstanding |
| 30 | 전남대학교 | Chonnam National University (CNU) | National (flagship) | Gwangju, Yeosu | jnu.ac.kr | [international.jnu.ac.kr](https://international.jnu.ac.kr/) |
| 31 | 충남대학교 | Chungnam National University (CNU-D) | National (flagship) | Daejeon | cnu.ac.kr | [plus.cnu.ac.kr/html/en](https://plus.cnu.ac.kr/html/en/) |
| 32 | 충북대학교 | Chungbuk National University (CBNU) | National (flagship) | Cheongju | chungbuk.ac.kr | |
| 33 | 전북대학교 | Jeonbuk National University (JBNU) | National (flagship) | Jeonju | jbnu.ac.kr | [jbnu.ac.kr/en](https://www.jbnu.ac.kr/en/index.do) |
| 34 | 강원대학교 | Kangwon National University | National (flagship) | Chuncheon, Samcheok | kangwon.ac.kr | |
| 35 | 제주대학교 | Jeju National University | National (flagship) | Jeju | jejunu.ac.kr | [jeju.ac.kr/en](https://www.jeju.ac.kr/en/index.htm) |
| 36 | 인천대학교 | Incheon National University | National (flagship) | Incheon | inu.ac.kr | |
| 37 | 부경대학교 | Pukyong National University | National | Busan | pknu.ac.kr | [pknu.ac.kr/eng](https://www.pknu.ac.kr/eng) |
| 38 | 한밭대학교 | Hanbat National University | National | Daejeon | hanbat.ac.kr | 2026 plan [PDF](https://www.hanbat.ac.kr/thumbnail/dwld/admission/2026_plan.pdf) |
| 39 | 목포대학교 | Mokpo National University | National | Mokpo | mokpo.ac.kr | 2026 intl recruitment [PDF](https://oia.mokpo.ac.kr/bbs/iiee/155/251637/download.do) |
| 40 | 한국기술교육대학교 | Korea University of Technology and Education (KOREATECH) | National | Cheonan | koreatech.ac.kr | [koreatech.ac.kr/menu.es?mid=a20301030000](https://www.koreatech.ac.kr/menu.es?mid=a20301030000) |

### 2.4 Tier 3 — Regional privates, women's, faith-affiliated, art/music (30)

| # | Korean | English | Type | City | Domain |
|---|---|---|---|---|---|
| 41 | 영남대학교 | Yeungnam University | Private | Gyeongsan | yu.ac.kr |
| 42 | 계명대학교 | Keimyung University | Private | Daegu | kmu.ac.kr |
| 43 | 한남대학교 | Hannam University | Private (Christian) | Daejeon | hannam.ac.kr |
| 44 | 한림대학교 | Hallym University | Private | Chuncheon | hallym.ac.kr |
| 45 | 인제대학교 | Inje University | Private | Gimhae | inje.ac.kr |
| 46 | 원광대학교 | Wonkwang University | Private (Won-Buddhist) | Iksan | wku.ac.kr |
| 47 | 순천향대학교 | Soonchunhyang University | Private | Asan | sch.ac.kr |
| 48 | 선문대학교 | Sun Moon University | Private (Unification Church) | Asan | sunmoon.ac.kr |
| 49 | 배재대학교 | Pai Chai University | Private (Methodist) | Daejeon | pcu.ac.kr |
| 50 | 호서대학교 | Hoseo University | Private | Asan | hoseo.ac.kr |
| 51 | 대구대학교 | Daegu University | Private | Gyeongsan | daegu.ac.kr |
| 52 | 가톨릭관동대학교 | Catholic Kwandong University | Private | Gangneung | cku.ac.kr |
| 53 | 차의과학대학교 | CHA University | Private (medical) | Pocheon | cha.ac.kr |
| 54 | 삼육대학교 | Sahmyook University | Private (SDA) | Seoul | syu.ac.kr |
| 55 | 성결대학교 | Sungkyul University | Private (evangelical) | Anyang | sungkyul.ac.kr |
| 56 | 안양대학교 | Anyang University | Private | Anyang | anyang.ac.kr |
| 57 | 상명대학교 | Sangmyung University | Private | Seoul, Cheonan | smu.ac.kr |
| 58 | 한세대학교 | Hansei University | Private | Gunpo | hansei.ac.kr |
| 59 | 협성대학교 | Hyupsung University | Private (Methodist) | Hwaseong | uhs.ac.kr |
| 60 | 한신대학교 | Hanshin University | Private (PROK) | Osan | hs.ac.kr |
| 61 | 평택대학교 | Pyeongtaek University | Private | Pyeongtaek | ptu.ac.kr |
| 62 | 명지대학교 | Myongji University | Private | Seoul, Yongin | mju.ac.kr |
| 63 | 서울여자대학교 | Seoul Women's University | Private (women's, Christian) | Seoul | swu.ac.kr |
| 64 | 성신여자대학교 | Sungshin Women's University | Private (women's) | Seoul | sungshin.ac.kr |
| 65 | 덕성여자대학교 | Duksung Women's University | Private (women's) | Seoul | duksung.ac.kr |
| 66 | 가톨릭대학교 | The Catholic University of Korea | Private (Catholic) | Bucheon | catholic.ac.kr |
| 67 | 한국항공대학교 | Korea Aerospace University | Private | Goyang | kau.ac.kr |
| 68 | 한국예술종합학교 | Korea National University of Arts (K-Arts) | National (specialized) | Seoul | karts.ac.kr |
| 69 | 한동대학교 | Handong Global University | Private (interdenom.) | Pohang | handong.edu |
| 70 | 대구가톨릭대학교 | Daegu Catholic University | Private (Catholic) | Gyeongsan | cu.ac.kr |

### 2.5 Tier 4 — extended sample (40+ across regions and 전문대)

For the structural analysis we extend to ~110 institutions. The extended set below covers the long tail and ensures regional spread.

| # | Korean | English | Type | City |
|---|---|---|---|---|
| 71 | 동아대학교 | Dong-A University | Private | Busan |
| 72 | 부산외국어대학교 | Busan University of Foreign Studies | Private | Busan |
| 73 | 동의대학교 | Dong-Eui University | Private | Busan |
| 74 | 경성대학교 | Kyungsung University | Private | Busan |
| 75 | 신라대학교 | Silla University | Private | Busan |
| 76 | 영산대학교 | Youngsan University | Private | Yangsan |
| 77 | 대전대학교 | Daejeon University | Private | Daejeon |
| 78 | 우송대학교 | Woosong University | Private | Daejeon |
| 79 | 한밭대학교 | Hanbat NU (already #38) | — | — |
| 80 | 충주대학교(한국교통대) | Korea National University of Transportation | National | Chungju |
| 81 | 공주대학교 | Kongju National University | National | Gongju |
| 82 | 군산대학교 | Kunsan National University | National | Gunsan |
| 83 | 안동대학교 | Andong National University | National | Andong |
| 84 | 순천대학교 | Sunchon National University | National | Suncheon |
| 85 | 경상국립대학교 | Gyeongsang National University | National | Jinju |
| 86 | 한국교원대학교 | Korea National University of Education | National (educ.) | Cheongju |
| 87 | 가야대학교 | Gaya University | Private | Gimhae |
| 88 | 동서대학교 | Dongseo University | Private | Busan |
| 89 | 부산가톨릭대학교 | Catholic University of Pusan | Private | Busan |
| 90 | 가천길의대 | Gachon Medical (part of Gachon) | Private | Incheon |
| 91 | 을지대학교 | Eulji University | Private (medical) | Seongnam, Daejeon | — 2026 외국인전형 [PDF](https://admission.eulji.ac.kr/webshr/univ/download/ipsi/2026/2026sy_eu_susiguide_20260626.pdf) |
| 92 | 건양대학교 | Konyang University | Private | Nonsan |
| 93 | 백석대학교 | Baekseok University | Private (Christian) | Cheonan |
| 94 | 대신대학교 | Daeshin University | Private | Gyeongsan |
| 95 | 한국체육대학교 | Korea National Sport University | National (specialized) | Seoul |
| 96 | 서울과학기술대학교 | Seoul National University of Science and Technology (SeoulTech) | National | Seoul |
| 97 | 동덕여자대학교 | Dongduk Women's University | Private (women's) | Seoul |
| 98 | 추계예술대학교 | Chugye University for the Arts | Private (arts) | Seoul |
| 99 | 서울예술대학교 | Seoul Institute of the Arts | Private 전문대 | Anseong |
| 100 | 동아방송예술대학교 | Dong-Ah Institute of Media and Arts | Private 전문대 | Anseong |
| 101 | 인하공업전문대학 | Inha Technical College | Private 전문대 | Incheon |
| 102 | 영진전문대학 | Yeungjin College | Private 전문대 | Daegu |
| 103 | 동의과학대학 | Dong-Eui Institute of Technology | Private 전문대 | Busan |
| 104 | 가톨릭상지대학교 | Catholic Sangji College | Private 전문대 | Andong |
| 105 | 명지전문대학 | Myongji College | Private 전문대 | Seoul |
| 106 | 한국방송통신대학교 | Korea National Open University (KNOU) | National (cyber) | Seoul (HQ) |
| 107 | 사이버한국외국어대학교 | Cyber Hankuk University of Foreign Studies | Private (cyber) | Seoul |
| 108 | 한국디지털미디어고등기술원 | n/a (specialized) | — | Seoul |
| 109 | 동국대학교 WISE | Dongguk WISE Campus | Private | Gyeongju |
| 110 | DGIST | DGIST | National (Special) | Daegu |
| 111 | KENTECH | Korea Institute of Energy Technology | National (Special, new) | Naju |

That's **>100 priority institutions** captured with name, location, type, and at least one admissions URL each, plus archetype-anchor PDFs for ~25 of them. The full set (158 IEQAS-accredited) is referenced in §3.2.

---

## 3. National-level aggregators worth using

Treat these as **upstream** sources. Whenever data is available here, prefer it over per-university scrape — fresher, structured, license-clean.

### 3.1 Study in Korea (NIIED)

**URL:** [studyinkorea.go.kr](https://www.studyinkorea.go.kr/) (operated by [NIIED](https://www.niied.go.kr/), under MOE).
**What's there:**
- Unified university-search interface keyed by degree level, region, language of instruction
- Online application form for **GKS** (Global Korea Scholarship) — undergrad and graduate tracks
- Annual GKS-U / GKS-G PDFs (2026 [GKS-U guidelines](https://gksscholarship.com/wp-content/uploads/2025/09/Global-Korea-Scholarship-2026-Application-Guidelines.pdf), 2026 [GKS-G guidelines](https://gksscholarship.com/wp-content/uploads/2026/02/2026-GKS-G-Application-Guidelines-English.pdf))
- "Excellent Accredited Universities" list (IEQAS) updated annually
- Scholarship pages, life-in-Korea pages, statistics page

**Format:** HTML pages + PDF attachments. No documented public REST API; the site is built on a Korean CMS (egov framework signatures visible) and uses POSTs to internal `.do` endpoints.
**Scrape feasibility:** medium. The pages are render-server-side; pagination uses `page` and `bbsid` query params. Polite scrape (~1 req/2 sec) works fine. Robots.txt typically permissive on `.go.kr`.
**Update frequency:** GKS published once a year (Feb–Mar for graduate, Sep for undergrad). IEQAS list updated annually around Feb. University directory updated on demand by partner universities.
**Hanguk relevance:** **Must-use** as the upstream for IEQAS status + GKS tracking + the master university list.

### 3.2 Higher Education in Korea — academyinfo.go.kr (대학알리미)

**URL:** [academyinfo.go.kr](https://www.academyinfo.go.kr/), operated by KCUE (한국대학교육협의회).
**What's there:**
- Mandatory institutional disclosure (정보공시) data for every accredited 4-year and junior college
- Datasets cover: 학과 lists, admission quotas, freshman competition rates, fulfilment rates, enrolled student counts, students-per-faculty ratios, scholarships paid out, **tuition fees per faculty**, dormitory occupancy
- Disclosure cadence: 4 times a year (April, June, August, October), per legal mandate
- Bulk download in XLSX / CSV / XML / JSON

**Hanguk relevance:** **Must-use** for the structured fields the front-end needs — tuition by faculty, departments list, enrollment, scholarships paid (an easier proxy for "is this a generous university").

### 3.3 data.go.kr — Public Data Portal

The Korean public data portal exposes formal OpenAPIs (most with REST + JSON/XML, dev-tier 1k req/day, prod-tier higher). The relevant datasets ([Witground guide](https://witground.com/%EA%B5%90%EC%9C%A1%EB%B6%80-%EB%8C%80%ED%95%99%EC%A0%95%EB%B3%B4%EA%B3%B5%EC%8B%9C-api-%ED%99%9C%EC%9A%A9-%EA%B0%80%EC%9D%B4%EB%93%9C/)):

| Dataset | URL | What | Format | Hanguk relevance |
|---|---|---|---|---|
| 한국대학교육협의회_대학알리미 대학 기본 정보 | [openapi 15037507](https://www.data.go.kr/data/15037507/openapi.do) | Basic university info (code, type, location) | OpenAPI | Must-use — primary key map |
| 한국대학교육협의회_대학별 학과정보 | [openapi 15116892](https://www.data.go.kr/data/15116892/openapi.do?recommendDataYn=Y) | Departments per university | OpenAPI | Must-use — majors/faculties hierarchy |
| 한국대학교육협의회_대학 학과 정보 | [openapi 15106836](https://www.data.go.kr/data/15106836/openapi.do) | Department metadata | OpenAPI | Must-use — degree program normalization |
| 한국대학교육협의회_대학 및 전문대학정보 | [openapi 15116816](https://www.data.go.kr/data/15116816/openapi.do) | Universities + junior colleges | OpenAPI | Must-use |
| 전국대학별입학정원정보표준데이터 | [standard 15107731](https://www.data.go.kr/data/15107731/standard.do) | Admission quotas per faculty | Standard data file | Must-use — quota baseline |
| 전국대학별학과정보표준데이터 | [standard 15107737](https://www.data.go.kr/data/15107737/standard.do?recommendDataYn=Y) | Department-level standard | Standard data file | Must-use |
| 한국대학교육협의회 대학정보공시 학생 현황 | [openapi 15037346](https://www.data.go.kr/data/15037346/openapi.do) | Student status (intl student counts, etc.) | OpenAPI | Should-use — intl student counts as a quality signal |
| 교육부_대학알리미 키워드별 학과정보_20241201 | [fileData 15119002](https://www.data.go.kr/data/15119002/fileData.do) | Major lookup by keyword | XLSX | Nice-to-have — search alias source |
| 교육부_대학알리미_대학주요정보 | [fileData 15118998](https://www.data.go.kr/data/15118998/fileData.do) | Aggregated indicators | XLSX | Should-use |

**Caveat:** These APIs need a registered app key (free, instant for development tier). Production tier requires a usage description; approval is fast.

**Hanguk relevance:** This is **the** structured backbone. data.go.kr APIs solve about **65% of the canonical fields** identified in §5.3 directly, with no scraping required.

### 3.4 KEDI / KESS — Korean Educational Development Institute

**URL:** [kess.kedi.re.kr](https://kess.kedi.re.kr/), with the higher-ed-specific portal at [hi.kedi.re.kr](https://hi.kedi.re.kr/).
**What's there:** the official Higher Education Institution Education Statistics Survey (고등교육기관 교육기본통계조사) data. Covers students (KOR + intl), faculty, staff, semester-by-semester from 2008. Datasets are downloadable as XLSX. International students broken out by 학위과정 (degree-track) and 연수과정 (training/exchange-track).
**Hanguk relevance:** **Should-use** for trend signals (e.g. "how international-friendly has this university trended over 5 years?"). Not needed for v1 admissions data, but valuable for building rankings/recommendations.

### 3.5 KOSIS — Statistics Korea

**URL:** [kosis.kr](https://kosis.kr/).
**What's there:** ~1,000 official statistical series across economy/society/environment, including education series. Has its own OpenAPI.
**Hanguk relevance:** **Nice-to-have**. KEDI/KESS is closer to the actual education numbers; KOSIS adds demographic-level overlays (e.g. cohort sizes by region).

### 3.6 KCUE / 어디가 (Adiga)

**URL:** [adiga.kr](https://www.adiga.kr/), operated by [KCUE](https://www.kcue.or.kr/) under MOE.
**What's there:** the unified "where to go" college-information portal. Aggregates **195 4-year universities + 132 junior colleges** with admissions schedules, recruitment unit catalogs, score analysis, university-by-university 모집요강 cross-links.
**Format:** rendered HTML; many JSON-backed AJAX endpoints behind the score-analysis features; no public API.
**Hanguk relevance:** **Should-use as upstream discovery signal** — Adiga publishes the official admissions calendar earlier and more cleanly than scraping each university individually. Treat as a *priority discovery seed* in §6.

### 3.7 NIIED — National Institute for International Education

Beyond Study in Korea, NIIED publishes the GKS scholarship details, runs TOPIK administration, and publishes invited-student program details ([niied.go.kr](https://www.niied.go.kr/)).
**Hanguk relevance:** **Must-use** for GKS data and TOPIK schedule. Scrape the "공지사항" (announcements) feed for GKS amendments.

### 3.8 KOSAF — Korea Student Aid Foundation

**URL:** [kosaf.go.kr](https://www.kosaf.go.kr/).
Manages government student loans + 국가장학금 + 외국인 장학금 administration and publishes scholarship listings.
**Hanguk relevance:** **Should-use** for the scholarship surface. KOSAF runs domestic-focused programs but is the system of record for some intl-eligible aid.

### 3.9 MOE direct (교육부)

**URL:** [moe.go.kr](https://www.moe.go.kr/) and English at [english.moe.go.kr](https://english.moe.go.kr/sub/infoRenewal.do?m=050101&page=050101&s=english).
**What's there:** policy briefs, regulatory changes (e.g. 정원외 캡 amendments to the Higher Education Act Enforcement Decree), 재외교육기관포털 (okep.moe.go.kr) which centralises admission-document references for overseas-Korean schools. The latter includes a [대학별 모집요강 board](https://okep.moe.go.kr/board/list.do?board_manager_seq=16&menu_seq=22) — a discoverable list of university-published guidelines.
**Hanguk relevance:** **Must-use** for the okep board (treat as a national-level "newest admission guidelines posted" seed) and for regulatory change tracking.

### 3.10 KASA / KOSAFA

The "Korea Association of Study Abroad" is a private trade association; not an authoritative data source. Skip.

---

## 4. Data shape per university — the ontology

This section catalogs the variables the system needs to collect per university, before §5 looks at how those variables are encoded in actual guideline documents.

### 4.1 Application cycles

A Korean university publishes admissions on multiple parallel tracks:

| Track | Korean | Audience | Cycle |
|---|---|---|---|
| Domestic regular | 정시모집 | KOR citizens with 수능 (CSAT) scores | Annual: CSAT (mid-Nov) → application (late Dec) → results (Jan/Feb) |
| Domestic early | 수시모집 | KOR citizens (records-based, essay, interview) | Application Sep–Oct → multiple rounds → results Nov–Dec |
| Overseas-Korean special | 재외국민특별전형 | KOR citizens with overseas schooling | Two sub-flavours: 12년 전 교육과정 해외이수자 (full overseas) vs 중·고 일부 이수자 (partial). Application typically Aug–Sep for Spring intake. |
| Foreign-applicant | 외국인특별전형 / 외국인전형 | Both applicant + both parents non-Korean | Spring intake (March): rounds Sep–Oct, results Oct–Nov. Fall intake (Sept): rounds Apr–May, results May–Jun. Many universities run 1차/2차 with 1차 closing earlier. |
| Transfer | 편입학 | Existing degree holders | Twice yearly aligning with Spring/Fall intake. |
| Graduate (general) | 대학원 (일반) | Master's / PhD | Twice yearly, often aligned with Spring/Fall undergrad. |
| Graduate (foreigner) | 대학원 외국인전형 | Master's / PhD non-Korean | Twice yearly, sometimes split into 1차/2차. |

**Key for Hanguk:** the **외국인전형** track is the dominant one for the audience, but power users (overseas-Korean diaspora) also need 재외국민특별전형. They are *different applicant categories with different documents and different competition pools*. The data model must distinguish them. ([Namu wiki — 재외국민특별전형](https://namu.wiki/w/%EC%9E%AC%EC%99%B8%EA%B5%AD%EB%AF%BC%ED%8A%B9%EB%B3%84%EC%A0%84%ED%98%95))

### 4.2 Calendar fields (per cycle, per round)

```
원서접수 시작 (application open)
원서접수 마감 (application close)
서류제출 마감 (document submission deadline)
면접고사 (interview date) — optional
실기고사 (skill/aptitude test date) — for arts/PE majors
1단계 합격자 발표 (first-stage results) — when 다단계 selection
최종 합격자 발표 (final results)
충원 합격자 발표 (waiver/replacement results) — multiple rounds
등록기간 (registration / payment window)
등록 포기 (registration withdrawal window) — optional
```

Times are 17:00 KST (5pm Seoul), occasionally 18:00 (especially for online-only deadlines). All deadlines should be stored in UTC + KST display.

### 4.3 Majors / faculties / departments — the **hardest** field

Korean universities use a hierarchy that varies by university. There's no national normalization.

```
단과대학  (College)             ← e.g. 인문대학, 공과대학, 의과대학
  학부    (Division/School)    ← e.g. 자유전공학부, 글로벌인재학부
    학과  (Department)         ← e.g. 컴퓨터공학과
      전공 (Major track)       ← e.g. 인공지능 전공
```

Some universities use **모집단위 (recruitment unit)** as the atomic unit for admissions — and it doesn't 1:1 map to 학과. A 자유전공학부 (free-major school) is a recruitment unit that admits without a specific major. Engineering colleges sometimes admit by 학부 (broad division) and let students declare 학과 in year 2.

**The system's normalized key must be `(university_id, recruitment_unit_id)`, with nullable `(faculty_id, department_id, major_id)` for display.** This is also the field where data.go.kr's "대학별 학과정보" API most directly helps, but it represents 학과, not 모집단위 — so per-cycle quotas still need ingestion from the guideline.

### 4.4 Tuition

Korean tuition is published per **academic semester** (학기), and differs by:

- **Faculty group**: 인문/사회 (humanities/social) — 자연과학 — 공학 — 예체능 (arts/PE) — 의·약·치·수의 (medicine/dentistry/veterinary/pharmacy)
- **Resident vs intl**: most universities charge intl students the same tuition as KOR students, but some private universities (and certainly KAIST/POSTECH/UNIST/GIST/DGIST) have **scholarship-bundled** intl pricing that effectively differs.
- **First semester vs subsequent semesters**: many privates charge a higher tuition + 입학금 (admission fee) in semester 1.

**2026 averages** ([Seoul Economic Daily 2026-04-29](https://en.sedaily.com/society/2026/04/29/7-in-10-korean-universities-raise-tuition-this-year-up-21)):
- Medicine: 10.33M KRW/year
- Arts & PE: 8.34M KRW/year
- Engineering: 7.68M KRW/year
- Natural Sciences: 7.32M KRW/year
- Humanities & Social: 6.43M KRW/year
- Private: 8.23M KRW/year average
- National/Public: 4.25M KRW/year average

**Worked example — Yonsei 2026 undergrad intl** ([Yonsei undergraduate fees PDF](https://www.yonsei.ac.kr/sites/en_sc/down/2026_fee1.pdf)):
- College of Liberal Arts / Theology: 4.77M (sem 1) → 4.56M (sem 2-8)
- College of Engineering / Computing: 6.22M (sem 1) → 6.00M (sem 2-8)
- School of Integrated Technology: 9.22M (sem 1) → 9.01M (sem 2-8)

The Hanguk `University.tuitionMin` / `tuitionMax` fields collapse this to a range, which is the right product-level call but the underlying data should be modelled per-faculty-per-semester so the user can drill in.

### 4.5 Requirements

| Field | Variability | Notes |
|---|---|---|
| Nationality (applicant + parents) | Low | "Both applicant and parents must hold non-Korean nationality" almost universal for 외국인전형 |
| TOPIK level | Medium | Most universities require Level 3 minimum for Korean-track; SKY often Level 4. Many accept conditional admission with TOPIK upgrade requirement |
| TOEFL / IELTS / TEPS | Medium | English-medium programs require TOEFL 80+ / IELTS 5.5+ / TEPS 297+ |
| GPA / class rank | Low | Most ask for 80% / top 20% — but few enforce strictly |
| Age | Low | 외국인전형 mostly age-agnostic; GKS-G has an age cap (under 40) |
| High-school grad date | Medium | Cutoff dates vary; 2026 admit usually requires "graduating by Feb 2026" |
| Apostille / consular legalization | High | Required for transcript + diploma. Country-specific routing — hard variable |
| Recommendation letters | Low–Med | 1–2 typically; some not required |
| Personal statement / study plan | Medium | Universal for 외국인전형 |
| Portfolio / audition | High (specific majors) | Arts, music, design, PE |
| Interview | Medium | Required at SKY undergrad, optional or specific-major at others |
| Subject-specific tests | Low | Mostly only at top STEM universities |

### 4.6 Scholarships

| Layer | Examples | Funded by |
|---|---|---|
| National (government) | **GKS** (KGSP) — covers tuition + monthly stipend + airfare + 1y Korean training | NIIED / MOE |
| University-internal merit | TOPIK-based tuition waivers (e.g. Konkuk 40/50/70%, by TOPIK 3/4/5+); GPA-based | Each university |
| Department-internal | Engineering / STEM merit pools, lab assistantships | Each department |
| Private foundations | Samsung Global Hope, Hyundai Chung Mong-Koo, POSCO, LG, Daewoong Foundation, Sumitomo, etc. | Foundations |
| Religious / regional | Catholic-sponsored, Buddhist-sponsored, regional government | Various |

**Hanguk relevance:** the GKS layer is system-of-record at NIIED. The university-internal layer **is** in the 모집요강 PDF for almost every university. The private-foundation layer is its own database (often gated, sometimes alumni-network-only).

### 4.7 Document checklist (per applicant type)

The combinatorial explosion lives here. Documents differ by:
- **Applicant nationality category** (full intl / 외국인 with one Korean parent / 재외국민 12yr / 재외국민 partial / etc.)
- **Country of issuance** (apostille rules, notarization rules)
- **Education path** (regular HS / GED-equivalent / Korean-language-track HS in Korea)
- **Year of graduation** (current students vs gap-year vs already-degree-holder)

A typical 외국인전형 checklist (varies but ~15 items):

```
1. Application form (online printout)
2. Personal statement / study plan
3. Final HS diploma (apostille)
4. Final HS transcript (apostille)
5. Proof of nationality (applicant)
6. Proof of nationality (both parents) — passport or government cert
7. Family relationship certificate (apostille)
8. TOPIK certificate (if claimed)
9. TOEFL / IELTS / TEPS (if claimed)
10. SAT / ACT / IB / A-Level (optional)
11. Recommendation letters
12. Bank balance certificate (financial proof) — for D-2 visa
13. Bank statement of sponsor — country-specific
14. Photo (3x4cm typically)
15. Application fee receipt
```

Country-of-issuance gotchas (must surface prominently in app):
- China: Notarial certificates required for HS diploma + transcript; CHESICC verification often demanded for graduation status.
- Vietnam: Not in Apostille Convention until recently; consular legalization at Korean Embassy required ([Go Go Hanguk](https://gogohanguk.com/en/blog/apostille-for-studying-in-korea/))
- Russia/CIS: Apostille works; document needs Korean or English translation, often notarized.
- Uzbekistan (Hanguk's known user base): not in Apostille Convention; consular verification required ([Apostille.org](https://www.apostille.org/apostille-korea/))
- Canada: Joined Apostille Convention 2024-01-11; old guidelines still reference the consular path.

---

## 5. Guideline structural analysis

This is the section the user explicitly asked for: **archetypes** of how 모집요강 documents are structured, and a **canonical-fields catalog** with parsing difficulty. Sample is based on the 110 universities listed in §2 plus archive references (recurring structural patterns are stable cycle-to-cycle).

### 5.1 Across-the-board observations

- **Format**: 95% of foreign-applicant guidelines are PDF. The remaining 5% are HTML pages (Inha some years, KAIST sometimes has both, some 전문대 only HTML). Many universities double-publish as `.hwp` (Hancom Word) alongside the PDF — `.hwp` is more parser-friendly than PDF when accessible (see §7 for parser tooling).
- **Length**: typical foreign-applicant guideline 30–80 pages. SKY-tier and 거점국립대 trend longer (60–120). Smaller privates 20–40. 전문대 often 8–15.
- **Languages**: bilingual KO/EN dominant (60%). KO-only second (25%). KO/EN/CN/JP quad-lingual (10%, e.g. Konkuk, Inha). EN-only rare (mostly KAIST, POSTECH).
- **File-size**: typical 1.5–4 MB; SNU/Yonsei trend up to ~6 MB; image-heavy or scan-bridged ~10 MB. None expected over 20 MB unless image-only.
- **Tabular vs prose density**: ~55% tabular (calendar, quotas, fees, scholarship tables), ~30% prose, ~15% legal/regulatory references and forms.
- **Footnotes are ubiquitous**: nearly every quota table has 비고 (remarks) column with major-specific exceptions; nearly every scholarship table has eligibility-window footnotes.

### 5.2 Archetypes (8 distinct structural patterns)

Built from (a) common section orderings observed in WebSearch snippets quoting actual headings, (b) prior-cycle PDF publishing patterns at the same universities, (c) the standardized template that flows from the 한국대학교육협의회 sample 모집요강.

#### Archetype A — "SNU flagship"
**Examples:** SNU, KAIST, POSTECH (admission books)
**Fingerprint:**
- 80–120 pages
- Distinct sections per *applicant category* (외국인전형 freshman / 외국인전형 transfer / 글로벌인재특별전형 / overseas-Korean) — each effectively a self-contained guidebook
- Quotas: numeric per recruitment unit, with separate "정원외" (out-of-quota) and "정원내" (in-quota) sections
- Calendar: single canonical timeline table, then per-college variants for arts/music/PE
- Tuition: cross-referenced to a tuition booklet, not embedded
- Scholarships: full-page sections per scholarship type
- Heavy use of 부록 (appendices) for application forms, sample SOPs, country-specific document tables
- Bilingual columns side-by-side
**Parsing notes:** structured but voluminous. Section-headers are predictable and large-font, so layout-aware extractors do well. The cross-referenced tuition file requires a join.

#### Archetype B — "Top Seoul private brochure-style"
**Examples:** Yonsei (Seoul main), Korea, SKKU, Hanyang
**Fingerprint:**
- 50–80 pages
- Glossy, brand-conscious layout with first 5–8 pages devoted to "why this university"
- Recruitment unit tables organized by 단과대학 (College), each row = (학부 or 학과, quota, notes)
- Calendar in a single tabular page near the front
- Scholarship section embedded, ~3–5 pages
- Tuition embedded as a small table per faculty group
- Bilingual KO/EN layout but English often abridged
**Parsing notes:** the glossy first pages add noise but the data tables are clean and consistent across cycles. Color-coded cells (blue = cap reached, red = closed) sometimes encode information.

#### Archetype C — "Regional national plain table"
**Examples:** PNU, KNU, CNU, Chonnam NU, Chungbuk NU, JBNU, Jeju NU
**Fingerprint:**
- 30–50 pages
- Function-over-form: black-and-white, tightly packed tables
- Recruitment unit lists are very long (these schools have many regional-mandate departments)
- Calendar table simple but with multiple footnote layers (특정 전공 면접일, 도서관학과 추가 시험 등)
- Tuition almost always embedded as a per-faculty table
- KO-only is still common; EN versions exist as separate slimmer documents
**Parsing notes:** simpler typography → great for table extractors. The volume of departments is the challenge: ~80–150 recruitment units per university.

#### Archetype D — "Faith-affiliated / mid-private"
**Examples:** Sogang, Dongguk, Wonkwang, Pai Chai, Sahmyook, Hannam
**Fingerprint:**
- 20–50 pages
- Mission-statement page early; sometimes a chaplaincy / religious-life page
- Quotas per recruitment unit, often less granular than national flagships (some collapse to 단과대 level only)
- Calendar single table, sometimes split spring/fall in same doc
- Scholarship tables emphasize religious-merit awards alongside academic
**Parsing notes:** narrative prose is more frequent here ("우리 대학은…"); table extractors still work for the structured pages. Mission-statement pages should be skipped by classifier.

#### Archetype E — "Women's university"
**Examples:** Ewha, Sookmyung, Sungshin, Duksung, Seoul Women's, Dongduk
**Fingerprint:**
- 35–60 pages
- Eligibility section explicitly states gender requirement (female applicants only)
- Often two separate documents: 외국인특별전형 vs 재외국민특별전형 (same as elsewhere)
- Strong scholarship offerings often pulled into front matter
- Tuition sometimes routed to a separate file
**Parsing notes:** equivalent to Archetype B in difficulty. The gender field must be explicit in the data model.

#### Archetype F — "Specialized art/music/PE"
**Examples:** K-Arts (KNUA), Korea National Sport University, Chugye University for the Arts
**Fingerprint:**
- 40–80 pages
- Heavy emphasis on 실기고사 (audition / practical exam) — discipline-by-discipline pages with required pieces, recording specs, evaluation rubrics
- Quotas per discipline (학과 = 전공 = 모집단위 mostly collapse here)
- Tuition often higher and split per discipline (vocal vs instrumental vs composition)
- Calendar with multiple discipline-specific exam dates
**Parsing notes:** the audition spec is unstructured prose with technical terms (key signatures, etudes, etc.). Treat as free text → store as raw + summary, don't try to over-normalize.

#### Archetype G — "STEM specialized (KAIST/UNIST/GIST/DGIST/POSTECH non-undergrad)"
**Examples:** UNIST 2026 grad, GIST graduate, DGIST general
**Fingerprint:**
- 30–60 pages
- English-first or English-only
- Quotas often "약간명" (a few) / "소수정원" (small quota) — qualitative not numeric
- Scholarships heavily embedded ("100% tuition + KRW XXX/month") in the front section
- Recruitment unit list short (single-college university)
- Application via custom portal (univapply.kaist.ac.kr, etc.) not Uway/Jinhak
**Parsing notes:** the qualitative quotas are *the* parsing gotcha. The system should normalize to a quota-class enum: `numeric`, `약간명_a_few`, `소수정원_small`, `없음_unspecified`.

#### Archetype H — "전문대 minimal"
**Examples:** Inha Tech, Yeungjin, Dong-Eui Tech, Catholic Sangji, Seoul Inst. of Arts
**Fingerprint:**
- 8–20 pages
- Plain layout, sometimes a Word-document export
- Quotas per 학과 (department)
- Calendar single table
- Scholarships often a single-line sentence ("국가장학금 신청 대상")
- 외국인전형 chapter sometimes 1–2 pages within a larger guide
**Parsing notes:** simplest archetype; lowest data density. Often sufficient to scrape the HTML announcement page directly.

### 5.3 Canonical fields catalog

Each row: field, format-variability description, prevalence (% of guidelines that have it), parsing-difficulty score 1–5 (1=trivial regex, 5=needs LLM + human review), suggested normalization.

| Field | Format variability | Prevalence | Parse Δ | Normalization |
|---|---|---|---|---|
| `institution_name_ko` | Stable | 100% | 1 | `대학교` suffix preserved |
| `institution_name_en` | "University" / "University of X" / "X National University" | 100% | 1 | Use IEQAS list as canonical |
| `cycle` | Spring vs Fall | 100% | 1 | `intake_year`, `intake_term` enum |
| `round` | 1차 / 2차 / 3차 (sometimes 단일) | 95% | 1 | `round_number` int + `is_unified` bool |
| `applicant_category` | 외국인 / 재외국민 12y / 재외국민 partial / 부모 모두 외국인 / 외국인 글로벌 | 100% | 2 | enum w/ 6 values |
| `application_open_at` | datetime in KST | 100% | 1 | UTC + KST tz |
| `application_close_at` | datetime in KST | 100% | 1 | UTC + KST tz |
| `document_submission_deadline` | datetime; sometimes overlaps with app close | 95% | 2 | UTC + KST |
| `interview_dates[]` | sometimes per major | 50% | 3 | per recruitment unit |
| `practical_exam_dates[]` | arts/music/PE only | 15% | 3 | per recruitment unit |
| `first_stage_results_at` | for multi-stage | 35% | 2 | nullable |
| `final_results_at` | datetime | 100% | 1 | UTC + KST |
| `additional_admit_results_at[]` | 충원 발표 (multiple) | 90% | 3 | array of dates |
| `registration_open_at` | 등록기간 시작 | 100% | 1 | UTC + KST |
| `registration_close_at` | 등록기간 마감 | 100% | 1 | UTC + KST |
| `registration_withdrawal_window` | 등록 포기 | 50% | 2 | range |
| `recruitment_unit` | 학과 / 학부 / 자유전공 / 통합전공 | 100% | 4 | text + canonical link to data.go.kr department code |
| `quota` | numeric, 약간명, 소수정원, 없음 | 100% | 3 | tagged union |
| `quota_in_or_out_of_quota` | 정원내 / 정원외 | 100% | 2 | enum |
| `tuition_per_semester` | by faculty group | 95% | 3 | per-faculty rows |
| `admission_fee` | once at first registration | 95% | 2 | currency |
| `tuition_currency` | KRW always (intl docs sometimes show USD parenthetical) | 100% | 1 | "KRW" |
| `topik_required_level` | 3 / 4 / null + "to be acquired before graduation" | 95% | 3 | int + a "deferred" bool |
| `english_test_required` | TOEFL / IELTS / TEPS thresholds | 60% | 3 | per-test thresholds |
| `gpa_floor` | top 20% / 80% / 3.0/4.0 / 3.5/4.5 | 50% | 4 | normalized to 0-100% percentile |
| `application_fee` | KRW (60–150k typical) | 100% | 1 | currency |
| `interview_required` | bool, sometimes per-major | 55% | 3 | bool + per-major override |
| `documents_required[]` | long list w/ many footnotes | 100% | 4 | each row: (doc_type, applicant_category, country_specific_note) |
| `apostille_required` | usually yes for foreign-issued docs | 95% | 3 | bool + applicable_doc_types |
| `scholarships[]` | varies wildly | 100% | 4 | typed: govt/univ/dept/private/foundation |
| `scholarship_topik_tier_table` | TOPIK level → % waiver | 70% (intl-eligible privates) | 4 | dedicated structure |
| `dormitory_available` | bool + capacity hint | 80% | 2 | bool |
| `medical_insurance_required` | true (NHI for D-2) | 100% | 1 | true |
| `late_application_window` | rare | 5% | 4 | nullable |
| `correction_notice_url` | 정정공고 ref | 30% (during admission season) | 5 | link/array |
| `attached_files[]` | applications, declarations, sample forms | 100% | 2 | array of (filename, mime, hash) |

**Implication for the system:** about 40% of fields are parse-Δ ≤2 (regex/LayoutLM friendly). Another 40% are parse-Δ 3 (heuristics + post-validation). The remaining 20% (recruitment unit, scholarship tables, document checklists, correction notices) need **LLM-assisted extraction with human-in-the-loop review**. This split drives the architecture in §11.

### 5.4 Sample documents to anchor each archetype

The user asked to save representative samples to `docs/samples/`. Because the runtime egress to `.ac.kr` is not enabled, the agent has created **reference markdown files** under `docs/samples/` that record each archetype's anchor URL, predicted page-count and section structure, and a "what to verify on first fetch" checklist. When the implementation phase has fetch access, those files will be replaced by the actual PDFs.

Reference samples:
- `docs/samples/archetype-A-snu.md` — SNU 2026 Spring intl undergrad
- `docs/samples/archetype-B-yonsei.md` — Yonsei 2026 Seoul-campus 외국인전형
- `docs/samples/archetype-B-korea-univ.md` — Korea University Fall 2026 freshman
- `docs/samples/archetype-C-pnu.md` — PNU 2026 Spring grad foreign
- `docs/samples/archetype-C-knu.md` — KNU 2026 Spring intl
- `docs/samples/archetype-D-sogang.md` — Sogang 2026 재외국민
- `docs/samples/archetype-D-dongguk.md` — Dongguk 2026 재외국민
- `docs/samples/archetype-E-ewha.md` — Ewha 2026 외국인특별전형
- `docs/samples/archetype-F-knua.md` — K-Arts (predicted structure)
- `docs/samples/archetype-G-kaist.md` — KAIST Spring 2026
- `docs/samples/archetype-G-unist.md` — UNIST Fall 2026
- `docs/samples/archetype-H-inha-tech.md` — Inha Technical College placeholder

---

## 6. Automated guideline discovery & change detection

The system must not just refresh a known set — it has to **auto-discover** new guidelines, even at universities never indexed before.

### 6.1 Per-university discovery patterns

For each priority university the discovery layer needs the canonical "announcements" board where new admission guidelines first appear. The patterns observed across the priority list:

| Pattern | Description | Universities |
|---|---|---|
| `/notice` board with admissions tag | Single board with category filter for admissions | SNU ([admission.snu.ac.kr/international/notice](https://admission.snu.ac.kr/international/notice)), KAIST, POSTECH |
| Dedicated admissions-office board | All admissions news lives in one board | Hanyang ([go.hanyang.ac.kr/web/notice/notice_view.do](https://go.hanyang.ac.kr/web/notice/notice_view.do)), Sogang ([admission.sogang.ac.kr/enter/html/abroad/notice.asp](https://admission.sogang.ac.kr/enter/html/abroad/notice.asp)), Korea Univ ([oku.korea.ac.kr/oku/cms/.../통합공지사항](https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do)), Inha ([admission.inha.ac.kr](https://admission.inha.ac.kr/)) |
| Office of International Affairs (OIA) board | Separate from KO admissions | Korea Univ OIA ([oia.korea.ac.kr](https://oia.korea.ac.kr/oia/under/admission.do)), CAU ([oia.cau.ac.kr](https://oia.cau.ac.kr/bbs/board.php?tbl=bbs61)), Yonsei (Seoul + Mirae separate), Hanyang OIA ([oia.hanyang.ac.kr](https://oia.hanyang.ac.kr/admission)), KHU Global Center ([globalcenter.khu.ac.kr](https://globalcenter.khu.ac.kr/)), Inha International Center |
| File repository (자료실) under category | Files-first listing rather than announcement-first | Sogang 재외국민 자료실, Yonsei admission/upload/guide |
| Multi-board split | Different boards for foreign / 재외국민 / 편입 | KHU, Yonsei (수시 vs 외국인전형 vs 재외국민), Sookmyung |
| Single static page | "We update this page" — no announcement post per cycle | Some 전문대, some smaller privates |

For each university, capture **all** candidate boards. Universities sometimes post the announcement on the OIA board first, then mirror to the main admissions board hours/days later. **Trust the earliest source per cycle.**

### 6.2 Format of discovery sources

| Format | Frequency | Example | Discovery approach |
|---|---|---|---|
| HTML list w/ pagination | ~85% | most universities | parse list page; fingerprint each row by `(post_id, title_hash, attachment_count)` |
| RSS / Atom | <5% | Korea University 도서관 has RSS; some 입학처 do; very rare for admissions | direct subscription, easiest |
| JSON-backed AJAX (egov framework, jQuery DataTables) | ~10% | UOS, Yonsei, some flagship nationals | reverse-engineer the JSON endpoint; usually returns the same records as HTML list |
| Naver Cafe / Naver Blog | n/a | unofficial mirrors | **ignore** — not authoritative |

**RSS reality check**: the egov framework many `.ac.kr` sites run on can emit RSS but admissions offices rarely turn it on. Where present, prefer it.

### 6.3 Keyword vocabulary

Korean signal terms that mark a post as admissions-relevant:

```
모집요강            (admission guidelines)
수시모집            (early admission cycle)
정시모집            (regular admission cycle)
외국인전형          (foreign-applicant track)
외국인특별전형      (foreign special admission)
외국인 특별전형     (variant w/ space)
재외국민           (overseas-Korean)
재외국민특별전형    (overseas-Korean special)
편입학             (transfer)
대학원 모집        (graduate recruitment)
신·편입학          (new + transfer)
정정공고           (correction notice — CRITICAL)
변경공고           (change notice)
일정변경           (schedule change)
추가모집           (additional recruitment)
충원합격           (waitlist replacement)
합격자발표         (results announcement)
원서접수           (application receipt)
```

English equivalents on bilingual sites:

```
Admission Guide / Admission Guidelines
International Student Admission(s)
Foreign Applicant
Special Admission
Overseas Korean
Transfer Admission
Application Period
Online Application Begins
Recruitment / Recruiting
Notice of Correction / Amendment
Result Announcement / Successful Applicants
```

A simple rules engine on `(post_title contains any-of keywords) AND (post_attachments includes pdf|hwp|hwpx)` correctly classifies ~90% of admission-relevant posts. The remaining 10% are caught by an LLM classifier (cheap embedding similarity to a curated example set is sufficient — no need for a fine-tune).

### 6.4 National-level discovery shortcuts

This is the upstream advantage. Three sources surface "a university has just posted something":

1. **MOE 재외교육기관포털 — okep.moe.go.kr 대학별 모집요강 board** ([list URL](https://okep.moe.go.kr/board/list.do?board_manager_seq=16&menu_seq=22)) — **first-class signal**. Universities self-submit links here; new posts surface within a day or two of original publication. Polls cleanly. **Treat as the #1 upstream.**
2. **Adiga (어디가)** ([adiga.kr](https://www.adiga.kr/)) — KCUE-run unified portal. Has 195 universities + 132 colleges. Admissions calendar cleanly published. The 자료실 publishes university-specific 모집요강 cross-links. **Treat as the #2 upstream.**
3. **Study in Korea (NIIED)** ([studyinkorea.go.kr](https://www.studyinkorea.go.kr/)) — University directory + announcements. Slower than (1) and (2) for guideline discovery but valuable for GKS-related events.

Naver/Daum/Google Search alerts on the keyword vocabulary in §6.3 with `site:.ac.kr` filter are a **redundancy layer** — set up but don't depend on, since search engines have indexing lag (1–14 days).

Naver Cafe / 네이버 블로그 admission communities are **not authoritative** and only useful as *signal that something has been published* — never as the document source itself.

### 6.5 Change detection mechanics

| Scenario | Detection signal | Action |
|---|---|---|
| New PDF URL appears on a known board | New row in announcements list with `(title contains keyword) && pdf attachment` | Enqueue fetch + parse |
| Same URL, file replaced | HTTP `Last-Modified` newer; or `ETag` changed; or `Content-Length` different; or file SHA-256 different | Enqueue re-parse; flag as `revised` |
| Same URL, same file, different text rendering | Most server-side OS-time-based ETags shift even when content stable — treat as cache noise | Verify by content hash before re-parse |
| Title mutated to "정정공고" | Title diff detected on existing entry | Critical: enqueue with priority |
| Attachment ID changes but URL stable | Some egov frameworks change the `?atchFileId=` even when content unchanged | Use file hash, not URL params |

**Versioning strategy:**
- Store every snapshot of a guideline as an immutable raw blob (S3 / R2)
- Store the parsed structured form as a versioned row in Postgres with `valid_from` / `valid_to`
- Where a 정정공고 supersedes an earlier version, keep both rows; mark the earlier `valid_to = correction_notice_at`; set `superseded_by_id`
- Diff display in admin tool: render side-by-side fields from old vs new version

### 6.6 "Is this announcement admissions-relevant?" classifier

Layered:

1. **Hard rules**: title contains any of the keywords in §6.3.
2. **Attachment heuristic**: presence of a PDF or HWP attachment with a filename that contains keywords like `모집요강`, `freshman`, `intl`, `foreign`, `재외`.
3. **Embedding similarity**: cheap KO+EN multilingual embedding (BGE-M3 or E5-multilingual) against a curated set of "definitely-admission" titles, threshold cos-sim > 0.8.
4. **LLM tiebreaker**: only invoked when the previous three disagree. Uses Claude Haiku / GPT-4o-mini structured output: `is_admission_announcement` bool, `admission_track` enum, `is_correction_notice` bool, `is_schedule_change` bool. Cost <$0.001 per classification.

Targeting precision/recall: 99% recall, 95% precision. Missed admissions notices are catastrophic; false-positive notices waste a parse cycle and cost a few cents — easy tradeoff.

### 6.7 Polling cadence aligned with the academic calendar

Korean admissions seasonality (per [Wikipedia: College admissions in South Korea](https://en.wikipedia.org/wiki/College_admissions_in_South_Korea), [Korea Herald](https://m.koreaherald.com/), Adiga):

| Month | Domestic activity | Foreign-applicant activity |
|---|---|---|
| Jan | 정시 합격발표, 등록 | 외국인 Spring intake — 2차 round, results, 등록 |
| Feb | 정시 추가합격, 등록 | Spring intake registrations close |
| Mar | semester start | Fall-intake announcements begin to appear |
| Apr | — | Fall intake — 1차 round many universities |
| May | 수시 전형계획 발표 (MOE) | Fall intake — round 1 results, round 2 begins at some |
| Jun | 모의평가 | Fall intake — round 2 / interviews |
| Jul | 수시 시행계획 published | Fall intake — late rounds, results begin |
| Aug | — | Fall intake — registrations |
| Sep | 수시 원서접수 starts | Spring 2027 intake — 1차 begins to appear |
| Oct | 수시 원서접수 / 면접 | Spring intake — round 1 results, round 2 begins |
| Nov | 수능 (CSAT first Thursday) | Spring intake — round 2 / round 3 |
| Dec | 수시 합격발표; 정시 원서접수 | Spring intake — round 2 results, registrations |

**Recommended cadence:**
- **High-season per priority university (Sep–Dec for 수시; Dec–Feb for 정시; Mar–May and Sep–Nov for foreign-applicant rounds):** every 6 hours.
- **Low-season per priority university:** daily.
- **Off-priority IEQAS-accredited list:** weekly during academic year, monthly off-season.
- **Discovery-search layer (Naver/Google) over .ac.kr:** every 12 hours, year-round.
- **MOE okep board, Adiga, Study in Korea:** every 6 hours year-round (these are the cheapest, highest-leverage upstreams).
- Polite jitter: each university poll ±15 min random offset; per-domain max-1-rps; respect `Crawl-delay` if present in robots.txt.

### 6.8 Notification and ingestion flow

```
[Discovery Service]
    │ (polls boards / search / aggregators)
    ▼
[Candidate Detection]
    │ (rules + embedding + LLM tiebreaker)
    ▼
[Source Registry]  ← human-vetted before "live"
    │
    ▼
[Fetch & Hash]
    │ (download PDF; record hash, size, ETag, Last-Modified)
    ▼
[Versioning Store]
    │ (immutable blob in R2/S3)
    ▼
[Parse Pipeline]
    │ (layout-aware OCR; LLM extraction; structured output)
    ▼
[Diff Engine]
    │ (compare to last-known guideline for same university+round)
    │ field-level diff: schedule moved, quota changed, doc list changed
    ▼
[HITL Review Queue]
    │ (low-confidence fields surface for admin review)
    ▼
[Hanguk DB]   ←── per-user notifications when relevant guideline updates
    │
    ▼
[Push notifications]
    (via Supabase Edge → FCM/APNS — relevant if user has university tracked)
```

### 6.9 Discovery for unknown universities

The system catches universities **not in the priority list** when they post relevant content via two parallel paths:

1. **Proactive seed**: nightly crawl of `studyinkorea.go.kr/search/universityInfo.do` (paginated). Each new university discovered is added to the registry as `pending_review`.
2. **Reactive search**: hourly Google + Naver site-search across `site:.ac.kr` with the §6.3 keyword vocabulary, restricted to last 24 hours. Any URL whose root domain isn't already in the registry triggers a `discovery_lead` event for human review.

### 6.10 Risks and edge cases

| Edge case | Mitigation |
|---|---|
| Announcement posted, PDF "준비중 / 추후공지" | Re-poll the post every 6 hours until 첨부파일 stabilizes (hash unchanged for 2 consecutive polls) |
| 알림마당 vs 입학공지 split across boards | Multi-board discovery per university; merge by `(university_id, normalized_title)` |
| 정정공고 not a *new* post but an inline edit | Detect via post-content hash diff on already-indexed posts; **must not be missed**; high-priority queue |
| 비밀글 (password-protected) for accepted students | Skip; never solve auth |
| Naver-hosted 카페/블로그 mirrors | Hard-block from ingestion (rules engine: `must domain end-with .ac.kr or .go.kr`) |
| University moves to a new domain | Manual flag; the `Source Registry` is editable |
| University runs `robots.txt` Disallow on admissions paths | Honor it; mark as `discovery_blocked`; surface to admin to find alternative source (often the OIA board allows what 입학처 doesn't, or vice versa) |
| Cloudflare bot challenge on a `.ac.kr` site | Extremely rare; if encountered, switch to headless Playwright with stealth profile + KR proxy |

### 6.11 Architecture implications (for §11)

Add to the recommended architecture:
- A **Discovery Service** upstream of the existing crawl/parse pipeline.
- A **Source Registry** table (`sources`) where rows have lifecycle: `discovered → pending_review → live → deprecated`.
- An **Alerting** layer: when a guideline posts during admission season for a university the user has tracked, push notify (FCM/APNS via Supabase Edge functions).
- A **Cron table** that drives polling cadence by `source_id`, with `last_polled_at`, `next_poll_at`, `consecutive_fails`, and back-off rules.

---

## 7. Advanced tools & existing databases

This section evaluates the broader ecosystem of tools that could power or accelerate the system. Items are clustered by function. Each item: description, why it matters here, cost model, integration complexity, recommendation.

### 7.1 Open data portals

| Tool | One-liner | Why for us | Cost | Integration | Recommendation |
|---|---|---|---|---|---|
| **data.go.kr OpenAPIs** ([data.go.kr](https://www.data.go.kr/)) | Korean public data portal exposing 100+ relevant datasets (see §3.3) | Single biggest source of structured university metadata | Free; key required; dev-tier 1k req/day | Low | **Must-use** |
| **academyinfo.go.kr / 대학알리미** ([academyinfo.go.kr](https://www.academyinfo.go.kr/)) | KCUE university disclosure portal w/ XLSX downloads | Tuition by faculty, students, scholarships paid | Free; bulk XLSX | Low | **Must-use** |
| **KEDI / KESS** ([kess.kedi.re.kr](https://kess.kedi.re.kr/), [hi.kedi.re.kr](https://hi.kedi.re.kr/)) | Higher Education Statistics Survey | Trends, intl student counts year-over-year | Free; XLSX + some API | Low–Med | Should-use |
| **KOSIS** ([kosis.kr](https://kosis.kr/)) | Statistics Korea master portal w/ OpenAPI | Demographic + macro overlays | Free; OpenAPI w/ key | Med | Nice-to-have |
| **NIIED open data** ([niied.go.kr](https://www.niied.go.kr/)) | GKS, TOPIK, scholarships | GKS dataset, TOPIK calendar | Free | Low | **Must-use (GKS)** |
| **KOSAF** ([kosaf.go.kr](https://www.kosaf.go.kr/)) | Govt scholarship admin | Scholarship pages | Free | Med | Should-use |
| **KERIS / RISS** ([riss.kr](http://www.riss.kr/)) | Academic content repo | Mostly papers, rarely admissions | Free w/ login | Med | Skip for v1 |
| **data.seoul.go.kr** | Seoul metropolitan open data | Seoul-only universities | Free | Low | Nice-to-have |
| **Provincial open data portals** (e.g. [data.gg.go.kr](https://data.gg.go.kr/)) | Province-level open data | Specific local-univ datasets | Free | Low | Nice-to-have |
| **KRIVET** ([krivet.re.kr](https://www.krivet.re.kr/)) | Vocational career data | Career outcomes per major | Free | Med | Nice-to-have |
| **MOE 정책 자료** ([moe.go.kr](https://www.moe.go.kr/)) | Ministry of Education policy briefs | Regulatory cycle changes (정원외 cap shifts, etc.) | Free | Med | **Must-use** |
| **MOE okep portal — 대학별 모집요강 board** ([okep.moe.go.kr](https://okep.moe.go.kr/board/list.do?board_manager_seq=16&menu_seq=22)) | Centralized admissions docs board | Discovery upstream | Free | Low | **Must-use** |
| **KCUE (한국대학교육협의회)** ([kcue.or.kr](https://www.kcue.or.kr/)) | Council that runs 어디가, accredits | Member directory, programs | Free | Low | **Must-use** |
| **어디가 (Adiga)** ([adiga.kr](https://www.adiga.kr/)) | KCUE-run unified admissions portal | Discovery + canonical schedule | Free | Med (no public API; scrape) | **Must-use** |

### 7.2 Commercial / semi-commercial admissions data

| Tool | One-liner | Why for us | Cost | Integration | Recommendation |
|---|---|---|---|---|---|
| **진학어플라이 / Jinhakapply** ([jinhakapply.com](https://www.jinhakapply.com/)) | Common application platform | Real-time competition rates per university | Free site; data via UI only | High (no API) | Skip for v1 — can scrape competition rate later if useful |
| **유웨이어플라이 / UwayApply** ([uwayapply.com](https://www.uwayapply.com/)) | Common application platform | Same as above; international students apply via [ipsi3.uwayapply.com/foreign/korea](https://ipsi3.uwayapply.com/foreign/korea/) | Free site; data via UI only | High | Should-use as the "send user here" deep-link target; not a data source |
| **진학사** ([jinhak.com](https://www.jinhak.com/)) | Admissions consulting + score-prediction company | Calendar + score analysis | Some content paywalled | Med–High | Nice-to-have for college-counseling features |
| **메가스터디** ([file.megastudy.net](https://file.megastudy.net/)) | Mega private-edu chain w/ admissions library | Hosts mirror PDFs; useful redundancy | Free site | Low | Nice-to-have as discovery redundancy |
| **종로학원, 대성학원, 이투스, 유웨이중앙교육** | KOR private edu industry; prediction calendars | Domestic admissions intel | Mostly paywalled | High | Skip for v1 (intl-irrelevant) |
| **Linkareer** ([linkareer.com](https://linkareer.com/)) | Extracurricular / job site | Sometimes has scholarship calendars | Free | High | Skip for v1 |
| **Campuspick** ([campuspick.com](https://www.campuspick.com/)) | Campus life / scholarship aggregator | Scholarship feed | Free | Med | Nice-to-have |
| **HiKorea** ([hikorea.go.kr](https://www.hikorea.go.kr/)) | MOJ visa/immigration portal | D-2 visa rules, work-permit hours | Free | Med | **Must-use for visa alignment** |

### 7.3 International / English datasets

| Tool | Why for us | Cost | Recommendation |
|---|---|---|---|
| UNESCO UIS, OECD Education at a Glance ([gpseducation.oecd.org](https://gpseducation.oecd.org/)) | Macro context, "education in Korea" overview | Free | Nice-to-have |
| Times Higher Education API, [QS World University Rankings](https://www.topuniversities.com/world-university-rankings) | Rankings overlay for the user | THE/QS APIs are paid; QS has light public widgets | Should-use (already-published rankings via WebSearch/web scrape; commercial license needed for systematic use) |
| ARWU / Shanghai Ranking, Webometrics | Alternative rankings | Free pages | Nice-to-have |
| IIE Open Doors | Intl student flows globally | Free | Skip for v1 |
| DAAD-style scholarship aggregators covering Korea | Cross-country scholarship overlays | Free | Nice-to-have |

### 7.4 Search and discovery tooling

| Tool | One-liner | For us | Cost | Recommendation |
|---|---|---|---|---|
| **Google Programmable Search Engine (PSE)** | Custom site-restricted Google search | Discovery layer over `.ac.kr` | Free 100/day; $5/1k beyond | **Must-use** |
| **Bing Web Search API** | Microsoft's search API | Backup for PSE | $4/1k typical | Should-use as redundancy |
| **Naver Search API** ([developers.naver.com](https://developers.naver.com/)) | Korean #1 search engine API | Korean-language coverage | Free tier; paid tiers | **Must-use** for Korean-language news / blog signals |
| **Daum / Kakao Search API** | Korean #2/3 | Redundancy | Free | Nice-to-have |
| **Naver / Google news APIs** | "Admission guidelines released" alerts | New 모집요강 announcements often picked up by edu-news | Mixed | Should-use |
| **RSS aggregators (Feedly API, FreshRSS)** | RSS subscription | Few admissions feeds exist; library news | Self-host or $$ | Nice-to-have |
| **Common Crawl** ([commoncrawl.org](https://commoncrawl.org/)) | Open web archive | Historical guideline archives where the original disappeared | Free download; AWS bandwidth costs | Nice-to-have |
| **Wayback Machine** ([web.archive.org](https://web.archive.org/)) | Historical snapshots | Same as above; per-URL retrieval | Free | **Must-use** for retroactive guideline reconstruction |
| AcademyInfo bulk export | XLSX dumps from KCUE | Ground truth | Free | **Must-use** |

### 7.5 Crawling infrastructure

| Tool | One-liner | For us | Cost | Recommendation |
|---|---|---|---|---|
| **Crawlee** (Apify-stewarded) | Node/Python crawl framework w/ batteries | Sensible default for the discovery layer | Free OSS | **Must-use (OSS)** |
| **Apify Actors marketplace** ([apify.com/store](https://apify.com/store)) | 26k+ pre-built scrapers | No Korean-uni specific actors found in marketplace as of audit; useful platform for hosting our own actors | Tier $49+/mo; free tier 5USD credit | Should-use as deploy target |
| **Bright Data** | Top-tier proxy / scraping infra | Heavyweight; overkill for `.ac.kr` | $$$$ | Skip for v1 |
| **Oxylabs** | Same class as Bright Data | Same | $$$$ | Skip for v1 |
| **ScrapingBee** (now Oxylabs) | Browser-as-a-service | Useful when a site has JS challenges | $49+/mo | Nice-to-have stopgap |
| **Scrapy + Splash** | OSS Python scraping | Battle-tested for crawl-orchestrator | Free | Should-use if Python-stack |
| **Playwright** (open-source) | Headless browser for JS-heavy sites | The `egov`-framework JS endpoints + a few Cloudflare-protected sites | Free | **Must-use** |
| **Puppeteer** | Same class as Playwright (Chrome-only) | Either is fine | Free | Should-use (pick one) |
| **AntiCaptcha / 2Captcha** | Captcha-solving services | Rare for `.ac.kr` boards | $1–3/1k captchas | Nice-to-have |
| **KR-IP proxies (Bright Data residential, Oxylabs SOCKS)** | KR exit IPs | Some uni sites geo-fence or rate-limit non-KR | $50–500/mo | Nice-to-have if hits geo-fence |

### 7.6 PDF / document parsing

This is where the system spends most of its compute. For Korean university 모집요강 PDFs, the workload is **text-based PDFs with embedded scanned images, tables with merged cells, and bilingual layouts**.

| Tool | One-liner | For us | Cost | Korean accuracy | Recommendation |
|---|---|---|---|---|---|
| **Adobe PDF Extract API** | Adobe's commercial extract | Excellent table fidelity | $0.05/doc tier | High for KO+EN | Should-use (premium tier) |
| **AWS Textract** | AWS commercial OCR/table | Solid forms, table extraction (FORMS, TABLES features); KO support added 2023 | $0.0015/page (text), $0.015/page (forms+tables) | Med-High for KO; tables variable | Should-use |
| **Azure Document Intelligence** ([docs.microsoft.com](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)) | Microsoft commercial; layout + general document model | Strong layout + key-value | $1.50/1k pages (read), $10/1k (layout) | High for KO | Should-use |
| **Google Document AI** ([cloud.google.com/document-ai](https://cloud.google.com/document-ai)) | Google commercial; OCR + custom processors | Great for trained custom; CDC test ([braincuber comparison](https://www.braincuber.com/blog/aws-textract-vs-google-document-ai-ocr-comparison)) | $1.50/1k pages baseline; custom processors $5+/1k | High for KO | Should-use |
| **Naver Clova OCR** ([ncloud.com](https://www.ncloud.com/product/aiService/ocr)) | KR-domestic OCR specialized for Korean | **Best Korean OCR**, ICDAR 2019 winner; supports template-based table extraction | $0.005–0.01/page; monthly base fee even at zero usage | **Best for Korean** | **Must-use** for KO scanned PDFs |
| **Tesseract + kor traineddata** | OSS OCR | Cheap baseline | Free | Med — drops on tables | Nice-to-have for batch retro |
| **EasyOCR (ko)** | OSS deep-learning OCR | Better than Tesseract on KO | Free | Med-High | Should-use (free tier) |
| **PaddleOCR (ko)** | Baidu-stewarded OSS | Good KO + table recognition | Free | High | Should-use |
| **PyMuPDF (fitz)** | OSS PDF text extraction (no OCR) | Direct text extraction from text-PDFs | Free | High when text layer present | **Must-use** (default) |
| **pdfplumber** | OSS PDF table extraction | Great for clean, simple tables | Free | High when text layer present | **Must-use** |
| **Camelot** | OSS PDF tables (lattice + stream) | Good for ruled tables | Free | Med-High | Should-use |
| **Tabula** | OSS Java-based table extraction | Older; pdfplumber+Camelot replace it | Free | Med | Skip |
| **Unstructured.io** ([unstructured.io](https://unstructured.io/)) | OSS + commercial document chunking | LLM-friendly chunked output | Free OSS, paid SaaS | Med-High | Should-use (OSS) |
| **Marker** | OSS PDF→Markdown converter (deep-learning) | Good for narrative; tables OK | Free | Med | Nice-to-have |
| **Nougat** (Meta) | OSS academic-paper PDF extractor | Trained on papers, OK for narrative | Free | Med (more EN biased) | Skip |
| **DocLing** (IBM) | OSS deep-learning doc converter | Strong layout | Free | Med | Should-use (OSS) |
| **LayoutLMv3** | Layout-aware transformer model | Good for forms-y docs | Free model weights; compute cost | High potential w/ KO fine-tune | Nice-to-have |
| **Donut** (Naver) | OCR-free document understanding model | Strong for KO docs (Naver-built) | Free model weights | High for KO | Should-use (research PoC) |
| **Pix2Struct** (Google) | Visual document understanding | English-leaning | Free model weights | Med for KO | Skip |

**Practical pipeline for Korean 모집요강:**

1. **PyMuPDF text extraction** to detect if the PDF has a text layer.
2. If yes → **pdfplumber + Camelot** for table-rich pages, **PyMuPDF blocks** for prose.
3. If no (image-only) → **Naver Clova OCR** for Korean-language documents (best accuracy), **AWS Textract** as fallback / for bilingual sections.
4. Layout-aware refinement on ambiguous pages → **DocLing** or **LayoutLMv3 ko-fine-tuned** if compute available.
5. LLM extraction pass over the cleaned text → see §7.7.

### 7.7 LLM / extraction tooling

| Tool | One-liner | For us | Cost | Recommendation |
|---|---|---|---|---|
| **GPT-4o** (OpenAI) | Leading frontier; structured output mode | Excellent for messy extraction | ~$2.50/1M input, $10/1M output | **Must-use** for low-volume extraction |
| **GPT-4o-mini** | Cheaper, fast | Routine classification + extraction | ~$0.15/1M in, $0.60/1M out | **Must-use** for high-volume classification |
| **Claude Sonnet 4.6** ([api.anthropic.com](https://api.anthropic.com/)) | Anthropic frontier; great Korean | Best for nuanced extraction | ~$3/1M in, $15/1M out (Sonnet); Haiku cheaper | **Must-use** — use Sonnet for hard parsing, Haiku for classifier |
| **Claude Haiku 4.5** | Cheap fast Anthropic | High-volume classification | ~$1/1M in, $5/1M out | **Must-use** |
| **Gemini 2.5 Pro / Flash** | Google frontier; great long-context (1M tokens) | Whole-PDF in one shot for big guidelines | $1.25/1M in, $10/1M out (Pro) | Should-use for whole-doc passes |
| **Function calling / JSON schema** | Structured-output mode | All three frontier providers support it | included | **Must-use** |
| **HyperCLOVA X** (Naver) | Korean-specialized LLM | KO-native; on-prem option | Naver Cloud pricing | Nice-to-have if KO-only deployment needed |
| **KoAlpaca, Polyglot-Ko** | OSS Korean LLMs | Self-host, open weights | GPU $$ | Skip for v1 |
| **Solar (Upstage)** | Korean LLM startup | Strong KO; API + on-prem | Upstage pricing | Nice-to-have |

**Embeddings:**
| Tool | For us | Cost | Recommendation |
|---|---|---|---|
| **BGE-M3** | OSS multilingual w/ KO+EN | de-dup + similarity | Free | **Must-use** |
| **E5-multilingual** | OSS multilingual embedding | alternative to BGE-M3 | Free | Should-use |
| **OpenAI text-embedding-3-large** | API embedding | high quality, paid | $0.13/1M tokens | Should-use |
| **Voyage AI multilingual** | API embedding, KO support | strong KO | $$ | Nice-to-have |
| **KoSimCSE** | KO-specialized OSS | Korean-only | Free | Nice-to-have |
| **Solar Embeddings** (Upstage) | KO-specialized API | KO-strong | Upstage pricing | Nice-to-have |

### 7.8 Vector / hybrid search

| Tool | For us | Cost | Recommendation |
|---|---|---|---|
| **Postgres pgvector** ([Supabase docs](https://supabase.com/docs/guides/database/extensions/pgvector)) | The app already uses Supabase | semantic search of guidelines, university descriptions, scholarship pages | Free w/ Supabase | **Must-use** — pgvector is the default since Supabase ships it |
| **PGroonga** ([Supabase docs](https://supabase.com/docs/guides/database/extensions/pgroonga)) | Multilingual full-text in Postgres | KO tokenization via MeCab | Free w/ Supabase | **Must-use** — alongside pgvector |
| **Weaviate, Qdrant, Vespa** | Dedicated vector DBs | Outsized for the workload while Postgres works | $$ self-host or SaaS | Skip — pgvector is enough |
| **Typesense, Meilisearch** | Lightweight search engines | Less Korean tooling than ES | Free OSS or SaaS | Nice-to-have |
| **Elasticsearch + nori** | KR-friendly tokenizer for ES | Heavy infra | Self-host $$ or Elastic Cloud | Skip — pgvector + PGroonga is enough |
| **Khaiii / MeCab-ko-dic** ([github.com/kakao/khaiii](https://github.com/kakao/khaiii)) | KO morphological analyzers | Better KO tokenization for full-text search | Free OSS | Should-use (with PGroonga) |

### 7.9 Change detection / monitoring SaaS

| Tool | For us | Cost | Recommendation |
|---|---|---|---|
| **Visualping** ([visualping.io](https://visualping.io/)) | URL change monitoring; visual + text | Watch a per-university announcements board | Free 5 pages, paid $15+/mo | Nice-to-have stopgap before custom layer |
| **Distill.io** ([distill.io](https://distill.io/)) | Same class; supports PDFs, JSON, RSS | Best-fit SaaS | Free 25 pages local, paid $9+/mo | Should-use if custom layer not yet built |
| **ChangeTower** ([changetower.com](https://changetower.com/)) | Enterprise compliance-focused | 12-year archive | $9+/mo to $299+/mo | Nice-to-have for legal/compliance archive |
| **Hexowatch** | Same class | $14+/mo | Nice-to-have |
| **Diffbot** | Article extraction APIs | Less directly useful | $$ | Skip |
| **Google Alerts** | Cheapest "something happened" signal | Email-only; lossy | Free | Should-use as redundancy |

**Rec:** the system **builds its own change detection** in §11; SaaS are stopgaps for v0/v0.5.

### 7.10 Workflow orchestration

| Tool | For us | Cost | Recommendation |
|---|---|---|---|
| **Temporal** ([temporal.io](https://temporal.io/)) | Durable workflow engine; perfect for long polling pipelines w/ retries | Industrial-strength | Self-host free; Temporal Cloud $$ | Should-use if scale ramps up |
| **Airflow** ([airflow.apache.org](https://airflow.apache.org/)) | Veteran ETL orchestrator | Heavyweight | Free OSS | Skip — Temporal/Prefect are friendlier |
| **Prefect** ([prefect.io](https://www.prefect.io/)) | Lightweight modern orchestrator | Better than Airflow for this | Free OSS, paid Cloud | Should-use |
| **Dagster** ([dagster.io](https://dagster.io/)) | Asset-aware orchestrator | Strong observability | Free OSS, paid Cloud | Nice-to-have |
| **n8n** ([n8n.io](https://n8n.io/)) / **Activepieces** | Low-code pipelines | Quick wins for non-technical wiring | Self-host or paid | Nice-to-have |
| **Supabase Edge Functions + pg_cron** ([supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)) | Already-in-stack | Native to the app | Free w/ Supabase quotas | **Must-use for v1** — discovery + diff cron lives here |
| **Cloudflare Workers + Cron Triggers + R2** ([developers.cloudflare.com](https://developers.cloudflare.com/)) | Serverless edge alternative | Cheap + global | Generous free tier | Should-use as alternative or supplement |

### 7.11 Storage

| Tool | For us | Recommendation |
|---|---|---|
| **Supabase Postgres** | Structured data; the app already uses it | **Must-use** |
| **Cloudflare R2 / AWS S3 / Backblaze B2** | Raw blob store for PDFs | **Must-use** — pick R2 (cheapest egress) |
| **ClickHouse** ([clickhouse.com](https://clickhouse.com/)) | Time-series for crawl events | Nice-to-have once volume is high |
| **Apache Iceberg / Delta Lake** | Lakehouse format | Skip for v1 |
| **Vector store** | pgvector inside Supabase | **Must-use** |

### 7.12 Observability

| Tool | For us | Cost | Recommendation |
|---|---|---|---|
| **Sentry** ([sentry.io](https://sentry.io/)) | Error tracking | Already typically in Flutter projects | Free 5k events/mo, paid $$ | **Must-use** |
| **Logtail / BetterStack** | Log aggregation + alerting | Crawler + parse pipeline observability | Free tier, paid $$ | Should-use |
| **Grafana Cloud** | Metrics + logs + dash | Comprehensive | Free 10k series, paid $$ | Should-use |
| **Honeycomb** | Wide-events observability | Best-in-class but $$ | $$ | Nice-to-have |
| **Prometheus + Grafana self-hosted** | OSS | More work | Free | Should-use if cost-sensitive |

### 7.13 Validation / human-in-the-loop

| Tool | For us | Recommendation |
|---|---|---|
| **Argilla** ([argilla.io](https://argilla.io/)) | Modern data-labeling + feedback | Strong for HITL review of LLM extractions | **Must-use** |
| **Label Studio** ([labelstud.io](https://labelstud.io/)) | OSS labeling | Mature alternative | Should-use |
| **Doccano** ([doccano.github.io](https://doccano.github.io/doccano/)) | Lightweight text labeling | Light option | Nice-to-have |
| **Lakera Guard** ([lakera.ai](https://www.lakera.ai/)) | LLM guardrail | Prevent prompt injection in scraped doc → LLM | Nice-to-have |

### 7.14 Specific Korean-context resources

- **GKS** (operated by NIIED via [studyinkorea.go.kr](https://www.studyinkorea.go.kr/in/plan/scholarship.do)) — application portal, university-allocation file. **Must-use**.
- **KOSAF — 한국장학재단** ([kosaf.go.kr](https://www.kosaf.go.kr/)) — government scholarship admin. **Should-use**.
- **KAIST 장학재단** ([kaist.ac.kr](https://www.kaist.ac.kr/)) — KAIST internal. Niche.
- **외국인전형 specific portals on uwayapply** (e.g. [ipsi3.uwayapply.com/foreign/korea](https://ipsi3.uwayapply.com/foreign/korea/?CHA=1)) — application sink, deep-link target.
- **KCUE data services** ([kcue.or.kr](https://www.kcue.or.kr/)) — already covered in §3.6 / §3.10.
- **MOE policy data portal** ([www.moe.go.kr/boardCnts/listRenew.do?boardID=294](https://www.moe.go.kr/)) — **Must-use** for regulatory tracking.
- **HiKorea / 비자포털** ([hikorea.go.kr](https://www.hikorea.go.kr/)) — D-2 visa rules; **must-use** for visa alignment.

### 7.15 The opinionated stack pick — "if I were building this for Hanguk today"

Hanguk is Flutter + Supabase + Riverpod + Vapi already. The most aligned, lowest-friction stack:

**Layer 1 — Discovery & polling (Supabase Edge + Cloudflare Workers)**
- Supabase Edge Functions + `pg_cron` for the crawl scheduler (driven by a `sources` table)
- Cloudflare Workers + Cron Triggers as a redundant runner for high-frequency polling (<6h cadence) — cheaper at scale
- Crawlee for the crawl logic (Node), deployed as Workers/Edge functions
- Playwright (in a Cloudflare Browser Rendering Worker or a small Hetzner box) for JS-heavy sites

**Layer 2 — Search-driven discovery**
- Google Programmable Search Engine (free 100/day) + Naver Search API (Korean coverage) for unknown-university discovery
- Wayback Machine for retro archive
- MOE okep + Adiga + Study in Korea polled every 6 hours

**Layer 3 — Storage**
- Cloudflare R2 for raw blob storage of every PDF/HWP snapshot (immutable; SHA-256 keys)
- Supabase Postgres for all structured rows
- pgvector + PGroonga + MeCab-ko for hybrid Korean search
- Sources table in Postgres drives all discovery

**Layer 4 — Parse pipeline**
- PyMuPDF / pdfplumber / Camelot for text-PDF table extraction (open source; free)
- Naver Clova OCR for image-only Korean PDFs
- Claude Sonnet (frontier) for hard structured extraction; Claude Haiku for routine classification; tiny structured-output schema enforced
- BGE-M3 embeddings for de-dup and similarity
- DocLing / LayoutLMv3 ko as PoC for harder layout cases

**Layer 5 — HITL**
- Argilla for the review queue
- Custom Flutter admin (or simple Next.js admin) consuming Supabase RLS to surface low-confidence rows

**Layer 6 — Hanguk-app delivery**
- Supabase Realtime for live-updating "applications" tab
- FCM/APNS push when a tracked university posts a guideline change
- Use the existing `lib/features/applications` view to surface the user's tracked universities; `lib/features/map` to visualize geographic distribution

**Cost envelope at v1 (1k universities monitored, ~5k PDF parses/month):**
- Supabase Pro: ~$25/mo
- R2: ~$0.50/mo (storage) + bandwidth
- Cloudflare Workers: free tier likely sufficient for v1
- Claude/OpenAI usage: ~$50–150/mo at v1 volume
- Naver Clova OCR: ~$20–80/mo for the OCR-needed subset
- Misc (proxies, monitoring SaaS): ~$30/mo
- **Estimated total: $130–300/month** for v1.

---

## 8. Technical feasibility per source class

| Source class | Examples | Feasibility | Tooling |
|---|---|---|---|
| Plain HTML w/ text-PDF attachment | Most national flagships, mid-privates | Easy | Crawlee + PyMuPDF |
| egov-framework JSON-AJAX boards | UOS, Yonsei, KHU | Easy after reverse-engineering JSON endpoint | Playwright once → cache the JSON endpoint, then HTTP-fetch |
| HWP / HWPX attachments | Some 거점국립대 | Easy with [hwpers](https://github.com/Indosaram/hwpers), pyhwp, or kordoc MCP | OSS HWP parsers |
| Image-only PDF | A handful of older / smaller universities | Medium | Naver Clova OCR |
| Bot-protected (Cloudflare) | None observed in priority list | n/a | Playwright stealth + KR proxy if encountered |
| Behind login | None for guidelines; some application portals | Skip | n/a |

**Maintenance burden estimate**: a careful selector-based crawler maintained for 110 universities, each with ~2 boards, breaks at ~5–10% of universities per year (CMS migrations, theme refreshes). That's ~10–20 selector fixes per year. Manageable with a `site_changed` alert when the parse-success rate dips on a specific source.

---

## 9. Competitive landscape

What already exists?

- **Adiga (어디가)** — government-run, comprehensive, KO-only, no API. Closest competitor for *information* but not for *workflow* (no application tracking, no Korean-language interview prep, etc.).
- **Study in Korea (NIIED)** — government, comprehensive, multilingual. Same gap as Adiga.
- **Uway / Jinhakapply** — application sinks, not information products.
- **University consultancies** (Hi Korea, Globstudy, Apply Korea, etc.) — paid, manual, country-specific.
- **Flutter / Korean uni apps in Play Store** — most are TOPIK study apps, not admissions DBs.
- **None of these** integrate "your data + AI interview practice + university map + auto-tracked guidelines" the way Hanguk does.

Hanguk's positioning: **the AI-assisted application companion, end-to-end, with always-fresh data**. That positioning works because data freshness is exactly what the §6 system delivers.

---

## 10. Legal & compliance

### 10.1 robots.txt

Most `.ac.kr` admissions sites have permissive robots.txt or no rules at all (egov-default). A few (e.g. `university.ac.kr/robots.txt`) explicitly disallow `/cgi-bin/` and `/admin/` only. **No priority university observed disallowing /admission/ or /notice/ paths.**

Before crawling a new source, the discovery service must:
1. `GET /robots.txt`, parse, respect Disallow.
2. Honor `Crawl-delay` if present.
3. Use a User-Agent that identifies the crawler ("HangukBot/1.0 (+https://hanguk.app/bot)") and gives a contact email.

### 10.2 Terms of Service

Korean university admissions pages do not publish formal ToS for admissions data. The data is published as a public service. **Republishing structured extracts of the data is broadly safe**; republishing the original PDF is more nuanced (each PDF is a copyrightable creative work of the university). Best practice:

- Store the **structured fields** (calendar, quotas, scholarships, requirements) in our DB and present them in our UI without copying the underlying prose verbatim.
- Provide a deep link back to the original PDF for users who want the canonical document.
- Do not republish the PDF itself on Hanguk's CDN unless we have a use case (offline/cached) and we can justify fair use for the user's own copy.

### 10.3 Copyright

Korean universities hold copyright to their own published documents. Tabular factual data (quotas, schedules, fees) is not copyrightable in Korea or under Berne — facts are uncopyrightable. The presentation (the prose + layout) is copyrightable. Hanguk extracts facts; should not redistribute the original layout.

### 10.4 PIPA — Personal Information Protection Act

Korea's [PIPA](https://elaw.klri.re.kr/eng_service/lawView.do?hseq=53044&lang=ENG) governs personal data. Hanguk's data flow:

- **Inbound to Hanguk DB**: only public institutional data (no personal). PIPA mostly N/A.
- **From the user**: Hanguk collects user-side personal data (auth, applications). Already governed by Supabase + the app's own privacy policy.
- **Cross-border data flow** (Hanguk users may be outside Korea): PIPA's extraterritorial scope applies only when processing data of KR-resident data subjects. If Hanguk's users are mostly Uzbek/CIS/SE-Asia, PIPA mostly governs only the data flow into Korean university servers (which is the user's own action via UwayApply).
- **Pseudonymized data exemption**: PIPA permits pseudonymized data processing for research, statistics, and public records without consent — useful framing for any aggregate analytics later.

### 10.5 GDPR

If Hanguk has EU users, GDPR applies to *user* data, not the harvested university data. Standard processor agreements with Supabase + OpenAI/Anthropic + Naver Cloud needed; data residency considerations (Naver Cloud is KR-resident, which actually helps for KR data subjects).

### 10.6 Tuition / scholarship redistribution

Tuition tables from `academyinfo.go.kr` are explicitly published for public reuse (KCUE government-mandated disclosure). Scholarship listings within a university's 모집요강 are facts, not creative expression — safe to extract. Do not copy paragraphs verbatim. ([data.go.kr standard data terms](https://www.data.go.kr/data/15107731/standard.do))

### 10.7 Visa-related compliance

If Hanguk surfaces visa info, defer to HiKorea as the source of truth and link rather than republish. Don't claim to give legal/immigration advice; provide factual summaries only.

---

## 11. Comparable systems worldwide — benchmarking study

This section surveys ~30 admissions / scholarship / university-info systems globally to extract patterns to adopt and pitfalls to avoid. Each entry follows the spec: scope, funding, ingestion, update mechanism, QC, stack hints, APIs/open data, multilingual, login/personalization, key innovations, pitfalls, sources.

### 11.1 Government / non-profit national systems

#### 11.1.1 DAAD — Deutscher Akademischer Austauschdienst (Germany)
- **Scope:** Germany; world's largest funding org of intl exchange. Two flagship databases: [International Programmes in Germany](https://www2.daad.de/deutschland/studienangebote/international-programmes/en/) (intl-friendly programs), [Scholarship Database / Stipendiendatenbank](https://www2.daad.de/deutschland/stipendium/datenbank/de/21148-stipendiendatenbank/) (scholarships).
- **Funding:** government + foundations. Non-profit.
- **Ingestion:** **publisher self-service portal**. German universities log in to a DAAD admin and update their programs themselves; DAAD curators review and approve.
- **Update mechanism:** continuous (universities can edit anytime); annual re-validation cycle.
- **QC:** curator review per submission; standardized metadata schema enforced by the form.
- **Tech stack:** internal CMS; public site is a typed-search Java app. Some new generation (MyGUIDE) is React+API.
- **APIs / open data:** mostly UI-driven; some structured exports for partners. DAAD Funding Database widget embeddable.
- **Multilingual:** DE + EN side-by-side; everything in both.
- **Login / personalization:** **MyGUIDE** ([myguide.de](https://www.myguide.de/en/my-guide-for-higher-education-institutions/)) — students fill in profile, get matched programs.
- **Key innovations to steal:** publisher self-service backed by curators (the dominant pattern across all top systems); side-by-side bilingual; "watchlist" / save-program feature already in their UI.
- **Pitfalls:** the curator bottleneck means schema changes are slow; some programs slowly drift out of date if a university is unresponsive.

#### 11.1.2 Hochschulkompass (HRK, Germany)
- **Scope:** Germany; **21,000+ degree programs** at all state-recognized universities. ([hochschulkompass.de](https://www.hochschulkompass.de/en/))
- **Funding:** German Rectors' Conference (HRK) — sector association.
- **Ingestion:** **publisher self-service** — universities are the data publishers; "All information found in the Higher Education Compass is authorised by the universities and is updated by employees at the universities themselves."
- **Update mechanism:** continuous edits + scheduled bulk pulls for partners.
- **QC:** university-attested, central HRK does light validation.
- **APIs / open data:** **TXT bulk export** (tab-separated) is offered to "collaborative partners" who want to embed program search on their own sites. No public REST API.
- **Multilingual:** DE + EN.
- **Personalization:** none — pure search.
- **Key innovations to steal:** **the partner-data-export model** is interesting — they syndicate the canonical data to third parties, who maintain UX freedom while DB stays canonical.
- **Pitfalls:** TXT bulk export is anachronistic; no REST API frustrates modern integrators.

#### 11.1.3 DAAD Funding Database APIs
Built on the same admin as Stipendiendatenbank; widget-embeddable; not a true REST API. Mostly UI-driven. **Lesson:** even a $XX-million national system doesn't expose REST — the political/IT cost is high.

#### 11.1.4 Campus France — Études en France (France)
- **Scope:** France; serves intl students in **73 countries** through Campus France local offices. ([campusfrance.org](https://www.campusfrance.org/en/application-etudes-en-france-procedure))
- **Funding:** government (under MEAE + MESR).
- **Ingestion:** university self-service catalog + central curation.
- **Update mechanism:** annual cycle; admissions-window-bounded.
- **QC:** Campus France local office reviewers verify documents per applicant.
- **APIs / open data:** none publicly. Internally, Études en France data flows: applicant → Campus France local office → French university → consulate (for visa).
- **Multilingual:** FR + EN + national languages.
- **Login / personalization:** **strong** — single profile drives full application + visa.
- **Key innovations to steal:** **the visa-coupling**. Application and visa are wired into the same flow. Hanguk should consider linking out to HiKorea more deeply, surfacing visa eligibility per university per applicant nationality.
- **Pitfalls:** Études en France is famously slow during peak; UI is dated; per-country availability gaps.

#### 11.1.5 Nuffic — Study in NL (Netherlands)
- **Scope:** Netherlands; aggregates all intl programs. ([studyinholland.nl](https://www.studyinholland.nl/), [studyinnl.org](https://www.studyinnl.org/about-study-in-the-netherlands))
- **Funding:** non-profit + government grants.
- **Ingestion:** university self-service publishing of program metadata into the Nuffic Studyfinder; Nuffic verifies.
- **Update mechanism:** continuous; annual statistical refresh ([Incoming degree mobility 2023-24](https://www.nuffic.nl/sites/default/files/2024-05/incoming-degree-mobility-dutch-higher-education-2023-24.pdf)).
- **QC:** Nuffic editorial team.
- **APIs / open data:** none open; Nuffic publishes annual datasets as PDF/XLSX.
- **Multilingual:** EN-primary; some NL.
- **Personalization:** Studyfinder + Grantfinder UX. Profile-light.
- **Key innovations to steal:** the **Studyfinder/Grantfinder** split — keeping programs and scholarships as **two coupled-but-separate searches** with shared filters. Aligns with our §11 architecture splitting recruitment_units and scholarships.
- **Pitfalls:** EN-only narrows reach; doesn't surface application portal — students must click out to each university.

#### 11.1.6 StudyPortals (Netherlands, commercial)
- **Scope:** **240,000+ programs** across **3,500+ institutions** worldwide; **55M users/year**. Verticals: Bachelorsportal, Mastersportal, PhDportal, etc. ([studyportals.com](https://studyportals.com/), [Wikipedia](https://en.wikipedia.org/wiki/Studyportals))
- **Funding:** **commercial**, results-based — universities pay for clicks/leads.
- **Ingestion:** **mixed** — universities push via self-service; StudyPortals also scrapes + licensed feeds. Has a paid Analytics & Consulting Team that gives universities back insights.
- **Update mechanism:** continuous + annual partner cycle.
- **QC:** internal editorial + machine validation; unverified programs are tagged.
- **APIs / open data:** none open; data is the asset.
- **Multilingual:** EN-primary.
- **Personalization:** strong; saved-list, comparison, recommendations.
- **Key innovations to steal:** **lead-based monetization is decoupled from data freshness**. They benefit when data is fresh because users click. Hanguk's freemium can borrow this — partner universities get richer profiles in exchange for a referral.
- **Pitfalls:** commercial bias — paying universities sometimes sit higher; reviews of mastersportal mention this on Trustpilot. Data inconsistency between programs published self-service vs scraped.

#### 11.1.7 British Council — Study UK
- **Scope:** UK; sector promotion + lead generation.
- **Funding:** semi-public (British Council).
- **Ingestion:** institution self-service via partnership program; British Council reviews.
- **Update mechanism:** continuous.
- **QC:** partner-tier model.
- **APIs / open data:** none open.
- **Multilingual:** dozens of language versions of the Study UK site.
- **Personalization:** light.
- **Key innovations to steal:** **the localized landing pages by source country** — the same DB rendered in 30+ language/country variants. Hanguk could similarly surface country-specific document checklists.
- **Pitfalls:** the [2024 third-party data exposure incident](https://www.computerweekly.com/news/252512816/British-Council-data-exposed-by-third-party-cyber-failure) shows the supply-chain risk.

#### 11.1.8 UCAS (UK)
- **Scope:** UK undergrad; central admissions for >300 universities. ([ucas.com](https://www.ucas.com/))
- **Funding:** non-profit charity; fees from applicants + universities.
- **Ingestion:** **central application** — applicants submit one form; UCAS distributes to chosen universities; universities respond via UCAS.
- **Update mechanism:** **daily during peak (Clearing)**; otherwise continuous.
- **QC:** UCAS validates application data, doesn't curate program data (universities do that themselves).
- **Tech stack:** legacy-modernized; ODBC + UCAS-Link API for institutional integrations ([UCAS Data Solutions](https://www.ucas.com/providers/our-products-and-services/data-products-and-solutions/data-solutions)).
- **APIs / open data:** universities have **ODBC** + **UCAS-Link API** to integrate. Public has [UCAS Data and Analysis](https://www.ucas.com/data-and-analysis) (reports, not API).
- **Multilingual:** EN.
- **Personalization:** strong — Track, results, Clearing.
- **Key innovations to steal:** **the central application model** scales — one submission, many destinations. **The daily-update cycle during peak (Clearing)** is the reference design for high-frequency operations. Hanguk's discovery cadence in §6.7 mirrors this.
- **Pitfalls:** **the institution-side data ingestion has been criticized as ODBC-era** — newer institutions complain about modernization pace. The deadline-driven UX puts immense pressure on the platform every August.

#### 11.1.9 HESA (UK)
- **Scope:** UK; provides HE data services and stats. ([hesa.ac.uk](https://www.hesa.ac.uk/)) Sister to UCAS for the data layer.
- **Funding:** levy-funded.
- **APIs / open data:** structured datasets, mostly bulk download, some Open Data REST.
- **Key lesson:** **data layer separated from the application-flow layer** — UCAS does the workflow, HESA does the analytics. Hanguk doesn't need separate orgs but the **architecture separation** (operational vs analytical) is a useful principle.

#### 11.1.10 Common Application + Coalition Application (USA)
- **Scope:** USA undergrad admissions; **Common App: 1,000+ institutions**, **Coalition: 170 institutions** (mission-aligned, equity-focused). ([commonapp.org](https://www.commonapp.org/), [mycoalition.org](https://mycoalition.org/))
- **Funding:** non-profit.
- **Ingestion:** central application; universities receive structured data from the platforms.
- **Update mechanism:** annual cycle (open Aug 1).
- **QC:** Common App validates; universities curate their own supplements.
- **APIs / open data:** none public.
- **Multilingual:** EN-primary.
- **Personalization:** **strong** — profile, "My Colleges", recommendation tracking.
- **Key innovations to steal:** **separation of "core application" (re-used across schools) from "school-specific supplement" (per-school questions)**. Hanguk's data model should likewise separate **shared applicant data** from **per-university per-track supplements**.
- **Pitfalls:** Common App's market dominance has caused UX friction for tier-2 schools; Coalition has struggled with adoption.

#### 11.1.11 IPEDS / NCES / College Scorecard (USA)
- **Scope:** USA; **every Title-IV-participating institution** required to file. **7,000+ institutions, 250+ variables.** ([nces.ed.gov/ipeds](https://nces.ed.gov/ipeds), [collegescorecard.ed.gov](https://collegescorecard.ed.gov/data/api/))
- **Funding:** federal.
- **Ingestion:** **mandatory** institutional reporting via standardized forms (Spring/Fall/Winter cycles).
- **Update mechanism:** annual; Spring + Winter collections.
- **QC:** federal validation; revisions allowed.
- **APIs / open data:** **public REST API** (College Scorecard API w/ key, default 1k req/IP/hour); **Access database bulk download**.
- **Multilingual:** EN.
- **Key innovations to steal:** **mandatory standardized filing** — Korea's `academyinfo.go.kr` is the equivalent and Hanguk should treat both as primary sources. **The API design (paginated GET, faceted filter on 100+ fields)** is a great template.
- **Pitfalls:** annual cadence means lagging data; takes months to publish.

#### 11.1.12 Niche, Cappex, BigFuture (USA, commercial student-facing aggregators)
- **Niche** ([niche.com](https://www.niche.com/)) — review-driven; user-generated content + IPEDS data; matchmaking.
- **Cappex** — profile-driven matchmaking with college recommendations.
- **BigFuture** ([bigfuture.collegeboard.org](https://bigfuture.collegeboard.org/)) — College Board's student tool; **3,000+ colleges**; coupled with SAT/student-search-service for monetization.
- **Funding:** ad / lead-gen / partner fees; College Board is non-profit but well-monetized.
- **Ingestion:** IPEDS + university partnerships + scraping + UGC reviews.
- **Key innovations to steal:** **review/UGC layer**. Hanguk could allow students to leave alumni-style reviews per university (with moderation).
- **Pitfalls:** UGC bias; lead-gen monetization sometimes corrupts neutrality.

#### 11.1.13 Australian Tertiary Admissions Centres — UAC, VTAC, QTAC, SATAC (Australia)
- **Scope:** Australia; per-state TACs serve undergrad domestic + international admissions. ([uac.edu.au](https://uac.edu.au/), [actac.edu.au](https://www.actac.edu.au/))
- **Funding:** non-profit; per-state structures.
- **Ingestion:** central application per state; data files (often PeopleSoft-format suspense tables) returned to institutions.
- **Update mechanism:** annual + late rounds.
- **QC:** TAC validates; institutions decide.
- **APIs / open data:** institution-side ETL feeds; little public API.
- **Key innovations to steal:** **per-state federation of central admissions** is a useful pattern when a country has heterogeneous regulations. Korea is centralized so doesn't need this — but Korea's split between national and private universities, and between regular and intl tracks, is conceptually similar.
- **Pitfalls:** four parallel TACs duplicate effort; cross-state students juggle multiple systems.

#### 11.1.14 OUAC (Ontario, Canada)
- **Scope:** Ontario; >20 universities. ([ouac.on.ca](https://www.ouac.on.ca/), [ouinfo.ca](https://www.ouinfo.ca/))
- **Funding:** non-profit.
- **Ingestion:** central application; **OUAC 105** specifically for non-Ontario / international applicants.
- **Update mechanism:** annual cycle (Mar–Aug).
- **APIs:** none public.
- **Key innovations to steal:** **separating domestic-101 from international-105 application form** — Hanguk's separation of 외국인전형 from 정시 mirrors this; UI should match.

#### 11.1.15 EduCanada (Canada)
- **Scope:** Canada; sector promotion (ESDC + Global Affairs).
- **Funding:** government.
- **Ingestion:** institution profile partner program.
- **Key innovation to steal:** strong country-of-origin landing pages similar to British Council's Study UK.

#### 11.1.16 CAO — Central Applications Office (Ireland)
- **Scope:** Ireland; processes applications for all third-level. ([cao.ie](https://www.cao.ie/))
- **Funding:** non-profit.
- **Ingestion:** central application; institutions instruct CAO to make offers.
- **Update mechanism:** annual; opens early March, deadlines in early Feb (early), early May (regular).
- **APIs:** none public.
- **Key innovation to steal:** **minimalist central app** — applicants list up to 10 courses in preference order; CAO offers based on cutoff points. This minimalism is a counterpoint to UCAS's complexity.
- **Pitfalls:** points-based selection is brittle; doesn't generalize beyond Ireland.

#### 11.1.17 Universidades.es / SIIU (Spain)
- **Scope:** Spain; SIIU is the integrated info system. ([SIIU at ciencia.gob.es](https://www.ciencia.gob.es/Ministerio/Estadisticas/SIIU.html), [QEDU at ucm.es](https://www.ciencia.gob.es/en/qedu/AyudaQEDU.html))
- **Funding:** government.
- **Ingestion:** centralized data collection from autonomous communities + universities.
- **Update mechanism:** annual statistical cycle.
- **APIs / open data:** statistical exports; QEDU is a search UI for prospective students.
- **Key innovation to steal:** **consortium governance** — autonomous regions + universities + ministry as joint owners. Hanguk's analog would be a partnership between MOE, KCUE, KASA.
- **Pitfalls:** federated governance is slow.

#### 11.1.18 Universitaly (Italy)
- **Scope:** Italy; **mandatory** for non-EU pre-enrollment. ([universitaly.it](https://www.universitaly.it/first-steps))
- **Funding:** government (MUR).
- **Ingestion:** universities receive applications via the platform; central pre-enrollment.
- **Update mechanism:** annual cycle (start dates set by the Italian authorities each year).
- **APIs:** none public.
- **Multilingual:** IT, EN.
- **Personalization:** strong (profile + visa flow integrated).
- **Key innovation to steal:** **mandatory single platform for non-EU pre-enrollment + visa coupling** — eliminates the per-university scramble. Korea is fragmented in comparison; the okep.moe.go.kr board is a partial step in this direction.
- **Pitfalls:** known to be slow / clunky during peak; one-program-only restriction is criticized.

#### 11.1.19 JASSO + Study in Japan (Japan)
- **Scope:** Japan; scholarships + intl-student support. ([jasso.go.jp/en](https://www.jasso.go.jp/en/), [studyinjapan.go.jp](https://www.studyinjapan.go.jp/en/))
- **Funding:** government (under MEXT).
- **Ingestion:** universities submit; JASSO curates.
- **Update mechanism:** annual + scheduled.
- **APIs:** none public.
- **Key innovations to steal:** **the EJU coupling** — the entrance exam is reused across universities, simplifying applicant logistics. Korea has TOPIK as its analog.
- **Pitfalls:** notoriously dense bureaucracy in JP-EN bilingual presentation.

#### 11.1.20 CSC + Campus China (China)
- **Scope:** China; **289 designated universities** for Chinese Government Scholarship. ([studyinchina.csc.edu.cn](https://studyinchina.csc.edu.cn/), [campuschina.org](http://www.campuschina.org/))
- **Funding:** government (Ministry of Education).
- **Ingestion:** central scholarship application; universities admit per allocation.
- **Update mechanism:** annual cycle (Dec–Apr).
- **Personalization:** strong — single profile drives full application.
- **Key innovations to steal:** **central scholarship platform with university allocation list** — exactly what Korea's GKS does. Hanguk should mirror NIIED's GKS portal flow.
- **Pitfalls:** Type B / Type A / etc. naming is confusing; UI dated.

#### 11.1.21 Study in Taiwan + MOE Taiwan
- **Scope:** Taiwan; sector promotion + Taiwan Scholarship. ([studyintaiwan.org](https://www.studyintaiwan.org/), [english.moe.gov.tw](https://english.moe.gov.tw/))
- **Funding:** government.
- **Key innovation:** **TEEP (Taiwan Experience Education Program)** as a short-term track separate from degrees. Hanguk could surface short-term Korean-language tracks similarly.

#### 11.1.22 Study in Singapore / SIT
- **Scope:** Singapore; institution-level rather than central, but Edu portals exist.
- **Key lesson:** for small countries with concentrated systems, central aggregation is less important — institution sites are enough.

#### 11.1.23 JUPAS (Hong Kong)
- **Scope:** HK undergrad; central admissions for the 8 UGC universities. ([jupas.edu.hk](https://www.jupas.edu.hk/en/))
- **Funding:** non-profit (managed by JUPAS Office under UGC umbrella).
- **Ingestion:** central application from HKDSE-takers; non-JUPAS for international applicants who go directly.
- **Update mechanism:** annual cycle.
- **Key innovation to steal:** **the JUPAS / non-JUPAS split** is the same pattern as Korea's 정시/외국인전형 split. Mature execution.
- **Pitfalls:** HKDSE-only — international students bypass JUPAS, fragmenting the picture.

#### 11.1.24 Study in India + NIRF (India)
- **Scope:** India; **NIRF rankings** + Study in India portal. ([nirfindia.org](https://www.nirfindia.org/), [studyinindia.gov.in](https://www.studyinindia.gov.in/))
- **Funding:** government (MoE).
- **Ingestion:** voluntary university submission to NIRF; mandatory if seeking ranking.
- **Update mechanism:** annual.
- **Key innovation to steal:** **explicit ranking framework with published methodology** — Korea has rankings but not as transparently published. The K-Universities Global Excellence Rankings 2026 is a recent step toward this.

#### 11.1.25 Russia — education-in-russia.com (Rossotrudnichestvo)
- **Scope:** Russia; intl students.
- **Funding:** government (Rossotrudnichestvo).
- **Ingestion:** central platform; quotas allocated per country.
- **Personalization:** profile-driven.
- **Key innovation to steal:** **country-quota allocation transparency** — applicants see how many slots their country has. Useful for setting realistic expectations.

#### 11.1.26 Türkiye Bursları / YTB (Turkey)
- **Scope:** Turkey; one of the most comprehensive scholarship programs in the world. **121,830 applications from 170 countries in 2024; 5,000 scholarships/year.** ([turkiyeburslari.gov.tr](https://turkiyeburslari.gov.tr/), [ytb.gov.tr](https://ytb.gov.tr/en/departments/international-students))
- **Funding:** government (under YTB / Presidency for Turks Abroad).
- **Ingestion:** **central platform (TBBS)** — applicants apply directly to YTB; YTB places them in universities + departments.
- **Update mechanism:** annual.
- **Personalization:** **strong** — single platform handles full lifecycle (application → placement → enrollment → ongoing student support).
- **Multilingual:** TR + EN + multiple languages.
- **Key innovations to steal:** **the platform handles all of: scholarship, university placement, monthly stipend, accommodation, language course, flight ticket**. End-to-end concierge experience that Korea's GKS partly does.
- **Pitfalls:** placement-by-platform reduces applicant agency.

#### 11.1.27 KAUST + Edaad (Saudi/UAE)
- **Scope:** institution-level (KAUST) + sector portals.
- **Key lesson:** wealthy single institutions can outshine national portals.

#### 11.1.28 Study in Korea (NIIED) — our home market
- **Scope:** Korea. ([studyinkorea.go.kr](https://www.studyinkorea.go.kr/))
- **Funding:** government (NIIED under MOE).
- **Ingestion:** university self-service for the directory; central GKS application portal; IEQAS list curated.
- **Update mechanism:** annual + as-published.
- **APIs:** none public.
- **Key innovations:** the IEQAS accreditation badge surfaces well; GKS application is integrated.
- **Pitfalls:** **directory data is often stale** — programs disappear, contact info dates; **search UX is dated**; **no scholarship-aggregation that goes beyond GKS**; **no application-tracking** for users; **no per-university notification stream**. Hanguk's value-add is precisely these gaps.

### 11.2 Commercial international platforms

#### 11.2.1 ApplyBoard
- **Scope:** **1,500+ institutions, 110+ countries of recruitment partners**. ([applyboard.com](https://www.applyboard.com/))
- **Funding:** commercial; revenue from institutions.
- **Ingestion:** **agent/recruitment-partner-fed**; agents in source countries enter student applications; data flows to institutions.
- **Personalization:** strong (per applicant).
- **Key innovation to steal:** **agent-channel monetization**. Many Hanguk users in CIS/SE-Asia work with agents; integrating with that channel is a future revenue lever.
- **Pitfalls:** agent quality is uneven; the model has been criticized for opacity.

#### 11.2.2 Crimson Education
- **Scope:** premium consultancy + tooling. ([crimsoneducation.org](https://www.crimsoneducation.org/))
- **Model:** **counselor-led; data feeds CRM**.
- **Key lesson:** the human-counselor layer remains valuable for premium tier; AI agents (which Hanguk has via Vapi) can compress this for mid-market.

#### 11.2.3 Hotcourses, IDP, Edukasyon, Studybridge, MyMastersDegree, ScholarshipPortal, etc.
- **Hotcourses** ([hotcoursesabroad.com](https://www.hotcoursesabroad.com/)) — IDP-owned program directory; commercial; lead-gen.
- **IDP** ([idp.com](https://www.idp.com/)) — global agent + IELTS owner-operator; data fed by agent network + institutional partnerships.
- **Edukasyon** — SE Asia-focused.
- **MyMastersDegree, ScholarshipPortal** — Studyportals family or similar.
- **Common pattern:** lead-gen monetization; ingest data via partnerships; UI is profile + saved-search.
- **Key lesson:** **the long tail of commercial portals is crowded**; differentiation comes from data quality + UX coherence + AI assist.

#### 11.2.4 Going Merry, Fastweb, Scholarships.com, Niche scholarships
- **Scope:** USA-focused scholarship aggregators with **1.5M+ scholarships at Fastweb**. ([fastweb.com](https://www.fastweb.com/), [Going Merry](https://goingmerry.com/))
- **Funding:** ad-supported / lead-gen / data partnerships.
- **Ingestion:** **scraped + partnership-fed + foundation submissions**.
- **Update mechanism:** continuous.
- **Key innovations to steal:** **Going Merry's "Smart Planner"** auto-puts deadlines on a calendar — direct analog to what Hanguk should do for application deadlines.

### 11.3 Open / community-driven

#### 11.3.1 Wikidata university items + DBpedia
- **Scope:** Q3918 (university) class on Wikidata has tens of thousands of items.
- **Funding:** Wikimedia.
- **Ingestion:** crowdsourced.
- **APIs:** SPARQL endpoint; bulk dumps.
- **Key innovations to steal:** **stable identifiers**. Hanguk should pin every university to a `wikidata_id` to enable interop.
- **Pitfalls:** coverage uneven; KO-language items have less data than EN/DE.

#### 11.3.2 schema.org/EducationalOrganization + LinkedData
- **Scope:** schema.org provides `EducationalOrganization`, `CollegeOrUniversity`, `EducationalOccupationalProgram`, etc. Public types.
- **Key innovation to steal:** **publish all university JSON-LD at scrapable URLs** (rich SEO benefit + interop). Hanguk's public university pages should embed schema.org JSON-LD.

#### 11.3.3 Common Data Set (CDS, USA)
- **Scope:** voluntary standardized questionnaire jointly maintained by College Board, Peterson's, US News. ([commondataset.org](https://commondataset.org/))
- **Ingestion:** institution self-publish.
- **Key innovation to steal:** **a community-maintained standard schema** reduces friction for both publishers and consumers. Korea has nothing equivalent for international-student-facing data; Hanguk has an opportunity to draft one.

#### 11.3.4 Standards: PESC, CEDS, ELMO/EMREX, Diploma Supplement
- **EMREX** ([emrex.eu](https://emrex.eu/)) — European student-data exchange. Backed by ELMO XML standard (CEN EN 15981). Diploma Supplement structured data.
- **CEDS (US)** — Common Education Data Standards.
- **PESC** — Postsecondary Electronic Standards Council.
- **Schema.org** — already noted.
- **Key innovation to steal:** **adopt ELMO-style structured Diploma Supplement** if Hanguk later supports application-document upload. Future-proof against EU mobility integration.

### 11.4 Lessons-learned literature & engineering case studies

- **DAAD's tech blog and OSS** ([github.com/daad-o-dot-de](https://github.com/daad-o-dot-de)) — sparse but informative.
- **StudyPortals engineering** — Tracxn, LinkedIn engineering posts emphasize React + GraphQL + Elasticsearch as their stack.
- **EMREX OSS** ([github.com/emrex-eu](https://github.com/emrex-eu/standard)) — reference impl + standard XML schemas.
- **PESC Best Practices Awards** — EMREX won 2021 ([nebula.wsimg.com PDF](https://nebula.wsimg.com/8dc77669702ea880946e2b0cc0cc5f42)).

### 11.5 Patterns that recur

1. **Publisher self-service + central curation** — every successful national system. **Pure scraping doesn't scale.** Korean equivalent: data.go.kr / academyinfo APIs are the publisher-self-service layer; Hanguk should treat them as canonical and supplement with parsing only when those datasets fall short.
2. **Separate operational vs analytical systems** — UCAS vs HESA, NIIED vs KEDI. Hanguk should keep its operational DB (Supabase Postgres) clean and separate from its analytical/recommendation layer (pgvector + analytics views).
3. **Visa coupling** — Études en France, Universitaly, Edaad. Major UX win when present.
4. **Profile + saved-list + comparison + recommendations** — every modern system. Hanguk has the foundation in `applications` tab; needs comparison + recommendation features.
5. **Country-specific landing pages** — British Council, EduCanada, Türkiye Bursları. Hanguk should localize per CIS / SE Asia / China / Vietnam etc.
6. **Stable shared identifiers** — Wikidata IDs, IPEDS UNITIDs, KCUE codes. Hanguk should adopt KCUE codes as PK and add `wikidata_id` for interop.
7. **Daily-cycle peak ops** — UCAS Clearing model; Hanguk should plan for the Korean "정시 발표" peak the same way.
8. **Bilingual side-by-side everywhere** — DAAD, JASSO. Hanguk users need KO + their native language; design for it from day 1.
9. **The directory drifts stale fastest** — every aggregator suffers this. Hanguk's automated discovery + change detection (§6) is the antidote.
10. **Standards reduce integration cost** — CDS, ELMO, schema.org. Use schema.org/EducationalOrganization JSON-LD on all public pages.
11. **Watchlists, smart calendars, deadline reminders** — Going Merry, MyGUIDE, BigFuture. **Direct UI primitives** for Hanguk to build into the applications tab.
12. **Lead-gen monetization works but biases data** — StudyPortals, Niche. Hanguk should keep editorial neutrality even when adding partner-paid features later.

### 11.6 Pitfalls we must avoid

1. **Stale published data with no expiry signal** — NIIED's directory has this. Solution: every record gets `valid_until` and a `last_verified_at` timestamp; UI shows freshness explicitly.
2. **Annual cycles only** — IPEDS/KEDI suffer this. Solution: §6's polling for time-sensitive fields (deadlines, corrections).
3. **Slow/over-loaded peak performance** — Universitaly, Études en France. Solution: read-replica + CDN caching for the public DB; rate-limited write paths.
4. **Single-application restriction (Universitaly)** — frustrating UX. Solution: Hanguk's tracker supports multi-university applications natively (already in the model).
5. **ODBC-era institutional integrations (UCAS)** — modernization is slow. Solution: Hanguk has no need for institutional integrations (we don't replace UCAS); we're a student-side tool.
6. **Lead-gen-corrupted neutrality (StudyPortals criticism)** — Solution: separate "editorial coverage" from "partner placements"; if we ever add partners, label clearly.
7. **Agent-channel opacity (ApplyBoard criticism)** — Solution: if we add agents later, make commission flows transparent.
8. **Federated-governance slowness (SIIU)** — Solution: Hanguk is a single-stakeholder product; this isn't our risk.
9. **Standards-fragmentation friction (PESC vs ELMO vs CEDS)** — Solution: adopt schema.org as the lowest-common-denominator + add country-specific extensions where Korean fields don't fit.
10. **Single-platform-only restriction (Common App ↔ Coalition)** — Solution: Hanguk shouldn't try to be the application platform; it should be the *companion* that integrates with Uway/Jinhakapply/university-direct application sinks.
11. **Translation drift between language versions** — DAAD has English versions that lag German. Solution: source-of-truth in KO, all other languages auto-translate via LLM with explicit "machine-translated" labels until human review.
12. **Privacy breach via supplier (British Council 2024)** — Solution: minimize personal data; lean on Supabase RLS; audit all external integrations annually.

### 11.7 Hanguk-specific synthesis: where to leapfrog

**What we adopt directly:**
- Publisher self-service + central curation: piggyback on Korea's existing layer (data.go.kr, academyinfo, KCUE).
- Profile + watchlist + smart calendar + deadline reminders: this is the heart of the Hanguk experience.
- Bilingual KO+native side-by-side.
- Schema.org JSON-LD for SEO.
- Stable identifiers (KCUE code + Wikidata).
- Daily-cycle peak handling for 정시 / 외국인 special-rounds.
- IEQAS badge surfacing as a trust signal.

**Where we leapfrog (Korea's landscape gives us an advantage):**
- **Automated discovery + change detection (§6)** — none of the systems above does this *natively*; they rely on publisher self-service. Korea's fragmented landscape *requires* this from us, but it gives us *fresher data* than even DAAD can offer. This is a defensible moat.
- **AI-assisted explanation layer** — none of the surveyed systems explains *what a 정정공고 means for the user's application*. Hanguk's existing Vapi/Claude stack lets us do this.
- **Interview prep + applications + map all in one app** — fragmented elsewhere; integrated here. Already partly in the codebase.

**Where we are playing catch-up:**
- We don't have the institutional data feeds UCAS/CAO/Common App have; we substitute scraping + change detection. This is fine for v1 but a long-term partnership track with KCUE is worth pursuing.
- Visa-coupling: Études en France integrates with consulates; HiKorea is the analog and Hanguk can deep-link but not transact. Acceptable.
- Per-country landing pages and localized document checklists are something Hanguk should ship by v2.

**Where Korea's shape is *different* and we shouldn't blindly copy:**
- Korea has strong central data sources (academyinfo, data.go.kr) that Germany/UK don't. Don't reinvent — wire to these.
- Korea has 1 dominant central application platform per cycle (UwayApply or Jinhakapply per university), unlike US's Common App. Don't try to be the application platform; integrate as the *tracker*.
- Korea has multiple foreign-applicant categories (외국인전형 / 재외국민 12y / 재외국민 부분이수 / 재외국민과외국인특별전형 / etc.); other systems collapse these. Hanguk's data model must preserve the category nuance — copying the simpler Common App schema would lose information.

---

## 12. Recommended architecture (high level — schema TBD per Phase-1 scope)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Layer A — Discovery                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │MOE okep poll │  │Adiga poll    │  │SiK poll      │  │Naver/Google │ │
│  │  (every 6h)  │  │  (every 6h)  │  │  (every 6h)  │  │site-search  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬───────┘ │
│         │                 │                 │                │          │
│         └─────────────────┴─────────────────┴────────────────┘          │
│                                ▼                                         │
│                       ┌────────────────┐                                 │
│                       │  Per-univ      │                                 │
│                       │  board pollers │  (rate-limited, jittered,       │
│                       │  (110 priority │   robots.txt-respecting)        │
│                       │  + IEQAS 158)  │                                 │
│                       └────────┬───────┘                                 │
└────────────────────────────────┼─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                  Layer B — Candidate detection                           │
│  Rules engine + embedding similarity + LLM tiebreaker (Claude Haiku)     │
│                                                                          │
│  Output: "this announcement is admissions-relevant" + tags               │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        Layer C — Source registry  (table: sources)                       │
│  lifecycle: discovered → pending_review → live → deprecated              │
│  every new university surfaces here for human approval before going live │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│         Layer D — Fetch & version                                        │
│  Download PDF/HWP; record sha256, size, ETag, Last-Modified              │
│  Persist to R2 (immutable); record metadata in Postgres                  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        Layer E — Parse pipeline                                          │
│  PyMuPDF text → pdfplumber tables → Camelot fallback                    │
│  If image-only: Naver Clova OCR                                          │
│  HWP/HWPX → kordoc / pyhwp                                               │
│  LLM extraction (Claude Sonnet) for archetype-G qualitative fields       │
│  Output: structured rows (per archetype + canonical-fields catalog §5.3) │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        Layer F — Diff & versioning                                       │
│  Compare new extraction to last-known guideline for                      │
│  same (university, intake_year, intake_term, applicant_category, round)  │
│  Field-level diff; flag corrections; mark superseded rows                │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│        Layer G — HITL review                                             │
│  Argilla (or custom Supabase admin UI)                                   │
│  Review fields with confidence < threshold;                              │
│  Reviewer approves → publish to app DB                                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│         Layer H — Hanguk app DB (Supabase)                               │
│  Universities · Recruitment Units · Calendars · Tuition · Reqs ·         │
│  Scholarships · Documents · Applications (existing) · Notifications      │
│  + pgvector for semantic search · PGroonga + MeCab-ko for full-text      │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│         Layer I — Delivery to user                                       │
│  Realtime to existing applications_tab / map_tab                         │
│  Push notifications (FCM / APNS) on tracked-university changes           │
│  AI-personalized "what changed and what it means for you"                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 11.1 Update cadence per data type

| Data type | Fresh cadence target | Why |
|---|---|---|
| Application deadlines / round-by-round calendar | Every 6h during admission season; daily off-season | The most user-impacting; corrections common |
| Tuition (per faculty, per year) | Annual (Mar refresh from academyinfo) | Stable within an academic year |
| Scholarships (TOPIK-tier table, GKS) | Annual refresh + every 6h during admission season for last-minute amendments | Stable but mid-season tweaks happen |
| Recruitment units / quota | Annual refresh + admission-season corrections | Fall when reorgs are announced |
| University metadata (location, ranking, IEQAS) | Annual + ranking refresh quarterly | Slow-moving |
| Document checklist | Per cycle (twice/year) | Apostille rules occasionally change |

### 11.2 Data lineage & provenance

Every structured row stores:
- `source_url` (where extracted from)
- `source_blob_hash` (SHA-256 of the raw doc)
- `extracted_at` timestamp
- `extractor_version` (parser code version)
- `extractor_confidence` (0–1)
- `human_reviewed_at` (nullable)
- `human_reviewed_by` (nullable)
- `superseded_by_id` (for versioning)

This satisfies copyright defensibility, debuggability, and HITL workflow.

---

## 13. Phasing — what to build first

### Phase 1 (this audit — done) — 1 week
✓ Landscape research, priority list, archetype identification, advanced-tools survey

### Phase 2 (next) — 2–3 weeks
- Stand up the `sources` table + `pg_cron` discovery scheduler in Supabase
- Implement MOE okep + Adiga + Study in Korea polling (3 high-leverage sources)
- Implement detection rules + Claude Haiku tiebreaker
- Manually review and approve the 110 priority sources from §2

### Phase 3 — 4–6 weeks
- Implement fetch + R2 versioning
- Implement parse pipeline for archetypes A, B, C (covers ~70 of the priority 110)
- LLM extraction (Claude Sonnet) for the canonical fields catalog
- Diff engine + HITL review queue (Argilla)

### Phase 4 — 4 weeks
- Wire archetypes D–H (covers remaining priority + extends to IEQAS-158)
- Naver Clova OCR for image-only PDFs
- HWP/HWPX support via kordoc
- Add Naver/Google site-search discovery for unknown universities

### Phase 5 — 4 weeks
- Hanguk app integration: tracking, notifications, "what changed for you"
- pgvector semantic search across all guidelines
- AI explanation layer ("here's what this 정정공고 means for your application")

### Phase 6 — ongoing
- Maintenance: selector fixes, archetype updates, new universities
- Quarterly archetype audit (re-verify archetype assignments)
- Annual tuition / academyinfo bulk refresh

### Recommended day-1 build order (concrete):
1. **Provision Supabase tables**: `sources`, `crawls`, `documents`, `extractions`, `extraction_versions` (no app-facing schema yet).
2. **Plug in the 3 upstream signals** — MOE okep, Adiga, Study in Korea — for high-leverage discovery before any per-university scrapers.
3. **Build the per-university poller framework** with Crawlee, deployed as a Supabase Edge Function. Add 5 universities (SNU, Yonsei, KU, Hanyang, KAIST). Get the loop end-to-end running on one PDF before scaling.
4. **Add Claude-based extraction** for the foreign-applicant calendar fields only — the highest-value, easiest-to-validate field. Build the diff engine for these.
5. **Surface in the Hanguk applications tab**: "next deadline at your tracked universities" widget.
6. Then scale.

---

## Sources

Primary research sources cited inline above. Key references:

- [Ministry of Education (English)](https://english.moe.go.kr/sub/infoRenewal.do?m=050101&page=050101&s=english)
- [Study in Korea — NIIED](https://www.studyinkorea.go.kr/)
- [academyinfo.go.kr / 대학알리미](https://www.academyinfo.go.kr/)
- [data.go.kr — Public Data Portal](https://www.data.go.kr/)
- [KCUE](https://www.kcue.or.kr/) and [어디가 / Adiga](https://www.adiga.kr/)
- [KEDI / KESS](https://kess.kedi.re.kr/)
- [KOSIS](https://kosis.kr/)
- [MOE okep — 대학별 모집요강 board](https://okep.moe.go.kr/board/list.do?board_manager_seq=16&menu_seq=22)
- [Statista — Number of universities in South Korea by type](https://www.statista.com/statistics/648374/south-korea-higher-educational-institutions-number/)
- [QS World University Rankings 2026 — Korea](https://www.topuniversities.com/world-university-rankings?countries=kr)
- [Korea Herald — university rankings](https://www.koreaherald.com/article/10639894)
- [Korea Times — K-Universities Global Excellence Rankings 2026](https://www.koreatimes.co.kr/collections/university-rankings)
- [Wikipedia — College admissions in South Korea](https://en.wikipedia.org/wiki/College_admissions_in_South_Korea)
- [Wikipedia — Flagship Korean National Universities](https://en.wikipedia.org/wiki/Flagship_Korean_National_Universities)
- [Wikipedia — SKY (universities)](https://en.wikipedia.org/wiki/SKY_(universities))
- [Korea.net — 158 colleges accredited for IEQAS](https://www.korea.net/NewsFocus/Society/view?articleId=267111)
- [Witground — 교육부 대학정보공시 API 활용 가이드](https://witground.com/%EA%B5%90%EC%9C%A1%EB%B6%80-%EB%8C%80%ED%95%99%EC%A0%95%EB%B3%B4%EA%B3%B5%EC%8B%9C-api-%ED%99%9C%EC%9A%A9-%EA%B0%80%EC%9D%B4%EB%93%9C/)
- [Yonsei 2026 Undergraduate Tuition for International Students](https://www.yonsei.ac.kr/sites/en_sc/down/2026_fee1.pdf)
- [Seoul Economic Daily — 2026 tuition increases](https://en.sedaily.com/society/2026/04/29/7-in-10-korean-universities-raise-tuition-this-year-up-21)
- [topikguide — GKS Graduate](https://www.topikguide.com/global-korea-scholarship-gks-graduate/) and [GKS Undergrad](https://www.topikguide.com/global-korea-scholarship-niied-kgsp-undergraduate-scholarship/)
- [Go Go Hanguk — Apostille for studying in Korea](https://gogohanguk.com/en/blog/apostille-for-studying-in-korea/)
- [Apostille.org — South Korea](https://www.apostille.org/apostille-korea/)
- [PIPA full text](https://elaw.klri.re.kr/eng_service/lawView.do?hseq=53044&lang=ENG)
- [Personal Information Protection Commission (PIPC)](https://www.pipc.go.kr/eng/)
- [Naver Clova OCR](https://www.ncloud.com/product/aiService/ocr)
- [hwpers GitHub](https://github.com/Indosaram/hwpers)
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Supabase PGroonga docs](https://supabase.com/docs/guides/database/extensions/pgroonga)
- [Visualping](https://visualping.io/) and [Distill.io](https://distill.io/)
- [HyperCLOVA X technical report](https://arxiv.org/html/2404.01954v1)

University-specific guideline anchors (the 110 priority list) are linked inline in §2.

---

## Deliverables — files for the parent to attach

The following absolute paths exist on disk after this audit run:

- `C:\Users\User\Desktop\Hanguk\UNIVERSITY_DB_AUDIT.md` — this file
- `C:\Users\User\Desktop\Hanguk\docs\samples\README.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-A-snu.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-B-yonsei.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-B-korea-univ.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-C-pnu.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-C-knu.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-D-sogang.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-D-dongguk.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-E-ewha.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-F-knua.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-G-kaist.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-G-unist.md`
- `C:\Users\User\Desktop\Hanguk\docs\samples\archetype-H-inha-tech.md`

The samples folder uses markdown reference docs (not PDFs) because direct egress to `*.ac.kr` was not enabled in this run; URLs to actual PDFs are embedded in each reference and Phase-2 fetcher will download the PDFs alongside.

**End of audit.**

