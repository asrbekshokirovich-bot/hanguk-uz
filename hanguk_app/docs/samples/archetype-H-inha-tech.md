# Archetype H — Inha Technical College (전문대 minimal)

**Archetype:** H — 전문대 minimal
**Anchor:** placeholder (specific 외국인전형 doc URL to be filled in by Phase-2 fetcher)
**Source URLs:**
- Main: https://www.inhatc.ac.kr/

## Predicted structure

- **Page count:** ~8–15 pages
- **File size:** <1 MB
- **Languages:** KO-only typically

### Section ordering
1. Cover
2. 일정 (single table)
3. 모집단위 (학과 list)
4. 자격 (brief)
5. 제출서류 (brief)
6. 등록금 (per 학과)
7. 장학금 (single sentence often)

### Distinct features
- Minimum 2-year programs (associate degree)
- Plain-text Word document or simple PDF
- Often has a 외국인전형 chapter within a larger 모집요강
- Scholarship section often a single line ("국가장학금 신청 대상")

### Parser strategy
- HTML announcement page often contains all needed data
- For these, **scrape the announcement HTML directly**, only fetch PDF if HTML insufficient
- LLM extraction not necessary — simple regex + table parsing suffices

### Verification checklist
- [ ] Page count <20
- [ ] Plain layout
- [ ] Scholarship section minimal
- [ ] HTML announcement contains primary calendar data

## Other archetype-H universities to monitor
- Yeungjin College
- Dong-Eui Institute of Technology
- Catholic Sangji College
- Myongji College
- Seoul Institute of the Arts (Archetype F + H mix — arts content but 전문대 brevity)
- Dong-Ah Institute of Media and Arts
