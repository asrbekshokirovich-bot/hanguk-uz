"""HITL digest assembler — snapshot-style assertions on the Markdown output."""

from datetime import datetime, timezone

from uni_db.hitl.digest import (
    ArchetypeAccuracy,
    OverdueRow,
    QueueRow,
    render_digest,
)


def _row(priority: int, reason: str, name_ko: str) -> QueueRow:
    return QueueRow(
        id="abcdef0123456789",
        priority=priority,
        reason=reason,
        entity_type="extraction_jobs",
        entity_id="uuid-stub-xxxxxxxx",
        name_ko=name_ko,
        name_en=None,
        source_url_ko=None,
        created_at=datetime(2026, 5, 7, 9, 0, tzinfo=timezone.utc),
    )


class TestEmptyState:
    def test_no_data_renders_friendly_message(self) -> None:
        out = render_digest(
            queue=[],
            accuracy=[],
            overdue=[],
            now=datetime(2026, 5, 7, 12, 0, tzinfo=timezone.utc),
        )
        assert "_No open items._" in out
        assert "_None overdue. Nice._" in out
        assert "_Insufficient decisions" in out
        assert out.startswith("# HITL review queue — 2026-05-07 12:00 UTC")


class TestPopulated:
    def test_priority_grouping_table(self) -> None:
        out = render_digest(
            queue=[
                _row(1, "correction_notice", "서울대학교"),
                _row(1, "low_confidence", "연세대학교"),
                _row(3, "low_confidence", "고려대학교"),
            ],
            accuracy=[],
            overdue=[],
            now=datetime(2026, 5, 7, 12, 0, tzinfo=timezone.utc),
        )
        assert "| P1 | 2 |" in out
        assert "| P3 | 1 |" in out
        assert "서울대학교" in out

    def test_overdue_table_includes_age(self) -> None:
        out = render_digest(
            queue=[],
            accuracy=[],
            overdue=[
                OverdueRow(
                    id="x",
                    priority=1,
                    age_hours=18.5,
                    name_ko="이화여자대학교",
                    name_en=None,
                )
            ],
            now=datetime(2026, 5, 7, 12, 0, tzinfo=timezone.utc),
        )
        assert "이화여자대학교" in out
        assert "18.5" in out

    def test_accuracy_section_shows_percentage(self) -> None:
        out = render_digest(
            queue=[],
            accuracy=[
                ArchetypeAccuracy(
                    archetype="B",
                    total_decided=20,
                    approved_as_is=14,
                    approved_with_edits=4,
                    rejected=2,
                    approved_as_is_pct=70.0,
                )
            ],
            overdue=[],
            now=datetime(2026, 5, 7, 12, 0, tzinfo=timezone.utc),
        )
        assert "| B |" in out
        assert "70.0%" in out
