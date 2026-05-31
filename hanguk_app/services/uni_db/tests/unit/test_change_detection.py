"""Plan §F.6 / Audit §6.5."""

from datetime import datetime, timezone

from uni_db.discovery.change_detection import (
    PriorAnnouncementSnapshot,
    detect_change,
    title_hash,
)
from uni_db.discovery.models import Announcement, Attachment


def _ann(title: str, attachments: list[Attachment] = None) -> Announcement:
    return Announcement(
        external_post_id="x",
        title_ko=title,
        url_ko="https://admission.example.ac.kr/notice/x",
        posted_at=datetime(2026, 5, 7, tzinfo=timezone.utc),
        attachments=attachments or [],
    )


class TestDetectChange:
    def test_no_prior_returns_new_post(self) -> None:
        out = detect_change(_ann("외국인전형 모집요강"), prior=None)
        assert out.finding_type == "new_post"
        assert out.priority == 5

    def test_no_prior_correction_notice_is_priority_one(self) -> None:
        out = detect_change(_ann("정정공고 — 일정변경"), prior=None)
        assert out.finding_type == "new_post"
        assert out.priority == 1

    def test_correction_notice_after_normal_post_promotes_priority(self) -> None:
        prior = PriorAnnouncementSnapshot(
            title_ko="외국인전형 모집요강",
            attachment_hashes=("aaa",),
            seen_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        )
        out = detect_change(_ann("정정공고 — 외국인전형"), prior=prior)
        assert out.finding_type == "correction_notice"
        assert out.priority == 1

    def test_attachment_hash_change_emits_attachment_change(self) -> None:
        prior = PriorAnnouncementSnapshot(
            title_ko="외국인전형 모집요강",
            attachment_hashes=("aaa",),
            seen_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        )
        fresh = _ann(
            "외국인전형 모집요강",
            attachments=[Attachment(filename="x.pdf", url="x", sha256="bbb")],
        )
        out = detect_change(fresh, prior=prior)
        assert out.finding_type == "attachment_change"
        assert out.priority == 2

    def test_title_only_diff_emits_title_change(self) -> None:
        prior = PriorAnnouncementSnapshot(
            title_ko="외국인전형 모집요강",
            attachment_hashes=("aaa",),
            seen_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        )
        fresh = _ann(
            "외국인전형 모집요강 (수정판)",
            attachments=[Attachment(filename="x.pdf", url="x", sha256="aaa")],
        )
        out = detect_change(fresh, prior=prior)
        assert out.finding_type == "title_change"
        assert out.priority == 3

    def test_unchanged_returns_noop(self) -> None:
        prior = PriorAnnouncementSnapshot(
            title_ko="외국인전형 모집요강",
            attachment_hashes=("aaa",),
            seen_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
        )
        fresh = _ann(
            "외국인전형 모집요강",
            attachments=[Attachment(filename="x.pdf", url="x", sha256="aaa")],
        )
        assert detect_change(fresh, prior=prior).finding_type == "noop"


class TestTitleHash:
    def test_normalization_collapses_whitespace(self) -> None:
        assert title_hash("외국인  전형") == title_hash("외국인 전형")
