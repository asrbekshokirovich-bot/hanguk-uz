# University Admissions Data Audit — 2026 cycle

**Date:** 2026-06-01
**Scope:** All 51 institutions in the database.
**Method:** (1) full inventory of what our DB holds per institution (source URLs, stored
documents + parse state, published content counts); (2) live verification against each
university's **official** international‑undergraduate admission guideline (외국인전형 모집요강),
finding the real current (2026학년도) URL and key facts; (3) per‑university discrepancy list.

> Facts below are only asserted where an official source was found and cited. Items marked
> **UNVERIFIED** could not be confirmed from an official page (often because the PDF blocked
> automated fetching) and must be checked manually before publishing.

---

## Part 1 — Systemic issues (found across many universities)

These are patterns, not one‑offs. Each is actionable at the pipeline level, not just per‑row.

1. **Stale guideline cycles.** We store guidelines years out of date and present them as
   current: Chodang **2017**, Dong‑A **2020**, Kyungsung **2022**, Konkuk‑Glocal **2023**,
   Hansei **2024**, plus a stale 2023 guide among Hanyang's docs. The current cycle is
   **2026학년도**. Root cause: documents are fetched once and never refreshed when a new
   cycle is published.

2. **The stored "document" is a navigation/notice page, not the guideline PDF.** Confirmed for
   **Korea University** (we stored `oku.korea.ac.kr` index pages; the real guideline is at
   `oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(ENG).pdf`),
   **KAIST** (3 copies of the HTML notice board), **Inha** (`MENU_ID=170` index repeated;
   real PDFs are `internationalcenter.inha.ac.kr/.../164765` & `164768`), and **Yonsei**
   (notice.asp listing). This is why these parse to little/no content.

3. **Wrong, department‑specific document.** **Kyung Hee** points at `sports.khu.ac.kr` — the
   *College of Physical Education* site, not the university‑wide guideline (real:
   `…/khu-bucket/…/2026_01_foreignerAdmission.pdf`). **Chungbuk** points at
   `software.cbnu.ac.kr` (Software college). These misrepresent the whole university.

4. **Corrupted institution names** (extracted from PDF body text instead of a name field):
   `일반대학` → **Pusan National** *and* **Sangji**; `학년도대학` → **Kunsan National**;
   `항공대` → **Korea Aerospace**; `한세대학` → **Hansei**; plus ~15 institutions with no
   English name at all.

5. **Duplicate institutions.** **Cheongju** = `cju.ac.kr` + `chongju.ac.kr`. **Konkuk** =
   `konkuk.ac.kr` (Seoul) + `kku.ac.kr` (Glocal/Chungju) — being confirmed as legitimately
   two campuses vs. a merge candidate.

6. **No document captured** (source page known, crawler never got a PDF): SNU, SKKU,
   Chung‑Ang, Kookmin, Konkuk(Seoul), Jeju, Jeonbuk, Kangwon.

7. **Stuck `pending`** (downloaded, never parsed — fixed in this PR's pipeline change, awaiting
   a reparse run): Dongguk, Hongik, Kyonggi, Chungbuk, Daejin, Daedong, Kyungwoon, Kunsan,
   Sangji, Hansei, Mokwon.

