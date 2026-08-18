"""Unit tests for the degree-level classifier."""

from uni_db.extract.degree_level import classify_degree_level


class TestClassifyDegreeLevel:
    def test_undergraduate_freshman(self) -> None:
        c = classify_degree_level(
            title="2026학년도 외국인 학부 신입학 모집요강",
            first_pages_text="외국인 학부 신입학 전형 안내. 학사과정 모집단위...",
        )
        assert c.primary_level == "undergraduate"
        assert c.cycle_track == "foreign"
        assert "bachelor" in c.degree_levels
        assert c.has_undergraduate and not c.has_graduate
        assert not c.is_combined
        assert c.confidence >= 0.55

    def test_masters_only(self) -> None:
        c = classify_degree_level(
            title="2026 일반대학원 외국인 석사과정 모집",
            first_pages_text="대학원 석사 과정 신입생 모집. 지도교수...",
        )
        assert c.primary_level == "master"
        assert c.cycle_track == "grad_foreign"
        assert "master" in c.degree_levels
        assert c.has_graduate and not c.has_undergraduate
        assert not c.is_combined

    def test_doctoral_only(self) -> None:
        c = classify_degree_level(
            title="대학원 박사과정 외국인전형",
            first_pages_text="박사 과정 모집. 연구계획서 제출...",
        )
        assert c.primary_level == "doctoral"
        assert "doctoral" in c.degree_levels
        assert c.cycle_track == "grad_foreign"

    def test_integrated_track(self) -> None:
        c = classify_degree_level(
            title="석박사통합과정 외국인 신입생 모집",
            first_pages_text="석박사통합 과정 안내...",
        )
        assert c.primary_level == "integrated"
        assert "integrated" in c.degree_levels
        assert c.cycle_track == "grad_foreign"

    def test_combined_undergrad_and_graduate(self) -> None:
        c = classify_degree_level(
            title="2026 외국인 신입학 모집요강 (학부·대학원)",
            first_pages_text=(
                "제1부 학부 신입학 전형. 학사과정 모집단위... "
                "제2부 대학원 석사 박사 과정 외국인전형..."
            ),
        )
        assert c.is_combined
        assert c.has_undergraduate and c.has_graduate
        # Primary stays undergraduate for the first extraction pass.
        assert c.primary_level == "undergraduate"
        assert "bachelor" in c.degree_levels
        # confidence kept in the "needs human confirmation" band
        assert c.confidence <= 0.7

    def test_associate_junior_college(self) -> None:
        c = classify_degree_level(
            title="2026 전문대학 외국인 신입생 모집",
            first_pages_text="전문학사 학위과정. 2년제/3년제...",
        )
        assert c.primary_level == "associate"
        assert "associate" in c.degree_levels

    def test_no_markers_defaults_undergraduate_low_confidence(self) -> None:
        c = classify_degree_level(
            title="입학 안내",
            first_pages_text="환영합니다. 우리 대학교에 지원해 주셔서 감사합니다.",
        )
        assert c.primary_level == "undergraduate"
        assert c.confidence < 0.55  # below HITL threshold → reviewer catches it

    def test_bare_haakbu_does_not_falsely_flag_undergraduate(self) -> None:
        # "경영학부" is a recruitment-unit suffix, NOT an undergraduate marker.
        c = classify_degree_level(
            title="대학원 석사과정 모집",
            first_pages_text="경영학부 소속 교수진이 지도합니다. 석사 과정...",
        )
        assert c.has_graduate
        assert not c.has_undergraduate
        assert not c.is_combined


class TestExplicitGraduateProgramme:
    """`has_graduate` and "this document has a graduate section" are not the
    same claim, and the difference is what made half the split cards useless.

    `has_graduate` is a substring count over the whole PDF: one occurrence of
    대학원 sets it. That is right for "does the word appear" and wrong for
    "does this file contain graduate admission", because an undergraduate
    guideline routinely mentions 대학원 in passing.
    """

    def test_passing_mention_is_not_an_explicit_programme(self) -> None:
        c = classify_degree_level(
            title="2027학년도 외국인 학부 신입학 모집요강",
            first_pages_text=(
                "외국인 학부 신입학 전형. 졸업 후 대학원 진학 시 별도 안내를 참고하십시오."
            ),
        )
        # The loose signal fires — that part is unchanged and intended.
        assert c.has_graduate
        assert c.is_combined
        # But nothing here names a graduate programme.
        assert not c.has_explicit_graduate_program

    def test_named_masters_programme_is_explicit(self) -> None:
        c = classify_degree_level(
            title="2027 외국인 학부 및 대학원 모집요강",
            first_pages_text="학부 신입학 전형 안내. 대학원 석사과정 외국인 전형 안내.",
        )
        assert c.has_explicit_graduate_program

    def test_doctoral_is_explicit(self) -> None:
        c = classify_degree_level(
            title="외국인 학부 신입학",
            first_pages_text="학사과정 모집. 박사과정 외국인 전형도 함께 안내합니다.",
        )
        assert c.has_explicit_graduate_program

    def test_integrated_is_explicit(self) -> None:
        c = classify_degree_level(
            title="외국인 학부 신입학",
            first_pages_text="학사과정 모집. 석박사통합 과정 안내.",
        )
        assert c.has_explicit_graduate_program

    def test_undergraduate_only_has_neither(self) -> None:
        c = classify_degree_level(
            title="2027학년도 외국인 학부 신입학 모집요강",
            first_pages_text="외국인 학부 신입학 전형 안내. 학사과정 모집단위.",
        )
        assert not c.has_graduate
        assert not c.has_explicit_graduate_program
