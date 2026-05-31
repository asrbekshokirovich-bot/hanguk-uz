# Archetype A — Seoul National University (SNU)

**Archetype:** A — SNU flagship
**Anchor doc:** SNU 2026 Spring Undergraduate Admissions Guide for International Students
**Source URLs:**
- KO: https://admission.snu.ac.kr/international/undergraduate/spring/guide
- KO PDF: https://admission.snu.ac.kr/webdata/admission/files/2026Spring_under.pdf
- EN PDF: https://en.snu.ac.kr/webdata/uploads/eng/file/2026/01/Admissions_for_Undergraduate_Spring_2026.pdf
- EN page: https://en.snu.ac.kr/admission/overview/notice?md=v&bbsidx=155596
**Announcement board (for §6 discovery):** https://admission.snu.ac.kr/international/notice ([EN](https://en.snu.ac.kr/admission/overview/notice))

## Predicted structure

- **Page count:** ~80–100 pages (KO + EN bilingual or KO-only with parallel EN file)
- **File size:** ~3–6 MB
- **Languages:** KO + EN (parallel separate docs typical)

### Section ordering (predicted)
1. Cover + 목차 (table of contents)
2. 일반사항 (general info) — applicant categories, eligibility, important dates summary
3. 모집인원 / 모집단위 (recruitment units & quotas) — by 단과대학 (16 colleges), 학부, 학과
4. 전형방법 (selection method)
5. 지원자격 (qualifications) per applicant category
6. 제출서류 (documents) per applicant category
7. 일정 (timeline) — application, document, interview, results, registration
8. 등록 (registration & fees)
9. 장학금 (scholarships) — institutional, GKS, foundation
10. 기숙사 (dormitory)
11. 입학취소 (admission cancellation)
12. 부록 (appendices) — sample forms, country-specific document tables, contact info

### Recruitment-unit table format (predicted)
- Hierarchy: 단과대학 → 학부/학과 → (모집단위 ID, 모집인원, 비고)
- 16 colleges: 인문대학, 사회과학대학, 자연과학대학, 간호대학, 경영대학, 공과대학, 농업생명과학대학, 미술대학, 사범대학, 생활과학대학, 수의과대학, 약학대학, 음악대학, 의과대학, 자유전공학부, 치의학대학원
- Numeric quotas; some 약간명 for highly-selective majors (의예, 치의학)
- 비고 column with major-specific exceptions (interview required for music; portfolio required for fine arts)

### Quota expression
- Numeric per recruitment unit, with 정원외 marked
- Footnotes at bottom of each table for 단과대학-level exceptions

### Calendar
- Single canonical timeline table on one page (KO/EN parallel rows)
- Per-college variants for arts/music interviews on a separate page

### Tuition
- **Cross-referenced** to a separate tuition booklet ([SNU Registration page](https://en.snu.ac.kr/academics/resources/registration))
- Not embedded — parser must fetch + join the linked tuition file

### Scholarships
- 3–5 page section
- Categories: SNU President's Scholarship, SNU Foreign Student Scholarship, GKS, Samsung Global Hope, etc.
- Each scholarship: name, amount/percentage, eligibility, application deadline

### Footnotes
- Heavy: most quota tables have 3–6 footnotes; calendar has discipline-specific footnotes

### Cross-references to other docs
- Tuition booklet
- Apostille guidance ([Apostille FAQ similar to POSTECH's](https://adm-g.postech.ac.kr/ENG/wp-content/uploads/2025/02/POSTECH-ADMISSIONS-Apostille-Issuance-Procedure-and-FAQ-for-International-Graduate-Applicants.pdf))
- D-2 visa process (HiKorea reference)

### Common gotchas
- Country-of-issuance document rules table in appendix; deeply nested
- Apostille requirement varies by document type AND by country
- Some majors (의과대학, 치의학대학원) may exclude foreign applicants entirely (not 정원외 — fully closed)
- 자유전공학부 admits without major declaration; 학과 chosen in year 2

## Parser strategy

- Use `pdfplumber` for the recruitment-unit table — column-anchored, lattice mode works
- Use LLM for the documents-required appendix (combinatorial; per applicant category × per country)
- Cross-fetch tuition file separately, link by `university_id` + `faculty_group`

## Verification checklist (when actual PDF available)

- [ ] PDF page count between 80 and 110
- [ ] 16 colleges enumerated in recruitment-unit table
- [ ] Calendar fits on 1 page (excluding per-college variants)
- [ ] Apostille / country-document table appears in appendix
- [ ] Bilingual structure matches prediction (parallel KO/EN docs vs side-by-side)
- [ ] Quota table has both 정원내 and 정원외 columns or sections

## Related rounds / docs
- 2026 Fall (intake September): https://admission.snu.ac.kr/international/undergraduate/fall/guide
- 2026 Graduate Spring: https://admission.snu.ac.kr/webdata/admission/files/2026_graduate_spring.pdf
- 2026 정시모집 (domestic regular): https://admission.snu.ac.kr/webdata/admission/files/2026jungsi.pdf
- 2026 수시모집 (domestic early): https://admission.snu.ac.kr/webdata/admission/files/2026susi.pdf