8. **Tuition empty for all 51.** Admission guidelines don't carry tuition (paid separately).
   Needs a dedicated source (data.go.kr/adiga or each school's 등록금 page). Not an extractor bug.

9. **Over‑counted `documents_required`.** Suspiciously high counts (Hanyang 35, Hanseo 32,
   Kyungdong 30, Korea Sport 30) suggest duplicated rows per cycle — verify dedup on publish.

10. **TOPIK‑not‑required schools must not be flagged as "missing".** KAIST (and other
    English‑track/English‑medium programs) legitimately require no TOPIK; `topik_min_level`
    being null there is correct, not a gap.

11. **Korean sites return HTTP 403 to non‑Korean IPs.** Every research agent independently hit
    this: `.ac.kr` servers block automated fetches from cloud/foreign IPs. This is the **root
    cause** of the "no document" tier (the crawler runs from cloud IPs) *and* of many "0 content"
    parses. Fix at the infra level: fetch via a **Korea‑based egress/proxy**, or mirror the PDF
    on first sighting.

12. **Multi‑campus universities are stored as one record.** Hanyang (Seoul/ERICA), Dongguk
    (Seoul/WISE‑Gyeongju), Yonsei (Seoul/Wonju), Hongik (Seoul/Sejong), Kyonggi (Suwon/Seoul),
    Kangwon (Chuncheon/Samcheok) each run **separate admissions with separate quotas**. Konkuk
    Seoul (`konkuk.ac.kr`) vs GLOCAL (`kku.ac.kr`) are correctly two records — keep them.

13. **외국인 (foreign‑national) vs 재외국민 (overseas‑Korean) tracks are conflated.** Some stored
    docs are the *overseas‑Korean* track (Myongji, SKKU source, KAU/KNSU bundle both). Our
    audience is **순수외국인 (pure foreign national)** — the wrong track has different eligibility.

14. **Institution type / visa eligibility isn't modeled.** Mixed into the "universities" list:
    a **cyber university** that legally can't sponsor a D‑2 visa (Hanyang Cyber), **vocational
    junior colleges** that grant associate (not bachelor) degrees (Dongnam Health, Daedong), a
    **theology‑only seminary** (ACTS), and **women‑only** schools (Ewha, Duksung, Dongduk).

15. **Rolling / multi‑round / two‑intake admissions aren't modeled.** Several schools admit
    multiple times a year (Chung‑Ang 4×/yr; Hansei/Dong‑eui/Dongduk rounds) or run both 전기/후기
    intakes — not the single annual cycle the schema assumes.

16. **Some guidelines are served in‑page (HTML), not as a PDF** (Kyungwoon, Mokwon) — these will
    keep parsing to nothing regardless of URL, and need an HTML‑extraction path or manual entry.

---

## Part 2 — Per‑university findings

### Hanyang University — hanyang.ac.kr
- **Official (2026):** Seoul Fall `oia.hanyang.ac.kr/files/attach/filebox/2026/01/22/84577760f898a555afede08054809e43.pdf`; Seoul Spring `…/2025/08/04/14f8068710c765a58446e85c800523dc.pdf`; ERICA Spring `…/2025/08/18/36944d37553575c58f60961f0348019c.pdf`. Hub: `oia.hanyang.ac.kr/admission`.
- **Cycle:** 2026 (Spring + Fall). **Names:** 한양대학교 / Hanyang University.
- **Facts:** Korean track TOPIK 3–4 (program‑dependent); English track (Business, Media, Data Science, Int'l Studies) TOEFL iBT 80 / IELTS 5.5, no TOPIK. Fall 2026: apply by **Mar 27 2026 17:00**, docs by **Apr 3 2026**. Scholarships: HIEA 30–100% + TOPIK L5/6 award. Tuition in guideline: UNVERIFIED.
- **Issues:** Two campuses (Seoul + ERICA) with separate guidelines — unclear which our 3 docs cover; **`2023_abroad_guide.pdf` is stale**; should store both campuses × both semesters (4 current PDFs). Confidence: high.

### Korea University — korea.ac.kr
- **Official (2026):** Fall EN `oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(ENG).pdf`; KOR variant alongside; landing `oia.korea.ac.kr/oia/under/admission.do`.
- **Cycle:** 2026 (Fall confirmed; Spring forms present). **Names:** 고려대학교 / Korea University.
- **Facts:** TOPIK **L3+** for Korean‑taught programs (TOPIK iBT accepted, 2‑yr validity); English‑track advancement TOEFL iBT 100 / IELTS 7.0. Apply by **Mar 27 2026**; Korean level test Apr 11 2026; tuition due early Jul 2026. Online via Uwayapply. Tuition in guideline: **No** (separate virtual account).
- **Issues:** **Our 7 docs are the `oku.korea.ac.kr` MENU_ID=700 index, wrong domain** — real is `oia.korea.ac.kr`; 0 documents_required is a real gap (guideline lists several). Confidence: high.

### KAIST — kaist.ac.kr
- **Official (2026):** portal `univapply.kaist.ac.kr/interapply/`; info `kaist.ac.kr/en/html/admission/0201.html`. (Notice board `admission.kaist.ac.kr/intl-undergraduate/notice` is not the PDF.)
- **Cycle:** 2026 (Spring Early; Fall Early + Regular). **Names:** 한국과학기술원 / Korea Advanced Institute of Science and Technology (KAIST).
- **Facts:** **TOPIK not required** (English‑medium). English: TOEFL iBT 83 / IELTS 6.5. Spring 2026 Early deadline **Oct 30 2025 17:00 KST**; Fall Regular ~**Jan 6 2026**. App fee **USD 80**. **All admitted int'l undergrads get full tuition × 8 semesters + ₩350k/mo** (GPA ≥ 2.7/4.3).
- **Issues:** **All 3 stored "docs" are the HTML notice board** — replace with the real guideline PDF. `topik=0` here is **correct** (do not flag). Confidence: high.

### Inha University — inha.ac.kr
- **Official (2026):** Spring `internationalcenter.inha.ac.kr/bbs/internationalcenter/2491/164765/download.do`; Fall `…/164768/download.do`; index `eng.inha.ac.kr/eng/3713/subview.do`.
- **Cycle:** 2026 (Spring + Fall). **Names:** 인하대학교 / Inha University.
- **Facts:** Korean track **TOPIK L3 at application, L4 to graduate**; English track IELTS 5.5 / TOEFL iBT 71. Scholarships by TOPIK: L6 100% / L5 50% / L4 30% / L3+English 30% + entrance‑fee waiver. Tuition in guideline: UNVERIFIED.
- **Issues:** **Our 10 docs are mostly the `MENU_ID=170` index repeated** → 4 pending + 1 failed because the parser hit HTML, not the PDFs. Replace with the two direct download URLs. Confidence: high.

### Kyung Hee University — khu.ac.kr
- **Official (2026):** Spring `kr.object.gov-ncloudstorage.com/khu-bucket/homepage/upload/notice/2026_01_foreignerAdmission.pdf`; portal `iadmission.khu.ac.kr/gglobalcenter/user/contents/view.do?menuNo=8000031`.
- **Cycle:** 2026 1학기 (Spring) confirmed. **Names:** 경희대학교 / Kyung Hee University.
- **Facts:** Korean track **TOPIK L3+** (L4+ improves odds + scholarship). Spring 2026 online apply **Dec 8–12 2025**; interviews ~Feb 23 / Apr 11 2026; tuition pay Jan 5–12 2026. Docs need notarization + apostille/consular. Tuition in guideline: **Yes** (schedule; amounts UNVERIFIED).
- **Issues:** **`sports.khu.ac.kr` is the College of Physical Education — wrong, department‑specific doc.** Delete & replace with `2026_01_foreignerAdmission.pdf`. 0 requirements is a parse failure from the wrong source. Confidence: high.

### Ewha Womans University — ewha.ac.kr
- **Official (2026):** Fall EN `isa.ewha.ac.kr/sites/oisa/file/ag_english.pdf`; KOR `…/ag_korean.pdf` (← the URL we store); landing `ewha.ac.kr/ewhaen/admission/admission.do`.
- **Cycle:** **2026학년도 전기** — our stored `ag_korean.pdf` title is "2026학년도 전기 외국인특별전형 모집요강", i.e. **current, not stale.** **Names:** 이화여자대학교 / Ewha Womans University.
- **Facts:** **TOPIK L4 before graduation** (all majors except Int'l Studies); **L3 to enter major courses**. Not an application prerequisite. Docs: apostille/consular auth; Chinese docs via CHSI. Tuition in guideline: UNVERIFIED.
- **Issues:** Stored doc is valid & current (good). Missing the **English** version (`ag_english.pdf`). **Women‑only admission — must be flagged** so male students aren't misled. Confidence: high.

### Myongji University — mju.ac.kr
- **Official (2026):** foreign‑national track `international.mju.ac.kr/foreign_application/application.php`; overseas‑Korean (재외국민) track `iphak.mju.ac.kr` (our stored `bn=29020` is the **재외국민** track). 2026 cycle confirmed to exist.
- **Names:** 명지대학교 / Myongji University.
- **Issues:** Likely documents the **재외국민 (overseas‑Korean)** track rather than the **외국인 (foreign‑national)** track our students need — different requirements; clarify/replace. TOPIK level not recorded. Confidence: med.

### Konyang University — konyang.ac.kr
- **Official (2026):** `ipsi.konyang.ac.kr/.../foreigner/list.do`; PDF `FileDown.do?atchFileId=FILE_000000000209596`; also 2026 추가모집 `FILE_000000000219273`.
- **Names:** 건양대학교 / Konyang University. **Facts:** bank balance USD 12,000 for D‑2; apostille/embassy cert. TOPIK: UNVERIFIED.
- **Issues:** Verify our stored FileDown ID is the **2026** file (may be older). Confidence: med.

### Cheongju University — cju.ac.kr  *(duplicate: chongju.ac.kr = legacy)*
- **Official (2026):** `cju.ac.kr/ipsi/contents.do?key=811`; current PDF **`cts811_file250619.pdf`** (uploaded 2025‑06‑19, "2026학년도 재외국민과 외국인 수시모집").
- **Names:** 청주대학교 / Cheongju University.
- **Issues:** **Confirmed duplicate — merge `chongju.ac.kr` (legacy) into `cju.ac.kr`.** Our stored `cts811_file.pdf` (no datestamp) is likely the **older** cycle; update to the datestamped 2026 file. Confidence: high.

### Duksung Women's University — duksung.ac.kr
- **Official (2026):** notice **bn=5306** ("2026학년도 재외국민과 외국인 특별전형"); file_no=839.
- **Names:** 덕성여자대학교 / Duksung Women's University. **Facts:** **TOPIK L3 for admission**; L4 to graduate from 2026‑2. **Women‑only.**
- **Issues:** **Our stored `bn=694` is STALE** — current is bn=5306. TOPIK‑3 admission not recorded; flag women‑only. Confidence: high.

### Gimcheon University — gimcheon.ac.kr
- **Official:** portal `ibhak.gimcheon.ac.kr`; **no 2026 foreign‑undergrad PDF found** (2024 Sept intake located; adiga lists 2026 data).
- **Names:** 김천대학교 / Gimcheon University. **Facts:** no hard TOPIK at entry — without TOPIK 3 must take on‑campus Korean; **KIIP L3 accepted**. Scholarships 유학장려 Ⅰ/Ⅱ/Ⅲ (matches our 3).
- **Issues:** Likely stale doc (cycle unknown); 2026 PDF unconfirmed. Confidence: low.

### Pusan National University — pusan.ac.kr
- **Official (2026):** **`international.pusan.ac.kr`** (국제처); Spring 2026 PDF `…/international/2622/964787/download.do`; Spring opened Oct 1 2025, Fall ~Apr 13 2026 via jinhakapply.
- **Names:** 부산대학교 / Pusan National University.
- **Issues:** **CRITICAL — our doc source `ie.pusan.ac.kr` is the *Industrial Engineering department*, not the university‑wide international office.** Replace with `international.pusan.ac.kr`. **Name corrupted ("일반대학").** TOPIK L3 min. Confidence: high.

### Dongnam Health University — dongnam.ac.kr
- **Official (2026):** `dongnam.ac.kr/bbs/ilec/243/37562` ("2026학년도 3월학기 외국인 특별전형 모집요강"); portal `ipsi.dongnam.ac.kr`.
- **Names:** 동남보건대학교 / Dongnam Health University. **Facts:** TOPIK **L2** for admission; TOPIK‑based first‑semester scholarship.
- **Issues:** **CRITICAL — this is a 전문대학 (2–3yr vocational junior college), not a 4‑year bachelor's university** (associate degree; bachelor only via +1yr 전공심화). Exclude or clearly label for a D‑2 bachelor audience. Confidence: high (type).

### Hanseo University — hanseo.ac.kr
- **Official (2026):** EN PDF `hseng.hanseo.ac.kr/theme/s007/file/Hanseo Admission Guide_2026.pdf` ("2026 Academic Year Admission Guidelines for Foreign Students"); KR `helper.hanseo.ac.kr/Upl/kr/hdbook/foreign_admission01.pdf`.
- **Names:** 한서대학교 / Hanseo University.
- **Issues:** Our 2 docs are **board posts (no=29772/26821), not the guideline PDF**; **32 documents_required = over‑parsed** (real ≈8–15). Cycle appears current. Confidence: med.

### Kyungdong University — kduniv.ac.kr
- **Official:** HTML index `kduniv.ac.kr/iphak/.../mCode=MN040` (our stored URL = the index page, not a PDF). 2026 not independently confirmed (2025 is the latest found). TOPIK L3.
- **Names:** 경동대학교 / Kyungdong University.
- **Issues:** Stored doc is the **HTML index, not the PDF**; cycle possibly stale (2025); **30 doc‑rows over‑parsed**. Confidence: med‑low.

### Korea National Sport University — knsu.ac.kr
- **Official (2026):** `knsu.ac.kr/ipsi/regular/application.do?...articleNo=53978` ("2026학년도 정시모집요강 '가'군 재외국민·외국인"); EN `knsu.ac.kr/eng/admission/foreign-applicants.do`.
- **Names:** 한국체육대학교 / Korea National Sport University.
- **Issues:** 53978 is current 2026 (good); **second stored doc `articleNo=41396` is an older cycle** (stale). Admission is bundled into 정시 '가'군 (not a standalone 외국인 수시). 30 doc‑rows over‑parsed. Confidence: med.

### Kumoh National Institute of Technology — kumoh.ac.kr
- **Official (2026):** PDF `eng.kumoh.ac.kr/iplec/sub060201.do?mode=download&articleNo=535700&attachNo=157212` ("2026학년도 전기 신입학 외국인 특별전형").
- **Names:** 국립금오공과대학교 / Kumoh National Institute of Technology. **Facts:** **App window VERIFIED Oct 2 2025 09:00 – Oct 31 2025 17:00**; docs need Korean‑consulate certification; doc review + oral interview; university‑wide (major assigned after entry).
- **Issues:** Our doc URL matches the current 2026 guideline (good); **26 doc‑rows over‑parsed**. Confidence: high.

### Korea Aerospace University — kau.ac.kr
- **Official (2026):** `ibhak.kau.ac.kr/admission/html/abroad/guide.asp` (covers 재외국민+외국인); 2026 PDF indexed ("2026학년도 한국항공대 재외국민과 외국인 특별전형 모집요강").
- **Names:** **한국항공대학교 / Korea Aerospace University** (not the old "Hankuk Aviation University").
- **Issues:** **CRITICAL — our stored name "항공대" is a corrupted abbreviation; fix to 한국항공대학교 / Korea Aerospace University.** Confidence: high (name).

### Hanyang Cyber University — hycu.ac.kr
- **Official (2026):** `go.hycu.ac.kr/user/nwAdms/go/foreigner/index.do`; PDF `hycu.ac.kr/.../2026 Spring Undergraduate Admission Guidelines.pdf`. TOPIK **L2**; apply Dec 1 2025 – Jan 15 2026.
- **Names:** 한양사이버대학교 / Hanyang Cyber University.
- **Issues:** **CRITICAL — 100% online 사이버대학; under Korean immigration policy cyber universities CANNOT sponsor a D‑2 student visa.** Inappropriate for a study‑abroad (visa‑track) audience — flag prominently or remove. Confidence: high.

### ACTS University (아신대학교) — acts.ac.kr
- **Official (2026):** `acts.ac.kr/admission/file/AdmissionGuide.pdf` ("2026학년도 신입생 모집요강" — generic filename but current); intl page lists TOPIK **L2** / TOEFL iBT 71 / IELTS 5.5.
- **Names:** 아신대학교 / ACTS University (formerly 아세아연합신학대학교).
- **Issues:** **Theology‑only seminary** — flag as a specialized religious institution. `0 documents_required` is a parse failure. Admission via Google Form + email (unusual). Confidence: med.

### Dongguk University — dongguk.ac.kr  *(two campuses)*
- **Official (2026):** WISE/Gyeongju `ipsi.dongguk.ac.kr/resources/files/foreigner_2026.pdf` (our URL = WISE campus); Seoul main `ipsi.dongguk.edu/admission/html/abroad/guide.asp` + `iadmission.dongguk.edu`. TOPIK L3 (Seoul).
- **Names:** 동국대학교(서울) / WISE캠퍼스(경주) — Dongguk University (Seoul) / WISE (Gyeongju).
- **Issues:** **Our doc is the WISE (Gyeongju) campus, not Seoul main — separate admission systems/quotas; need separate records.** Stored article `/341` is an older cycle (2026 notices are in the 108k–110k range). Confidence: med.

### Hongik University — hongik.ac.kr  *(Seoul + Sejong)*
- **Official (2026):** intl board `hongik.ac.kr/kr/admission/recruitment-is.do`; EN `…/en/admissions/admissions-guide.do`. TOPIK floor L1 (L4 exempts in‑house test; scholarships L4/5/6).
- **Names:** 홍익대학교 / Hongik University.
- **Issues:** **Our `articleNo=97369` is likely 2024 or earlier — 2026 ≈ `articleNo=137200`** (stale). Campus not specified. Confidence: med.

### Kyonggi University — kyonggi.ac.kr  *(Suwon + Seoul)*
- **Official (2026):** intl page `kyonggi.ac.kr/international_kgu/contents.do?key=7538`; our stored `key=7156` download may be a stale PDF. TOPIK **L4** general (L3 arts/PE); scholarships 20/40/50% for L4/5/6.
- **Names:** 경기대학교 / Kyonggi University.
- **Issues:** Stored download likely stale; **if our DB records TOPIK 3, that's wrong (L4 for most majors)**; campus not specified. Confidence: med.

### Chungbuk National University — cbnu.ac.kr
- **Official (2026):** `ipsi.chungbuk.ac.kr/kor/international/doctrine/view.do` + `oia.cbnu.ac.kr`. Spring 2026 apply **Jan 20–Feb 23 2026** (admit Mar 3); Fall **May 11–22 2026**. TOPIK **L4** for many majors.
- **Names:** 충북대학교 / Chungbuk National University.
- **Issues:** **CONFIRMED — our doc `software.cbnu.ac.kr` is the Software College (a department page), not the university‑wide guideline.** Replace with the ipsi/oia source. Confidence: high.

### Daedong University — daedong.ac.kr
- **Official:** admission `ipsi.daedong.ac.kr`; cycle UNVERIFIED.
- **Names:** 대동대학교 / Daedong University (Busan).
- **Issues:** **CONFIRMED 전문대학 (private vocational junior college) — mostly 2–3yr associate programs; only nursing is 4yr.** Flag/recategorize for a bachelor's‑degree audience. Confidence: high (type).

### Daejin University — daejin.ac.kr
- **Official (2026):** `daejin.ac.kr/bbs/abroad/1709/329325/download.do`; our `/189/321096/` sorts below the 2025‑Spring file (324029) → **likely the 2024 cycle**. TOPIK **L3 admission**, L4 to graduate; scholarships L6=100/L5=70/L3‑4=50%; English alt TOEFL iBT 71 / IELTS 5.5.
- **Names:** 대진대학교 / Daejin University (Pocheon).
- **Issues:** Stored doc stale (~2024); update to current. Confidence: med‑high.

### Hanbat National University — hanbat.ac.kr
- **Official (2026):** `hanbat.ac.kr/thumbnail/dwld/admission/2026_international.pdf`; page `…/admission/sub04_010102.do`. TOPIK **L3** (some depts accept L2 + 300hr Korean training); Social‑Integration L3 / Sejong Intermediate‑1 waiver; ~20% scholarship for TOPIK 3+.
- **Names:** 한밭대학교 / Hanbat National University.
- **Issues:** Our DB has only 2 periods, **0 requirements, 0 scholarships — gaps**; both Spring + Fall cycles exist. Confidence: med.

### Gyeongsang National University — gnu.ac.kr
- **Official:** page `gnu.ac.kr/international/...cntntsId=4367`; 2025 verified, 2026 unconfirmed. TOPIK **L3** (L2 arts/PE; Sejong Intermediate‑1 alt). Spring apply **Nov 1–15**. **Tuition ~KRW 1.63–2.21M/yr is actually stated** (national uni).
- **Names:** 경상국립대학교 / Gyeongsang National University.
- **Issues:** 0 requirements (gap); stored `nttSn=104493` may be a notice page, not the PDF; **tuition IS extractable here** — counterexample to the "guidelines never carry tuition" rule for national universities. Confidence: high (dates).

### Cheongju University (legacy) — chongju.ac.kr → merge into cju.ac.kr
- **Official (2026):** `cju.ac.kr/DATA/download/ipsi/cts811_file250619.pdf`; apply **Jul 7–11 2025** for the 2026 수시.
- **Names:** 청주대학교 / Cheongju University.
- **Issues:** **CONFIRMED duplicate of `cju.ac.kr` (chongju = legacy Wade‑Giles alias serving the same site) — merge.** Confidence: high.

### Halla University — halla.ac.kr
- **Official:** `ipsi.halla.ac.kr/abroad/abroad01.php`; 2026 PDF `…/2026_aboard_Eng.pdf` (blocked). TOPIK **UNVERIFIED — do not populate.**
- **Names:** 한라대학교 / Halla University (Wonju) — **distinct from 제주한라대학교 / Cheju Halla (chu.ac.kr).**
- **Issues:** Don't assert TOPIK without the PDF; verify it isn't confused with Cheju Halla. Confidence: low.

### Seoul National University — snu.ac.kr
- **Official (2026):** hub `en.snu.ac.kr/admission/undergraduate/application`; Fall notice `bbsidx=164704`, Spring `bbsidx=155596`. TOPIK **L3** (or TOEFL iBT 80 / IELTS 6.0). **Fall 2026 apply Mar 3–5 2026 (3‑day window!)**; Spring 2026 Jul 7–10 2025. Global Talent Scholarship.
- **Names:** 서울대학교 / Seoul National University.
- **Issues:** **No doc captured though a clear official guide exists** — add the `en.snu.ac.kr` guides; surface the ultra‑short 3‑day window. Confidence: high.

### Sungkyunkwan University — skku.edu
- **Official (2026):** foreign‑national portal **`admission-global.skku.edu`** (our stored `admission.skku.edu/.../abroad` is the **재외국민** track — wrong track). TOPIK **L3** (L4 some depts; provisional acceptance without TOPIK, L4 within 2yr). Language scholarships TOPIK 6=100% / 5=50%.
- **Names:** 성균관대학교 / Sungkyunkwan University.
- **Issues:** **No doc; and our source points at the 재외국민 (overseas‑Korean) track, not 외국인** — use admission‑global. Confidence: med‑high.

### Yonsei University — yonsei.ac.kr  *(Seoul + Wonju; UIC separate)*
- **Official (2026):** Fall 2026 PDF `www2.yonsei.ac.kr/entrance/2026/intl/2026_9_docu/Fall 2026 Application Guide for International Students(Eng).pdf`; portal `iadmission.yonsei.ac.kr`. TOPIK **L4** standard (GLC/GBED enter lower, L3 to declare major; SKA 321+ alt). UIC = English‑taught, no TOPIK.
- **Names:** 연세대학교 / Yonsei University; 언더우드국제대학 / UIC.
- **Issues:** **CONFIRMED our 3 docs are HTML listing pages (Seoul+Wonju notice.asp) → 0 content** — replace with the real Fall 2026 PDF; our DB TOPIK should be **L4 not L3**; Wonju + UIC are separate. Confidence: high.

### Chung-Ang University — cau.ac.kr
- **Official (2026):** 순수외국인 board `oia.cau.ac.kr/bbs/board.php?tbl=k_bbs61` (2026 전반기 1차 = num=353); 재외국민 PDF on `admission.cau.ac.kr`. **Rolling 4×/year.** TOPIK **L4** (L3 design/arts).
- **Names:** 중앙대학교 / Chung-Ang University.
- **Issues:** Our board `bbs61` is the correct (순수외국인) board. CAU has two tracks (외국인 vs 재외국민) and **rolls 4×/year — no single annual PDF**; model accordingly. No doc currently captured. Confidence: high.

### Konkuk University (Seoul) — konkuk.ac.kr  *(NOT a duplicate of kku.ac.kr)*
- **Official (2026):** `enter.konkuk.ac.kr` 2026 PDF (Seoul+GLOCAL combined); EN `konkuk.ac.kr/sites/ciss/files/250814_Spring…eng.pdf`. TOPIK **L3** (L2 + 300hr; L4 to graduate; 30% scholarship L3/4/5).
- **Names:** 건국대학교(서울캠퍼스) / Konkuk University (Seoul Campus).
- **Issues:** **CONFIRMED — konkuk.ac.kr (Seoul) and kku.ac.kr (GLOCAL/Chungju) are two legitimate campuses, NOT duplicates; keep both** (disambiguate names). No doc captured. Confidence: high.

### Kookmin University — kookmin.ac.kr
- **Official (2026):** active hub **`iat.kookmin.ac.kr/admission/apply/freshman`** (our stored `admission.kookmin.ac.kr` is the older domain). TOPIK **L4** or equivalent (language‑center completion / KU test); KIBS English‑taught (TOEFL 80 / IELTS 5.5).
- **Names:** 국민대학교 / Kookmin University.
- **Issues:** No doc captured; source domain outdated → add `iat.kookmin.ac.kr`. TOPIK has multiple equivalent pathways (don't oversimplify). Confidence: med.

### Jeju National University — jejunu.ac.kr
- **Official (2026):** PDF `ibsi.jejunu.ac.kr/files/ibsi/menu/202507/…pdf` ("2026학년도 재외국민과 외국인 특별전형"); page `ibsi.jejunu.ac.kr/10000048` (our source — correct page, but the PDF was never fetched). TOPIK **L3** (L4 for 무역/컴퓨터공학/데이터사이언스).
- **Names:** 제주대학교 / Jeju National University.
- **Issues:** **No doc captured though the 2026 PDF exists** — add the direct PDF URL. Confidence: high.

### Jeonbuk National University — jbnu.ac.kr
- **Official (2026):** intl `ioffice.jbnu.ac.kr/sites/ioffice/file/2-2 Korean.pdf`; board `jbnu.ac.kr/web/Board/…` (our `enter.jbnu.ac.kr` is the domestic portal). TOPIK **L2** (lowest tier; +2 semesters Korean if only L2). Both 전기/후기.
- **Names:** 전북대학교 / Jeonbuk National University (formerly "Chonbuk").
- **Issues:** No doc; our source is the domestic portal → add ioffice/board. **TOPIK is L2 — do not record as 3/4.** Confidence: high.

### Kangwon National University — kangwon.ac.kr  *(Chuncheon + Samcheok)*
- **Official (2026):** intl `oiaknu.kangwon.ac.kr` (our `admission.kangwon.ac.kr?bbsNo=373` is the domestic board); apply via `ipsi1.uwayapply.com/foreign/oiaknu`. TOPIK **L3** (KNU Korean L4 alt; ~35% reduction).
- **Names:** 강원대학교 / Kangwon National University.
- **Issues:** No doc; our source is domestic → add oiaknu. Two campuses + 3 language tracks (Global Convergence). Confidence: med.

### Dong-A University — donga.ac.kr
- **Official (2026):** rolling intl via `global.donga.ac.kr/…mCode=MN036`; portal `applydonga.accomsystem.co.kr`. Scholarships TOPIK 5=100/4=60/3=50%.
- **Names:** 동아대학교 / Dong-A University.
- **Issues:** **Our doc is a 2020 PDF (6yr stale).** **CRITICAL — the 재외국민·외국인 특별전형 is suspended ("미시행") for 2024–2026**; the live route is rolling recruitment via the International Office (global.donga.ac.kr), a different mechanism. Confidence: med.

### Kyungsung University — ks.ac.kr
- **Official (2026):** hub `kscms.ks.ac.kr/ia/…mCode=MN056`; Spring 2026 PDF `…/2025/9/XKSAERZhmp9MevrZLDMi.pdf`; Fall 2026 `…/2026/3/puy9…pdf`. Korean track (300hr if <L3, L4 to graduate; scholarship L4=50/L3=40%); English track IELTS 5.5 / iBT 71 (no TOPIK). Spring 2026 apply **Mar 31–Apr 27 2026** via studyinkorea.go.kr.
- **Names:** 경성대학교 / Kyungsung University.
- **Issues:** **Our doc is a 2022 PDF (4yr stale), 0 content** — replace with 2026 PDFs; add the two‑track + English‑track structure. Confidence: high.

### Dong-eui University — deu.ac.kr
- **Official (2026):** intl `deuhome.deu.ac.kr/exchange/…articleNo=76282` (Spring 2026 2nd round); Fall notice articleNo=82801; portal `ipsi.deu.ac.kr`. Spring 2026 2nd round apply **Oct 22–Dec 12 2025**. TOPIK settlement scholarship ₩500k/sem.
- **Names:** 동의대학교 / Dong-eui University.
- **Issues:** Our `articleNo=39089` is an old round → current is 76282; multiple rounds/year. Confidence: med.

### Daegu Catholic University — cu.ac.kr
- **Official (2026):** `ibsi.cu.ac.kr` (2026 재외국민 plan at `…/BBSMSTR_000000000084/13514/view.do`); MOE mirror on okep.moe.go.kr.
- **Names:** 대구가톨릭대학교 / Daegu Catholic University.
- **Issues:** **`cu.ac.kr` is correct and is NOT the Catholic University of Korea (catholic.ac.kr) — distinct institutions; don't conflate.** Undergraduate TOPIK/docs UNVERIFIED (only graduate docs reachable). Our doc parsed to 0 content. Confidence: med.

### Dongduk Women's University — dongduk.ac.kr
- **Official (2026):** foreign admission via **`intl2.dongduk.ac.kr/page/page23`** (our `ipsi.dongduk.ac.kr` is the wrong subdomain); Spring 2026 2nd‑additional doc deadline **Jan 8 2026**. Both‑parents‑foreign track.
- **Names:** 동덕여자대학교 / Dongduk Women's University. **Women‑only.**
- **Issues:** **Wrong subdomain (ipsi → should be intl2); 0 content.** Multiple rounds/year; flag women‑only. Confidence: med.

### Konkuk University GLOCAL Campus — kku.ac.kr  *(distinct from Seoul)*
- **Official (2026):** `enter.kku.ac.kr/notice/?m_type=JEOEGUK` (2026 수시 재외국민·외국인, bn=6213). TOPIK **L3** (30–100% scholarship).
- **Names:** **건국대학교 글로컬캠퍼스 / Konkuk University GLOCAL Campus** (Chungju) — distinct from Seoul (konkuk.ac.kr).
- **Issues:** **Our doc is a 2023 PDF (stale); stored name "건국대학교" lacks "글로컬캠퍼스" and has no English.** Disambiguate from Seoul. Confidence: high.

### Kyungwoon University — ikw.ac.kr
- **Official:** intl pages `ikw.ac.kr/worldleeng/page/5374/4278.tc` (EN) & `ikw.ac.kr/ipsi/...` — guideline served **in‑page (no downloadable PDF)**; 2026 unconfirmed. TOPIK **L3** (English track TOEFL 71 / IELTS 5.5, only Business & CS); apostille required.
- **Names:** 경운대학교 / Kyungwoon University (correct).
- **Issues:** 0 content because the guideline is **in‑page HTML, not a PDF** (will keep resisting the parser). Confidence: med.

### Kunsan National University — kunsan.ac.kr
- **Official (2026):** Spring PDF `kunsan.ac.kr/board/download.kunsan?...dataSid=1361608` ("2026 Spring PROSPECTUS for Int'l Undergraduate Admission"); hub `kunsan.ac.kr/inter/`. TOPIK ~L4 (below L4 → Korean training); app fee KRW 50k.
- **Names:** **국립군산대학교 / Kunsan National University** (national).
- **Issues:** **Name corrupted ("학년도대학") → fix to 국립군산대학교.** 2026 PDF exists — update URL. Confidence: high.

### Sangji University — sangji.ac.kr
- **Official (2026):** EN PDF `sangji.ac.kr/thumbnail/pdf/CMS_202508290136329541.pdf` ("2026 Sangji University Application Guide for International…"); KO PDF + page `sangji.ac.kr/go/sub05_01.do`. TOPIK **L3** (L2 arts/PE).
- **Names:** **상지대학교 / Sangji University.**
- **Issues:** **Name corrupted ("일반대학") → fix to 상지대학교.** 2026 multi‑language PDFs exist — update URL. Confidence: high.

### Hansei University — hansei.ac.kr
- **Official (2026):** `hsiec.hansei.ac.kr/upload_rb/AX_1112656110.pdf` (1차), `…AX_1385804506.pdf` (3차); hub `hsiec.hansei.ac.kr/sub03/sub03_1.html`. TOPIK **L4** (L3 K‑arts; 사회통합 L4 / Sejong Intermediate‑2 alt). Round 1 apply Sept 29–Oct 31 2025; rolling rounds.
- **Names:** **한세대학교 / Hansei University.**
- **Issues:** **Name corrupted ("한세대학") → fix to 한세대학교.** Our `admission2024.pdf` is stale → replace with the 2026 PDFs. Foreign admission lives on the `hsiec.` subdomain. Confidence: high.

### Mokwon University — mokwon.ac.kr
- **Official (2026):** page `enter.mokwon.ac.kr/enter/html/sub05/0501.html` (부모모두 외국인 전기 신·편입학); PDF not publicly indexed (likely in‑page/archive). TOPIK **L3** (L2 arts/PE). Global Convergence = English track.
- **Names:** 목원대학교 / Mokwon University (correct).
- **Issues:** 0 content; the PDF isn't directly indexed (in‑page). Confidence: med.

### Chodang University — cdu.ac.kr
- **Official:** portals `admission.cdu.ac.kr`, `ipsi.cdu.ac.kr`, intl `dis.cdu.ac.kr`; **no current foreign‑student guideline PDF publicly indexed** (most recent is 2017–18). University still operates (Muan, ~4,300 students). TOPIK UNVERIFIED.
- **Names:** 초당대학교 / Chodang University (correct).
- **Issues:** **Our doc is the 2017 guidebook (9yr stale) — almost certainly broken.** Flag for manual retrieval from `admission.cdu.ac.kr`. Confidence: low.

---

## Part 3 — Prioritized action plan

### P0 — Student‑safety / correctness (do first)
1. **Flag or remove institutions that don't fit a D‑2 bachelor audience:** **Hanyang Cyber** (online 사이버대학 — *cannot sponsor a D‑2 visa*; remove or hard‑flag); **Dongnam Health** & **Daedong** (전문대학, 2–3yr associate degrees — recategorize/label); **ACTS** (theology‑only seminary — label specialized).
2. **Mark women‑only universities** so male students aren't shown them: **Ewha, Duksung, Dongduk.**
3. **Replace wrong, department‑specific documents:** **Kyung Hee** (sports dept → university‑wide PDF), **Chungbuk** (software college → ipsi/oia), **Pusan** (Industrial‑Engineering dept → international.pusan).
4. **Dong‑A:** the 재외국민·외국인 특별전형 is **suspended 2024–2026** — don't present it as active; point to the rolling International‑Office route.

### P1 — Fix corrupted identity & structure
5. **Rename corrupted institutions:** 일반대학→**부산대학교** (Pusan), 일반대학→**상지대학교** (Sangji), 학년도대학→**국립군산대학교** (Kunsan), 한세대학→**한세대학교** (Hansei), 항공대→**한국항공대학교 / Korea Aerospace University**; backfill the ~15 missing English names.
6. **Merge the duplicate:** Cheongju — fold `chongju.ac.kr` (legacy alias) into `cju.ac.kr`. *(Keep Konkuk Seoul + GLOCAL separate — they are real, distinct campuses; just disambiguate the names.)*
7. **Split multi‑campus where admission differs:** Hanyang (Seoul/ERICA), Dongguk (Seoul/WISE), Yonsei (Seoul/Wonju), Hongik (Seoul/Sejong), Kyonggi (Suwon/Seoul).

### P2 — Fix the documents (replace nav pages / stale / wrong‑track with the real current PDFs)
8. **Replace nav‑page "documents" with the real 2026 PDFs:** Korea Univ (`oia.korea.ac.kr`), KAIST (`univapply`), Inha (`internationalcenter…/164765` & `164768`), Yonsei (`www2.yonsei…Fall 2026` PDF).
9. **Refresh stale guidelines:** Chodang (2017), Dong‑A (2020), Kyungsung (2022), Konkuk‑GLOCAL (2023), Hansei (2024), Hanyang (2023 doc); update changed post IDs: Duksung (bn 694→5306), Daejin (~2024→2026), Hongik (97369→137200), Cheongju (→ datestamped 2026 file).
10. **Point national‑university sources at the *international* office, not the domestic board:** Jeonbuk (`ioffice.jbnu`), Kangwon (`oiaknu`), Kookmin (`iat.kookmin`), SKKU (`admission-global`, not the 재외국민 track).
11. **Capture the missing PDFs now that URLs are known** (no‑doc tier): SNU, SKKU, Jeju (`…/202507/…pdf`), Chung‑Ang, Konkuk, Kangwon, Jeonbuk.

### P3 — Pipeline / root‑cause (so this doesn't recur)
12. **Korean sites return HTTP 403 to non‑Korean IPs** — the root cause of *both* the "no document" tier *and* many "0 content" parses. The crawler must fetch via a **Korea‑based egress (proxy)** or mirror PDFs at first sighting. *(Highest‑leverage infra fix.)*
13. **Distinguish 외국인 (foreign‑national) vs 재외국민 (overseas‑Korean) tracks** — several stored docs are the wrong track (Myongji, SKKU, KAU/KNSU bundle both). Our audience is 순수외국인.
14. **Model rolling / multi‑round and two‑intake (전기/후기) admissions** (CAU 4×/yr; Hansei/Dong‑eui/Dongduk rounds) instead of a single annual cycle.
15. **De‑dup `documents_required`** (Hanyang 35, Hanseo 32, Kyungdong 30, Korea Sport 30 are over‑counted).
16. **Don't flag null TOPIK as "missing" for English‑medium/English‑track** programs (KAIST, UIC, KIBS, etc.).
17. **Tuition:** usually not in guidelines, but **national universities (e.g., GNU ≈ ₩1.6–2.2M/yr) do list it** — add a tuition source (data.go.kr/adiga + national‑uni guideline tables).

> **Verification caveat:** Korean `.ac.kr` PDFs blocked automated fetching (403), so the TOPIK levels, dates, and document lists above come from official‑site **search snippets + cached titles**, not full PDF reads. Cycle years, official URLs, campus identities, institution types, and name corrections are high‑confidence; specific facts marked UNVERIFIED need a final read once the PDFs are fetched from a Korean IP.
