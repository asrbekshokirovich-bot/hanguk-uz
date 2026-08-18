"""A "split this document" card must point at a real boundary.

Two detectors disagreed and the card believed the wrong one.
`classify_degree_level` counts substrings over the whole PDF, so a single
occurrence of 대학원 — "대학원 진학 시" in an undergraduate footnote — sets
`has_graduate`, hence `is_combined`. `split_by_degree` looks for section
HEADERS and was written precisely to reject that stray mention.

When the header detector found nothing, the card still went out, telling a
reviewer to split at a place that does not exist. Measured on production: of
25 split cards ever raised, 13 carried `Segments: <level>@0.` — one segment,
nothing to split — and 11 of those rested on a single grad_general hit with
no 석사/박사 anywhere in the file.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from uni_db.extract.llm_anthropic import ExtractionResult
from uni_db.workers import parse_worker


def _ok_result(group: str) -> ExtractionResult:
    return ExtractionResult(
        field_group=group,
        parsed_output={"rows": []},
        raw_output="{}",
        llm_provider="mock",
        llm_model="mock",
        input_tokens=1,
        output_tokens=1,
        cost_usd=0.0,
        latency_ms=1,
        accuracy_self_score=0.9,
    )


@pytest.fixture(autouse=True)
def _stub_extraction(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        parse_worker, "extract_all_groups",
        lambda **kw: {g: _ok_result(g) for g in kw["groups"]},
    )
    monkeypatch.setattr(
        parse_worker, "extract_field_group",
        lambda **kw: _ok_result(kw["field_group"]),
    )


def _doc_entries(full_text: str, first_pages: str) -> list[dict]:
    outcome = parse_worker.parse_one_document(
        guideline_document_id=uuid4(),
        pdf_text_first_pages=first_pages,
        pdf_text_full=full_text,
        verify_level="off",
    )
    return [
        e for e in outcome.review_queue_entries
        if e.get("entity_type") == "guideline_documents"
    ]


# The document the user reported: an undergraduate guideline that mentions
# graduate school once, in passing, and has no graduate section at all.
_PASSING_MENTION = (
    "2027학년도 외국인 학부 신입학 모집요강\n"
    "외국인 학부 신입학 전형 안내입니다.\n"
    "학사과정 모집단위 및 전형일정.\n"
    "졸업 후 대학원 진학 시에는 별도의 안내를 참고하십시오.\n"
) + "본문 내용 " * 200

# A genuinely combined file: both section headers are present.
_REAL_COMBINED = (
    "2027학년도 외국인 모집요강\n"
    "1. 외국인 학부 신입학 전형\n"
) + "학부 본문 " * 200 + (
    "\n2. 대학원 외국인 신입학 전형\n"
) + "대학원 본문 " * 200

# Names a master's programme but never uses a section heading the splitter
# recognises — genuinely ambiguous, not a clear false positive.
_NAMED_NO_HEADER = (
    "2027학년도 외국인 학부 신입학 모집요강\n"
    "학사과정 모집단위.\n"
    "석사 지원자는 별도 문의 바랍니다.\n"
) + "본문 내용 " * 200


class TestSplitCard:
    def test_passing_mention_raises_no_card(self) -> None:
        entries = _doc_entries(_PASSING_MENTION, "2027학년도 외국인 학부 신입학 모집요강")
        assert entries == [], entries

    def test_real_boundary_still_raises_the_split_card(self) -> None:
        # The fix must not silence the case the card exists for.
        entries = _doc_entries(_REAL_COMBINED, "2027학년도 외국인 모집요강")
        assert len(entries) == 1, entries
        entry = entries[0]
        assert entry["field_group"] == "degree_split"
        assert "Split into separate admission" in entry["rationale"]
        # Two segments, and the graduate one does not start at offset 0 —
        # a boundary the reviewer can actually act on.
        assert "graduate@" in entry["rationale"]
        assert "graduate@0" not in entry["rationale"]

    def test_named_programme_without_header_is_flagged_but_not_as_a_split(
        self,
    ) -> None:
        entries = _doc_entries(_NAMED_NO_HEADER, "2027학년도 외국인 학부 신입학 모집요강")
        assert len(entries) == 1, entries
        entry = entries[0]
        assert entry["field_group"] == "degree_check"
        # It must NOT tell anyone to split — there is no boundary.
        assert "Split into separate admission" not in entry["rationale"]
        assert "nothing to split at" in entry["rationale"]

    def test_no_card_ever_claims_a_split_with_one_segment(self) -> None:
        # The defect in one line: a split instruction and a single segment
        # must never appear together, whatever the input.
        for text, head in (
            (_PASSING_MENTION, "학부 신입학"),
            (_NAMED_NO_HEADER, "학부 신입학"),
            (_REAL_COMBINED, "외국인 모집요강"),
        ):
            for entry in _doc_entries(text, head):
                rationale = entry["rationale"]
                if "Split into separate admission" in rationale:
                    segs = rationale.split("Segments:")[1]
                    assert segs.count("@") >= 2, rationale
