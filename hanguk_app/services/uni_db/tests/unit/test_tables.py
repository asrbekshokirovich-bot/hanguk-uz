"""Pure-function tests for the table normalisation layer."""

from uni_db.parse.tables import (
    flatten_merged_cells,
    looks_continuable,
    stitch_spans,
    transpose_if_rotated,
)


class TestFlattenMergedCells:
    def test_carries_label_to_blank_continuation_rows(self) -> None:
        rows = [
            ["인문계열", "1학기", "4,800,000"],
            ["", "2학기", "4,560,000"],
            ["공학계열", "1학기", "6,220,000"],
            ["", "2학기", "6,000,000"],
        ]
        out = flatten_merged_cells(rows)
        assert out[1][0] == "인문계열"
        assert out[3][0] == "공학계열"

    def test_does_not_overwrite_real_values(self) -> None:
        rows = [["A", "1"], ["B", "2"]]
        assert flatten_merged_cells(rows) == [["A", "1"], ["B", "2"]]

    def test_handles_empty_input(self) -> None:
        assert flatten_merged_cells([]) == []


class TestTransposeIfRotated:
    def test_header_in_row_zero_is_not_transposed(self) -> None:
        rows = [["단과대학", "학과", "모집인원"], ["공과", "컴퓨터공학", "30"]]
        assert transpose_if_rotated(rows)[0] == ["단과대학", "학과", "모집인원"]

    def test_header_in_column_zero_gets_transposed(self) -> None:
        rows = [
            ["단과대학", "공과", "인문"],
            ["학과", "컴공", "국문"],
            ["모집인원", "30", "20"],
        ]
        out = transpose_if_rotated(rows)
        assert out[0] == ["단과대학", "학과", "모집인원"]


class TestStitchSpans:
    def test_continuation_table_appends_to_prior(self) -> None:
        page_a = [
            [
                ["단과대학", "학과", "모집인원"],
                ["공과", "컴공", "30"],
            ]
        ]
        page_b = [
            [
                # No header — looks like continuation
                ["인문", "국문", "15"],
                ["인문", "영문", "20"],
            ]
        ]
        out = stitch_spans([page_a, page_b])
        assert len(out) == 1
        assert out[0][-1] == ["인문", "영문", "20"]

    def test_two_distinct_tables_stay_separate(self) -> None:
        page_a = [[["단과대학", "학과", "모집인원"], ["공과", "컴공", "30"]]]
        page_b = [[["계열", "1학기", "2학기"], ["인문", "4,800,000", "4,560,000"]]]
        out = stitch_spans([page_a, page_b])
        assert len(out) == 2


class TestLooksContinuable:
    def test_matching_widths_no_header_continues(self) -> None:
        a = [["단과대학", "학과", "정원"], ["공과", "컴공", "30"]]
        b = [["인문", "국문", "15"]]
        assert looks_continuable(a, b) is True

    def test_mismatched_widths_does_not(self) -> None:
        a = [["x", "y", "z"]]
        b = [["x", "y"]]
        assert looks_continuable(a, b) is False
