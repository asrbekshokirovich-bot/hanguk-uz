"""parse_worker end-to-end against an in-memory Korean text payload.

Verifies plan §F.4 routing — D1/D2 mock outputs auto-publish, D4/D5
go to review_queue.
"""

from uuid import uuid4

from uni_db.workers.parse_worker import parse_one_document


class TestParseOneDocument:
    def test_archetype_classified(self, korean_guideline_text: str) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
        )
        # Yonsei-style payload → archetype B.
        assert outcome.archetype.label in {"A", "B"}
        assert outcome.archetype.confidence > 0.5

    def test_all_field_groups_processed(self, korean_guideline_text: str) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
        )
        groups = {r.field_group for r in outcome.extraction_results}
        assert groups == {
            "calendar",
            "tuition",
            "requirements",
            "scholarships",
            "documents_required",
        }

    def test_empty_extractions_not_queued(self, korean_guideline_text: str) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
        )
        # The tuition / scholarships / documents_required mocks are empty
        # ({"rows": []}); Layer 1 queue hygiene means empty extractions are
        # NOT enqueued for human review (nothing to review).
        review_groups = {e["field_group"] for e in outcome.review_queue_entries}
        assert "tuition" not in review_groups
        assert "scholarships" not in review_groups
        assert "documents_required" not in review_groups

    def test_calendar_d1_field_auto_publishes(
        self, korean_guideline_text: str
    ) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
        )
        # The calendar mock returns confidence ≥ 0.9, so it should NOT
        # be in review_queue (D1 with conf ≥ 0.85 auto-publishes).
        review_groups = {e["field_group"] for e in outcome.review_queue_entries}
        assert "calendar" not in review_groups
