# Archetype G — KAIST

**Archetype:** G — STEM specialized
**Anchor doc:** KAIST Spring 2026 Degree Program Admission Guideline
**Source URLs:**
- PDF: https://namsankoreancourse.com/wp-content/uploads/2025/08/Degree-Program-KAIST-Undergraduate-Graduate-Guideline-Spring-2026.pdf
- EN page: https://www.kaist.ac.kr/en/html/admission/0201.html
- Apply portal: https://univapply.kaist.ac.kr/interapply/
- 2026 KAIST Undergraduate Admission Guide (Scribd mirror): https://www.scribd.com/document/881683407/1-2026-Admission-Guideline

## Predicted structure

- **Page count:** ~30–50 pages
- **File size:** ~2–4 MB
- **Languages:** EN-primary

### Section ordering
1. About KAIST + admission overview
2. Programs (Schools/Colleges enumeration)
3. Eligibility — both applicant and parents must be non-Korean
4. Application procedure (Early track + Regular track)
5. Required tests (SAT / AP / IB / GCE A-Level / ACT / Olympiads)
6. Document requirements
7. Calendar
8. Scholarships (heavy emphasis — KAIST scholarship, Presidential Fellowship, KAIST International Scholarship)
9. Tuition + fees (EN-language with KRW + USD)
10. Visa / immigration

### Distinct features
- **Quotas often qualitative** ("약간명" / "small quota") — not numeric
- English-medium teaching emphasized
- Strong scholarship offer; "100% tuition + monthly stipend" common
- Custom application portal (univapply.kaist.ac.kr) — NOT Uway
- Korean citizenship explicitly excludes applicants — including dual-citizen Korean+Foreign

### Parser strategy
- Normalize quota to enum: `numeric`, `약간명_a_few`, `소수정원_small`, `없음_unspecified`
- Scholarships embedded in front section — extract early
- Custom portal means application link is `univapply.kaist.ac.kr`, not `uwayapply.com`

### Verification checklist
- [ ] Quota class enum populated correctly (likely `약간명_a_few` or numeric for top tracks)
- [ ] English-medium flagged
- [ ] Scholarship percentage / coverage extracted
- [ ] Portal URL = univapply.kaist.ac.kr
