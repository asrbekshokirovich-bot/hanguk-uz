# Archetype B — Korea University (Seoul + Sejong)

**Archetype:** B — Top Seoul private brochure-style
**Anchor doc:** KU Fall 2026 Undergraduate Application Guide for International Students [Freshman]
**Source URLs:**
- EN PDF (Fall 2026): https://oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Freshman(ENG).pdf
- EN PDF (Fall 2026 Transfer): https://oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2026_Transfer(ENG).pdf
- OIA Admission Guide page: https://oia.korea.ac.kr/oia/under/admission.do
- KO 외국인전형 board: https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=700
- KU GSIS undergrad: https://int.korea.edu/kuis/under/admission.do
- Sejong campus 외국인특별전형: https://oku.korea.ac.kr/sejong/cms/FR_CON/index.do?MENU_ID=480
- OIA Tuition page: https://oia.korea.ac.kr/oia/under/Tuition.do
**Announcement boards:**
- OIA: https://oia.korea.ac.kr/
- 통합공지: https://oku.korea.ac.kr/oku/cms/FR_BBS_CON/BoardView.do?MENU_ID=750

## Predicted structure

- **Page count:** ~50–80 pages
- **File size:** ~3–5 MB
- **Languages:** Separate KO and EN documents typically

### Section ordering
1. Cover + Welcome from Office of International Affairs
2. Important dates summary
3. Eligibility per applicant category (외국인전형, 재외국민, etc.)
4. Application steps (Uway-foreign portal walkthrough)
5. Document requirements (per applicant category × country)
6. Recruitment units by 단과대학 (~19 colleges across 81 departments)
7. Selection method
8. Tuition (cross-referenced to OIA Tuition page; partial embed)
9. Scholarships
10. Dormitory
11. Appendices

### Recruitment-unit table
- 19 colleges including 의과대학, 경영대학, 정경대학, 보건과학대학, 과학기술대학, etc.
- 학과 granularity; ~81 departments
- Quota: 외국인전형 cap is **10% of total admission quota** per major; some uncapped

### Quota expression
- Numeric per major; cap rules cited explicitly
- Sejong campus separately listed

### Calendar
- Single tabular page; KO + EN parallel
- For Fall intake: April–May application; July–August results; August registration

### Tuition (cross-referenced)
- OIA Tuition page lists per-faculty tuition
- KU Graduate School separately ([graduate2.korea.ac.kr/admission/tuition.html](https://graduate2.korea.ac.kr/admission/tuition.html))

### Scholarships
- KU President's Scholarship
- KU OIA International Student Scholarship (tiered by TOPIK + GPA)
- GKS (KU is a participating university)

### Footnotes
- Moderate

### Cross-references
- KU GSIS = English-medium, separate guidelines
- Sejong campus separate
- KU CIS ([int.korea.edu/kuis](https://int.korea.edu/kuis/under/admission.do)) has another track

## Parser strategy

- `pdfplumber` for tables
- LLM only for documents-required section
- Tuition fetched separately from OIA Tuition page (HTML)

## Verification checklist
- [ ] Page count 50–80
- [ ] 외국인전형 cap (10%) cited
- [ ] Sejong campus pointer present (or absent if separate doc)
- [ ] Tuition cross-referenced rather than embedded

## Related rounds / docs
- 2026 2nd period for international: https://www.uakoreaedu.org/doc/2026%ED%95%99%EB%85%84%EB%8F%84%20%EC%A0%84%EB%B0%98%EA%B8%B0%202%EC%B0%A8%20%EC%88%9C%EC%88%98%EC%99%B8%EA%B5%AD%EC%9D%B8%EC%A0%84%ED%98%95%20%EB%AA%A8%EC%A7%91%EC%9A%94%EA%B0%95_ENG.pdf
- 2025 Fall freshman EN: https://oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Fall_2025_Freshman(ENG).pdf
- 2025 Spring KU GSIS: https://int.korea.edu/_res/kuis/etc/%5BSpring_2025%5D_Admission_Guideline_for_International_Applicants.pdf
