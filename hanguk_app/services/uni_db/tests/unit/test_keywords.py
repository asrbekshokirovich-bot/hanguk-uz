"""Audit §6.6 hard rules + §P-1 disallow rules."""

from uni_db.discovery.keywords_ko import (
    is_correction_notice,
    is_disallowed_url,
    matches_admission_signal,
)


class TestMatchesAdmissionSignal:
    def test_korean_keyword_with_pdf_attachment_passes(self) -> None:
        assert matches_admission_signal(
            title="2026학년도 외국인전형 모집요강",
            attachments_filenames=["foreign_2026.pdf"],
        )

    def test_admission_keyword_in_attachment_filename_passes(self) -> None:
        assert matches_admission_signal(
            title="안내사항 공지",
            attachments_filenames=["2026 모집요강.hwp"],
        )

    def test_no_admission_signal_in_news_title(self) -> None:
        assert not matches_admission_signal(
            title="도서관 운영 시간 안내",
            attachments_filenames=["library.pdf"],
        )

    def test_english_admission_phrase_passes(self) -> None:
        assert matches_admission_signal(
            title="International Student Admission 2026",
            attachments_filenames=["intl.pdf"],
        )


class TestCorrectionNotice:
    def test_jeongjeong_gonggo_detected(self) -> None:
        assert is_correction_notice("정정공고 — 외국인전형 일정 변경")

    def test_amended_keyword_detected(self) -> None:
        assert is_correction_notice("변경공고")

    def test_normal_announcement_not_correction(self) -> None:
        assert not is_correction_notice("외국인전형 모집요강 안내")


class TestDisallowedUrl:
    def test_english_path_blocked(self) -> None:
        assert is_disallowed_url("https://en.snu.ac.kr/admission")
        assert is_disallowed_url("https://admission.snu.ac.kr/eng/notice")

    def test_naver_blog_blocked(self) -> None:
        assert is_disallowed_url("https://blog.naver.com/some/post")

    def test_korean_admission_url_allowed(self) -> None:
        assert not is_disallowed_url("https://admission.snu.ac.kr/international/notice")

    def test_go_kr_allowed(self) -> None:
        assert not is_disallowed_url("https://okep.moe.go.kr/board/list.do")
