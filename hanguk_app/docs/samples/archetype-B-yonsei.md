# Archetype B — Yonsei University (Seoul Campus, foreign-applicant)

**Archetype:** B — Top Seoul private brochure-style
**Anchor doc:** Yonsei 2026 Fall Application Guide for International Students
**Source URLs:**
- EN PDF: https://www2.yonsei.ac.kr/entrance/2026/intl/2026_9_docu/Fall%202026%20Application%20Guide%20for%20International%20Students(Eng).pdf
- 2026 시행계획 (Seoul): https://www2.yonsei.ac.kr/entrance/plan/2026_plan.pdf
- 2026 시행계획 (Mirae): https://admission.yonsei.ac.kr/mirae/admission/data/2026_M_Plan.pdf
- 입학처 home: https://admission.yonsei.ac.kr/
- UIC admissions: https://uic.yonsei.ac.kr/main/admission.php
- GLC: https://eic.yonsei.ac.kr/eic_en/admission/eic_international.do
**Announcement board:** https://admission.yonsei.ac.kr/seoul/upload/notice/

## Predicted structure

- **Page count:** ~50–70 pages
- **File size:** ~3–4 MB
- **Languages:** EN-primary for the intl guide; KO-primary for 시행계획

### Section ordering
1. Cover + brand pages (5–8 pages)
2. About Yonsei + UIC/GLC short intro
3. Application overview + categories (International Student Admission, GLC, UIC tracks)
4. Eligibility per applicant category
5. Calendar (single tabular page near front)
6. 모집단위 by 단과대학 (College of Liberal Arts, Social Sciences, Engineering, Computing, Underwood International College, etc.)
7. Document requirements
8. Selection method per track
9. Tuition (per faculty, embedded; ~3–4 lines per faculty)
10. Scholarships (~3–5 pages)
11. Dormitory
12. Appendices (forms, contact info)

### Recruitment-unit table
- Organized by 단과대학; each row = `(학부 or 학과, quota, notes)`
- Numeric quotas with select 약간명 entries
- Color-coded cells in some tables (rare — observed in past cycles)

### Quota expression
- Numeric per recruitment unit
- Two parallel admission tracks: International Student Admission AND GLC International Student Admission — applicants choose one but only one program per track ([2026 Spring Underwood IC PDF](http://www2.yonsei.ac.kr/entrance/2026/transfer/2026_at_jfore_intl_docu/2026%20Spring%20Underwood%20International%20College%20Admissions%20Guide%20for%20International%20Transfer%20Student.pdf))

### Calendar
- Single tabular page; bilingual KO/EN side-by-side rows or two columns
- Application period typical: mid-October for Spring intake; beginning of April for Fall intake

### Tuition (embedded)
- Per [2026 fees PDF](https://www.yonsei.ac.kr/sites/en_sc/down/2026_fee1.pdf):
  - College of Liberal Arts / Theology: 4,770,000 KRW (sem 1) / 4,556,000 (sem 2-8)
  - College of Social Sciences: 4,556,000 (sem 2-8)
  - College of Engineering / Computing: 6,218,000 (sem 1) / 6,004,000 (sem 2-8)
  - School of Integrated Technology: 9,221,000 (sem 1) / 9,007,000 (sem 2-8)
- 입학금 typically ~1,000,000 KRW first semester

### Scholarships
- Yonsei University Scholarship for International Students (tiered by GPA / TOPIK)
- UIC scholarships (separate, more generous, 30–100% tuition)
- GKS

### Footnotes
- Moderate (2–4 per quota table)

### Cross-references
- UIC admission guide is a separate doc
- Mirae campus has its own 시행계획

## Parser strategy

- `pdfplumber` for the recruitment-unit and calendar tables
- LLM only for the prose-heavy "About Yonsei" and "About UIC" sections
- Tuition table is small; direct extraction via pdfplumber works

## Verification checklist
- [ ] Page count 50–70
- [ ] Calendar on a single page near the front
- [ ] Tuition table embedded (not external file)
- [ ] UIC track described separately from main International Student Admission
- [ ] GLC track described separately

## Related rounds / docs
- 2026 Spring intl undergrad: https://admission.yonsei.ac.kr/seoul/upload/guide/20250530163106YSYXAE.PDF
- 2026 GSIS Spring: https://gsis.yonsei.ac.kr/gsis/community/boards1_01.do?mode=download&articleNo=454680&attachNo=196415
- 2026 GSIS Fall: https://gsis.yonsei.ac.kr/gsis/community/boards1_01.do?mode=view&articleNo=465861
- Mirae plan: https://admission.yonsei.ac.kr/mirae/admission/data/2026_M_Plan.pdf
