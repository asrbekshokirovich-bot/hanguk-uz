# Archetype C — Pusan National University (PNU)

**Archetype:** C — Regional national plain table
**Anchor doc:** PNU 2026 Spring Graduate International Special Admission Guidelines
**Source URLs:**
- PDF: https://his.pusan.ac.kr/bbs/climate/8221/955291/download.do
- Undergrad PDF: https://international.pusan.ac.kr/bbs/international/2622/964787/download.do
- 2026 Spring Guidelines for New International Students: https://his.pusan.ac.kr/bbs/gsis/12665/969663/download.do
- OIA: https://international.pusan.ac.kr/
**Announcement boards:**
- https://international.pusan.ac.kr/bbs/international/2622/artclList.do
- https://his.pusan.ac.kr/

## Predicted structure

- **Page count:** ~40–50 pages
- **File size:** ~2–3 MB
- **Languages:** KO-primary; EN as separate slimmer file

### Section ordering
1. Cover + 목차
2. 일반사항 + 일정
3. 모집인원 (recruitment by college, dense table)
4. 자격 (eligibility per applicant category)
5. 제출서류 (documents)
6. 전형방법 (selection)
7. 등록금 (tuition, embedded)
8. 장학금 (scholarships)
9. 기숙사
10. 부록

### Recruitment-unit table
- Tightly packed black-and-white tables
- All ~13 colleges, including 인문대학, 사회과학대학, 자연과학대학, 공과대학, 약학대학, 의과대학, etc.
- Long department list (~150 recruitment units across both campuses)
- Numeric quotas

### Quota expression
- Numeric primarily, with select 약간명
- 정원외 explicitly marked

### Calendar
- Tabular; multiple footnote layers (도서관학과 추가시험 등)

### Tuition (embedded)
- Per-faculty table; national-univ tuition is significantly lower than private
- Engineering/Natural Sciences typically ~3–4M KRW/semester at national universities

### Scholarships
- KOSAF + university-internal + departmental
- 외국인 special scholarships explicitly listed

### Footnotes
- Heavy

### Cross-references
- Graduate vs Undergraduate vs 의예/치의예 separate

## Parser strategy

- `pdfplumber` lattice mode handles the tightly-packed tables well
- Footnote attribution: parse `※`-marked rows and link to parent quota row
- Volume of recruitment units (~150) is the main challenge — make sure pagination of tables is handled

## Verification checklist
- [ ] Page count 40–50
- [ ] Recruitment-unit count ~150
- [ ] Tuition embedded (not external file)
- [ ] Footnotes parseable

## Notes for §6 discovery
- PNU posts on `international.pusan.ac.kr/bbs/international/2622/...` and `his.pusan.ac.kr/bbs/...`
- Both boards must be polled
- Check robots.txt before scraping
