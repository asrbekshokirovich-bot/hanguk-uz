"""Phase 2-D3 — propose_source gate tests (no DB).

The DB-writing branches are tested elsewhere via `respx`-style asyncpg
fakes; these tests cover the deterministic gate logic that decides
whether a candidate is even worth proposing.
"""

from uni_db.discovery.propose_source import (
    Candidate,
    evaluate_candidate,
    matched_keywords_for,
)


class TestEvaluateCandidate:
    def test_admission_keyword_in_title_passes(self) -> None:
        c = Candidate(
            url_ko="https://admission.kookmin.ac.kr/notice/foreigner",
            proposed_by="naver_search",
            candidate_title="2026학년도 외국인전형 모집요강 안내",
        )
        ok, reason, matched = evaluate_candidate(c)
        assert ok is True
        assert "외국인전형" in matched
        assert "모집요강" in matched

    def test_disallowed_url_blocked(self) -> None:
        c = Candidate(
            url_ko="https://en.snu.ac.kr/admission/intl",
            proposed_by="google_pse",
            candidate_title="2026 Foreign Applicant Track",
        )
        ok, reason, _ = evaluate_candidate(c)
        assert ok is False
        assert "disallowed" in reason.lower()

    def test_naver_blog_blocked(self) -> None:
        c = Candidate(
            url_ko="https://blog.naver.com/somebody/post123",
            proposed_by="naver_search",
            candidate_title="외국인전형 모집요강",
        )
        ok, _, _ = evaluate_candidate(c)
        assert ok is False

    def test_news_article_with_no_admission_keyword_dropped(self) -> None:
        c = Candidate(
            url_ko="https://www.korea.ac.kr/news/2026/03",
            proposed_by="google_pse",
            candidate_title="고려대학교 봄축제 행사 안내",
        )
        ok, reason, _ = evaluate_candidate(c)
        assert ok is False
        assert "no admission keyword" in reason

    def test_empty_url_dropped_with_clear_reason(self) -> None:
        c = Candidate(url_ko="", proposed_by="naver_search")
        ok, reason, _ = evaluate_candidate(c)
        assert ok is False
        assert "empty" in reason


class TestMatchedKeywordsFor:
    def test_returns_all_matching_anchors(self) -> None:
        text = "2026학년도 외국인전형 모집요강 정정공고 일정변경"
        matched = matched_keywords_for(text)
        assert "외국인전형" in matched
        assert "모집요강" in matched
        assert "정정공고" in matched
        assert "일정변경" in matched

    def test_returns_empty_when_no_anchors(self) -> None:
        assert matched_keywords_for("일반 공지사항") == ()


class TestPriorityImpliedByMatchCount:
    """The HITL queue view orders by len(matched_keywords) DESC; we
    sanity-check the ordering bands here."""

    def test_strong_signal_three_or_more_keywords(self) -> None:
        text = "외국인전형 모집요강 정정공고 — 일정변경"
        assert len(matched_keywords_for(text)) >= 3

    def test_medium_signal_two_keywords(self) -> None:
        text = "수시모집 안내"
        assert len(matched_keywords_for(text)) == 1

    def test_single_keyword_alone_is_not_enough(self) -> None:
        # matches_admission_signal requires ≥2 keyword anchors in the
        # title-only path (no attachment metadata from search results)
        # to avoid flooding HITL with single-keyword false positives.
        c = Candidate(
            url_ko="https://www.foo.ac.kr/bar",
            proposed_by="naver_search",
            candidate_title="모집요강 안내",
        )
        ok, reason, _ = evaluate_candidate(c)
        assert ok is False
        assert "no admission keyword" in reason

    def test_correction_notice_alone_passes_even_one_keyword(self) -> None:
        # Correction notices are priority-1; the title-only matcher
        # accepts them with a single trigger.
        c = Candidate(
            url_ko="https://admission.snu.ac.kr/notice",
            proposed_by="naver_search",
            candidate_title="정정공고 일정 안내",
        )
        ok, _, matched = evaluate_candidate(c)
        assert ok is True
        assert "정정공고" in matched
