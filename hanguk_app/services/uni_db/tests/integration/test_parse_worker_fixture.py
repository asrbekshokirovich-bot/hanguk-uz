"""parse_worker end-to-end against an in-memory Korean text payload.

Fully-automated routing: every content-bearing extraction is queued as an
`approved` item (no human). High-confidence ones are clean; low-confidence /
difficult-field ones are flagged `needs_attention` but still published. Empty
extractions are still dropped.
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

    def test_calendar_auto_approved_clean(
        self, korean_guideline_text: str
    ) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
        )
        # The calendar mock returns confidence ≥ 0.9 (D1) → auto-approved and
        # queued for publishing, with no needs_attention flag.
        cal = [e for e in outcome.review_queue_entries if e["field_group"] == "calendar"]
        assert len(cal) == 1
        assert cal[0]["status"] == "approved"
        assert cal[0]["needs_attention"] is False
        assert cal[0]["reason"] == "auto_approved"

    def test_low_confidence_field_published_but_flagged(
        self, korean_guideline_text: str
    ) -> None:
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
        )
        # The requirements mock returns low confidence (D3 < 0.90) → still
        # queued approved (it publishes), but flagged needs_attention.
        req = [e for e in outcome.review_queue_entries if e["field_group"] == "requirements"]
        assert len(req) == 1
        assert req[0]["status"] == "approved"
        assert req[0]["needs_attention"] is True

    def test_legacy_mode_only_queues_hitl_as_open(
        self, korean_guideline_text: str
    ) -> None:
        # With auto_publish disabled, behavior reverts to the human gate:
        # high-confidence calendar is dropped, low-confidence requirements
        # is queued as `open` for a reviewer.
        outcome = parse_one_document(
            guideline_document_id=uuid4(),
            pdf_text_first_pages=korean_guideline_text[:1500],
            pdf_text_full=korean_guideline_text,
            auto_publish=False,
        )
        by_group = {e["field_group"]: e for e in outcome.review_queue_entries}
        assert "calendar" not in by_group
        assert by_group["requirements"]["status"] == "open"
