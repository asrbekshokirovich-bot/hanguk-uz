"""Archetype fixture factory.

One Korean-text payload + expected JSON envelope per archetype A–H. The
PDF rendering itself is generated at test time (PyMuPDF) so we never
ship binary blobs and never need to scrape an `.ac.kr` page.

Each fixture is a tuple of:
  - korean_text:   the source-of-truth payload that the parse_worker
                   ingests (bypasses PDF→text glyph rendering)
  - expected:      a minimal expected JSON contract per field group; the
                   end-to-end test checks shape, not exact values, since
                   the LLM is mocked
  - filename_hint: a synthetic filename used for archetype detection
                   tests (e.g. `2026Spring_under.pdf` → archetype A)
  - title_hint:    optional announcement title used by the discovery
                   classifier
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ArchetypeFixture:
    label: str
    korean_text: str
    filename_hint: str
    title_hint: str
    expected_calendar_event_types: tuple[str, ...]
    expected_recruitment_unit_count: int
    expected_faculty_group_for_tuition: str | None


# ---------------------------------------------------------------------------
# A — SNU flagship.
# ---------------------------------------------------------------------------
ARCHETYPE_A = ArchetypeFixture(
    label="A",
    korean_text=(
        "서울대학교 2026학년도 외국인전형 신입학 모집요강\n\n"
        "전형별 모집인원\n"
        "공과대학  | 컴퓨터공학부 | 약간명 | 정원외\n"
        "인문대학 | 영어영문학과 | 5      | 정원외\n\n"
        "주요 일정\n"
        "원서접수: 2026.09.01(월) 09:00 ~ 09.30(화) 17:00\n"
        "최종 합격자 발표: 2026.12.13(금)\n\n"
        "지원 자격\n"
        "본인 및 부모 모두 외국 국적. TOPIK 4급 이상.\n\n"
        "등록금\n"
        "별도 책자 참조 — Tuition booklet attached separately.\n\n"
        "장학금\n"
        "외국인 장학금: 등록금 100% 면제, 월 700,000원 생활비\n\n"
        "제출 서류\n"
        "1. 입학원서\n2. 자기소개서\n3. 고등학교 졸업증명서 (아포스티유)\n"
    ),
    filename_hint="2026Spring_under.pdf",
    title_hint="2026학년도 외국인전형 신입학 모집요강",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=2,
    expected_faculty_group_for_tuition=None,   # cross-referenced booklet
)


# ---------------------------------------------------------------------------
# B — Top Seoul private brochure-style.
# ---------------------------------------------------------------------------
ARCHETYPE_B = ArchetypeFixture(
    label="B",
    korean_text=(
        "연세대학교 2026 외국인전형 모집요강\n\n"
        "단과대학별 모집단위\n"
        "공과대학 | 컴퓨터과학과 | 30 | 정원내\n"
        "경영대학 | 경영학과 | 25 | 정원내\n\n"
        "전형 일정\n"
        "원서접수: 2026.09.01(월) 09:00 ~ 09.30(화) 17:00\n"
        "1단계 합격자 발표: 2026.10.20(월) 17:00\n"
        "최종 합격자 발표: 2026.12.13(금)\n\n"
        "등록금\n"
        "인문계열 1학기 등록금: 4,800,000원 (입학금 포함)\n"
        "공학계열 1학기 등록금: 6,220,000원 (입학금 포함)\n\n"
        "지원 자격\n"
        "TOPIK 3급 이상. 졸업 전 4급 취득 권장.\n\n"
        "제출 서류\n1. 입학원서\n2. 학업계획서\n3. 졸업증명서 (아포스티유)\n"
    ),
    filename_hint="yonsei_2026_foreign.pdf",
    title_hint="2026학년도 외국인전형 모집요강 안내",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=2,
    expected_faculty_group_for_tuition="humanities",
)


# ---------------------------------------------------------------------------
# C — Regional national plain table.
# ---------------------------------------------------------------------------
ARCHETYPE_C = ArchetypeFixture(
    label="C",
    korean_text=(
        "부산대학교 2026 외국인전형 모집요강\n\n"
        "거점국립대\n\n"
        "모집단위별 모집인원\n"
        "공과대학 | 기계공학과 | 10 | 정원외\n"
        "공과대학 | 화학공학과 | 8 | 정원외\n"
        "사범대학 | 영어교육과 | 5 | 정원외 ※ TOPIK 4급 권장\n\n"
        "주요 일정\n"
        "원서접수: 2026.09.01 ~ 09.30\n"
        "최종 합격자 발표: 2026.12.13\n\n"
        "등록금\n"
        "공학계열 1학기 등록금: 2,800,000원\n\n"
        "지원 자격\n"
        "본인 및 부모 모두 외국 국적. TOPIK 3급 이상.\n\n"
        "제출 서류\n1. 입학원서\n2. 졸업증명서\n3. 가족관계증명서\n"
    ),
    filename_hint="pnu_2026_foreign.pdf",
    title_hint="2026 외국인전형 안내",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=3,
    expected_faculty_group_for_tuition="engineering",
)


# ---------------------------------------------------------------------------
# D — Faith-affiliated / mid-private.
# ---------------------------------------------------------------------------
ARCHETYPE_D = ArchetypeFixture(
    label="D",
    korean_text=(
        "동국대학교 2026 외국인전형 모집요강\n\n"
        "본 대학은 불교 정신을 바탕으로 한 사명을 따라 인재를 양성합니다.\n\n"
        "모집단위\n"
        "공과대학 | 컴퓨터공학과 | 20 | 정원내\n"
        "불교대학 | 불교학과 | 5 | 정원내\n\n"
        "전형 일정\n"
        "원서접수: 2026.09.01 ~ 09.30\n"
        "최종 합격자 발표: 2026.12.13\n\n"
        "등록금\n"
        "인문계열 1학기 등록금: 5,200,000원\n\n"
        "지원 자격\n"
        "TOPIK 3급 이상.\n\n"
        "제출 서류\n1. 입학원서\n2. 졸업증명서\n"
    ),
    filename_hint="dongguk_2026_foreign.pdf",
    title_hint="2026 외국인전형 모집요강",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=2,
    expected_faculty_group_for_tuition="humanities",
)


# ---------------------------------------------------------------------------
# E — Women's university.
# ---------------------------------------------------------------------------
ARCHETYPE_E = ArchetypeFixture(
    label="E",
    korean_text=(
        "이화여자대학교 2026 외국인특별전형 모집요강\n\n"
        "여학생만 지원 가능 (Female applicants only)\n\n"
        "모집단위\n"
        "사회과학대학 | 국제학부 | 15 | 정원외\n"
        "공과대학 | 컴퓨터공학과 | 10 | 정원외\n\n"
        "전형 일정\n"
        "원서접수: 2026.09.01 ~ 09.30\n"
        "최종 합격자 발표: 2026.12.13\n\n"
        "등록금\n"
        "인문계열 1학기 등록금: 5,500,000원\n\n"
        "지원 자격\n"
        "여성 본인 및 부모 모두 외국 국적. TOPIK 3급 이상.\n\n"
        "장학금\n"
        "성적우수 장학금 — 등록금 50% 감면 (TOPIK 5급 이상)\n\n"
        "제출 서류\n1. 입학원서\n2. 학업계획서\n"
    ),
    filename_hint="ewha_2026_foreign.pdf",
    title_hint="2026 외국인특별전형 모집요강",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=2,
    expected_faculty_group_for_tuition="humanities",
)


# ---------------------------------------------------------------------------
# F — Specialized art/music/PE.
# ---------------------------------------------------------------------------
ARCHETYPE_F = ArchetypeFixture(
    label="F",
    korean_text=(
        "한국예술종합학교 2026 외국인전형 모집요강\n\n"
        "실기고사 (audition) — 학과별로 일정이 다릅니다.\n\n"
        "모집단위\n"
        "음악원 | 성악과 | 약간명 | 정원외\n"
        "음악원 | 작곡과 | 약간명 | 정원외\n"
        "미술원 | 회화과 | 약간명 | 정원외\n\n"
        "전형 일정\n"
        "원서접수: 2026.09.01 ~ 09.30\n"
        "실기고사: 2026.11.05 ~ 11.10\n"
        "최종 합격자 발표: 2026.12.13\n\n"
        "등록금\n"
        "예체능계열 1학기 등록금: 7,000,000원\n\n"
        "지원 자격\n"
        "TOPIK 3급 이상. 실기 평가 통과 필수.\n\n"
        "제출 서류\n1. 입학원서\n2. 포트폴리오\n3. 추천서 1부\n"
    ),
    filename_hint="karts_2026_foreign.pdf",
    title_hint="2026 외국인전형 — 실기고사 일정 포함",
    expected_calendar_event_types=(
        "apply_open",
        "apply_close",
        "practical_exam",
        "final_results",
    ),
    expected_recruitment_unit_count=3,
    expected_faculty_group_for_tuition="arts_pe",
)


# ---------------------------------------------------------------------------
# G — STEM specialized.
# ---------------------------------------------------------------------------
ARCHETYPE_G = ArchetypeFixture(
    label="G",
    korean_text=(
        "KAIST 2026 외국인전형 모집요강 (English-medium)\n\n"
        "Recruitment units / 모집단위\n"
        "Engineering | Computer Science | 약간명 | 정원외\n"
        "Engineering | Electrical Engineering | 약간명 | 정원외\n\n"
        "Schedule / 전형 일정\n"
        "Application: 2026.09.01 ~ 09.30\n"
        "Final results: 2026.12.13\n\n"
        "Tuition\n"
        "공학계열 1학기 등록금: 6,000,000원\n\n"
        "Eligibility / 지원 자격\n"
        "TOPIK is not required (English-medium). TOEFL 80+ recommended.\n\n"
        "Scholarships\n"
        "100% tuition waiver + KRW 1,200,000/month stipend\n\n"
        "Documents / 제출 서류\n1. Application form\n2. Statement of Purpose\n"
    ),
    filename_hint="Degree-Program-KAIST-Undergraduate-Spring-2026.pdf",
    title_hint="KAIST Spring 2026 Foreign Applicants",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=2,
    expected_faculty_group_for_tuition="engineering",
)


# ---------------------------------------------------------------------------
# H — 전문대 minimal.
# ---------------------------------------------------------------------------
ARCHETYPE_H = ArchetypeFixture(
    label="H",
    korean_text=(
        "인하공업전문대학 2026 외국인전형 안내\n\n"
        "전문대학 / 2년제\n\n"
        "모집단위\n"
        "기계과 | 30 | 정원외\n"
        "전기과 | 20 | 정원외\n\n"
        "전형 일정\n"
        "원서접수: 2026.09.01 ~ 09.30\n"
        "최종 합격자 발표: 2026.12.13\n\n"
        "등록금\n"
        "공학계열 1학기 등록금: 2,500,000원\n\n"
        "지원 자격\n"
        "TOPIK 3급 이상.\n\n"
        "장학금\n"
        "국가장학금 신청 대상\n\n"
        "제출 서류\n1. 입학원서\n2. 졸업증명서\n"
    ),
    filename_hint="inha_tech_2026_foreign.pdf",
    title_hint="2026 외국인전형 — 전문대학",
    expected_calendar_event_types=("apply_open", "apply_close", "final_results"),
    expected_recruitment_unit_count=2,
    expected_faculty_group_for_tuition="engineering",
)


ALL_FIXTURES: tuple[ArchetypeFixture, ...] = (
    ARCHETYPE_A, ARCHETYPE_B, ARCHETYPE_C, ARCHETYPE_D,
    ARCHETYPE_E, ARCHETYPE_F, ARCHETYPE_G, ARCHETYPE_H,
)


def fixture_by_label(label: str) -> ArchetypeFixture:
    for fx in ALL_FIXTURES:
        if fx.label == label:
            return fx
    raise KeyError(f"unknown archetype label {label!r}")
