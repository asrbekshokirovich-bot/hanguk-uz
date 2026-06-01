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

<!-- AUDIT-APPEND-MARKER: further batches appended below as agents complete -->
