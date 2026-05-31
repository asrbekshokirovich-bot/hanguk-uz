# Archetype D — Sogang University (Jesuit-affiliated)

**Archetype:** D — Faith-affiliated / mid-private
**Anchor doc:** Sogang 2026 재외국민 모집요강
**Source URLs:**
- PDF: https://admission.sogang.ac.kr/upload/GUIDES/20250714173007QKEA64.pdf
- 자료실: https://admission.sogang.ac.kr/enter/html/abroad/data.asp
- 외국인전형 home: https://admission.sogang.ac.kr/enter/html/abroad/subMain.asp
- 공지사항: https://admission.sogang.ac.kr/enter/html/abroad/notice.asp
- 시행계획 2026: https://admission.sogang.ac.kr/upload/GUIDES/20240502093624F6QADL.pdf
- Application sink: applysogang@sogang.ac.kr · Tel +82-2-705-8118
**Announcement board:** https://admission.sogang.ac.kr/enter/html/abroad/notice.asp

## Predicted structure

- **Page count:** ~30–45 pages
- **File size:** ~2–3 MB
- **Languages:** KO-primary; some EN sections

### Section ordering
1. Cover + Mission statement (Jesuit context)
2. 일정 (calendar)
3. 자격 (eligibility) — applicants must be HS graduates with both parents foreign
4. 모집단위 (~9 colleges: 인문, 사회, 경제, 경영, 로욜라, 지식융합미디어, 자연과학, 공학, 소프트웨어융합)
5. 전형방법
6. 제출서류
7. 등록금 (tuition embedded)
8. 장학금
9. 기숙사
10. 부록

### Recruitment-unit table
- Granularity: 학부 / 학과 — quota per recruitment unit
- 9 colleges including specialized ones (Loyola College of Global Sciences, College of Knowledge and Data Engineering)

### Quota expression
- Numeric per recruitment unit
- 외국인전형 separate from 재외국민특별전형

### Tuition
- Embedded as small table per faculty group
- Private-university pricing (~5–6M KRW/semester for humanities; ~7M for engineering)

### Scholarships
- Sogang Loyola scholarship; merit-based
- TOPIK-tier waivers

### Footnotes
- Light

### Cross-references
- Graduate schools have separate guidelines

## Parser strategy

- Standard pdfplumber pipeline
- The mission statement is narrative — skip with classifier

## Verification checklist
- [ ] Page count 30–45
- [ ] 9 colleges listed
- [ ] Tuition embedded
- [ ] Calendar fits on one page

## Notes for §6 discovery
- Two boards: `admission.sogang.ac.kr/enter/html/abroad/notice.asp` (admissions) and `admission.sogang.ac.kr/enter/html/abroad/data.asp` (file repo)
- Both must be polled; data.asp is files-first ("자료실" pattern)
