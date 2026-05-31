# Archetype F — Korea National University of Arts (K-Arts / KNUA)

**Archetype:** F — Specialized art/music/PE
**Anchor:** K-Arts foreign-applicant admission (predicted; URL based on known root)
**Source URLs:**
- Main: https://www.karts.ac.kr/en/
- KO: https://www.karts.ac.kr/
**Announcement boards:** karts.ac.kr 입학공지 board

## Predicted structure

- **Page count:** ~50–80 pages
- **File size:** ~5–10 MB (image-heavy)

### Section ordering
1. Cover + Mission (national arts university)
2. Schools enumeration: Music, Drama, Film/TV/Multimedia, Dance, Visual Arts, Korean Traditional Arts (6 schools, 26 departments)
3. Per-discipline pages with audition / portfolio requirements
4. 일정 (calendar with multiple discipline-specific exam dates)
5. 모집인원 per discipline
6. 전형방법
7. 제출서류
8. 등록금 (embedded; per discipline)
9. 장학금
10. Audition specs per discipline (heavy section)

### Distinct features
- Heavy emphasis on 실기고사 (audition / practical exam)
- Audition specs include required pieces (e.g. specific Mozart concerto + Bach partita for piano), recording specs, evaluation rubrics
- Tuition split per discipline (vocal vs instrumental vs composition)

### Parser strategy
- Audition specs → store as raw + LLM-summary; do NOT over-normalize
- Calendar table is multi-axis (discipline × date × stage)

### Verification checklist
- [ ] 6 schools enumerated
- [ ] Per-discipline audition specs present
- [ ] Multi-axis calendar handled
- [ ] Tuition differs per discipline

## Other archetype-F universities
- Korea National Sport University (specialized PE)
- Chugye University for the Arts
- Korean National University of Cultural Heritage (specialized)
- Seoul Institute of the Arts (전문대 + arts; could be Archetype H + F mix)
