# Archetype E — Ewha Womans University

**Archetype:** E — Women's university (mostly inherits B's structure + gender field)
**Anchor doc:** Ewha 2026 외국인특별전형 모집요강 (KO)
**Source URLs:**
- 외국인특별전형 KO: https://isa.ewha.ac.kr/sites/oisa/file/ag_korean.pdf
- 재외국민 (3월 입학) KO: https://admission.ewha.ac.kr/upload/GUIDES/20250529165230BUGEVF.pdf
- 정시 모집요강 2026: https://admission.ewha.ac.kr/upload/GUIDES/20250901114849R2K7DN.pdf
- 모집요강 page: https://admission.ewha.ac.kr/admission/html/abroad/guide.asp
- ISA home: https://isa.ewha.ac.kr/
- 입학처: https://admission.ewha.ac.kr/

## Predicted structure

- **Page count:** ~35–55 pages
- **File size:** ~2–4 MB

### Section ordering
1. Cover (Ewha branding)
2. **Eligibility — explicit gender requirement (women only)**
3. 일정 (calendar)
4. 모집단위 (~12 colleges)
5. 전형방법
6. 제출서류
7. 등록금 (embedded)
8. 장학금 (Ewha Global Partnership Program emphasized)
9. 기숙사 (women-only dorms)
10. Appendices

### Distinct features
- "외국인특별전형" and "재외국민특별전형" usually published as separate documents
- Strong emphasis on the Ewha Global Partnership Program scholarship
- TOPIK 4+ required to graduate (but conditional admission allowed below)

### Verification checklist
- [ ] Gender requirement (women only) clearly stated
- [ ] 외국인 vs 재외국민 documents separate
- [ ] Ewha Global Partnership scholarship documented
- [ ] TOPIK 4 graduation requirement noted

## Notes for the data model
- The `gender_restriction` enum (`none` | `women_only` | `men_only`) field is needed for Archetype E universities. Default `none`; women's universities flag `women_only`. Only handful in Korea (Ewha, Sookmyung, Seoul Women's, Sungshin, Duksung, Dongduk, Catholic Women's, etc.).
