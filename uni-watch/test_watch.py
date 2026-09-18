"""Tests for uni-watch.

Two things must hold or the watcher is worse than nothing: it must not cry
wolf (a board that has not changed is silent), and it must not go quiet (a
broken site, a missing state file, a weird page must never stop the sweep).
No network here — every test feeds HTML in directly.
"""

from __future__ import annotations

import asyncio
import json

import pytest

import watch
from watch import Candidate, Finding, University


def _uni(url: str = "https://ipsi.example.ac.kr/notice") -> University:
    return University(name_ko="연세대학교", name_en="Yonsei University", url=url)


PAGE = """
<html><body>
  <a href="/notice/1">2027학년도 외국인 특별전형 모집요강 안내</a>
  <a href="/notice/2">2027학년도 유학생 신입학 모집 공고</a>
  <a href="/notice/3">도서관 휴관 안내</a>
  <a href="/login">로그인</a>
  <a href="#none">1</a>
</body></html>
"""


# --- which links count -----------------------------------------------------


def test_finds_the_guideline_and_the_foreign_admission_notice():
    found = watch.extract_candidates(PAGE, "https://ipsi.example.ac.kr/notice")
    titles = [c.title for c in found]

    assert any("모집요강" in t for t in titles)
    assert any("유학생" in t for t in titles)
    assert len(found) == 2


def test_ignores_library_notices_logins_and_pagination():
    found = watch.extract_candidates(PAGE, "https://ipsi.example.ac.kr/notice")
    blob = " ".join(c.title for c in found)

    assert "도서관" not in blob
    assert "로그인" not in blob


def test_a_domestic_admission_notice_is_not_reported():
    """The system exists for foreign applicants; a 수시 notice with no foreign
    marker is noise that would train its reader to ignore the chat."""
    html = '<a href="/x">2027학년도 수시모집 원서접수 안내</a>'
    assert watch.extract_candidates(html, "https://e.ac.kr") == []


def test_a_bare_guideline_is_reported_even_without_a_foreign_marker():
    html = '<a href="/x">2027학년도 신입학 모집요강</a>'
    assert len(watch.extract_candidates(html, "https://e.ac.kr")) == 1


def test_relative_links_become_absolute():
    found = watch.extract_candidates(
        '<a href="../board/7">외국인 신입학 모집요강</a>',
        "https://e.ac.kr/ko/notice/list",
    )
    assert found[0].url == "https://e.ac.kr/ko/board/7"


def test_javascript_links_fall_back_to_the_page_url():
    """Plenty of Korean boards open rows with JavaScript. Dropping them would
    blind the watcher to whole universities."""
    page = "https://e.ac.kr/notice"
    found = watch.extract_candidates(
        "<a href=\"javascript:view(12)\">외국인 신입학 모집요강</a>", page
    )
    assert found[0].url == page


def test_two_javascript_rows_stay_distinct():
    """They share a URL, so only the title keeps them apart — without that a
    whole board would collapse into one item."""
    page = "https://e.ac.kr/notice"
    found = watch.extract_candidates(
        '<a href="javascript:v(1)">2027학년도 외국인 모집요강 1차</a>'
        '<a href="javascript:v(2)">2027학년도 외국인 모집요강 2차</a>',
        page,
    )
    assert len({c.key for c in found}) == 2


def test_the_same_link_twice_on_one_page_is_one_item():
    html = ('<a href="/x">2027학년도 외국인 모집요강</a>'
            '<a href="/x">2027학년도 외국인 모집요강</a>')
    assert len(watch.extract_candidates(html, "https://e.ac.kr")) == 1


def test_whitespace_changes_do_not_make_a_new_item():
    """A board reflowing its HTML must not read as news."""
    a = watch.extract_candidates(
        '<a href="/x">2027학년도  외국인  모집요강</a>', "https://e.ac.kr"
    )
    b = watch.extract_candidates(
        '<a href="/x">2027학년도 외국인 모집요강</a>', "https://e.ac.kr"
    )
    assert a[0].key == b[0].key


def test_malformed_html_does_not_raise():
    assert watch.extract_candidates("<a href=", "https://e.ac.kr") == []
    assert watch.extract_candidates("", "https://e.ac.kr") == []


# --- first sight vs. genuinely new ----------------------------------------


class FakeClient:
    def __init__(self, html: str = PAGE, fail: bool = False) -> None:
        self.html, self.fail = html, fail

    async def get(self, url: str):
        if self.fail:
            raise ConnectionError("site down")
        return self

    def raise_for_status(self) -> None:
        pass

    @property
    def text(self) -> str:
        return self.html


def _check(uni, seen, client=None):
    sem = asyncio.Semaphore(4)
    return asyncio.run(
        watch.check_university(client or FakeClient(), sem, uni, seen)
    )


def test_first_sight_records_everything_and_announces_nothing():
    """Otherwise switching this on dumps a board's whole history into the chat."""
    uni, seen = _uni(), {}
    _, fresh, err = _check(uni, seen)

    assert fresh == [] and err is None
    assert len(seen[uni.url]) == 2


def test_an_unchanged_board_is_silent():
    uni, seen = _uni(), {}
    _check(uni, seen)
    _, fresh, _ = _check(uni, seen)
    assert fresh == []


def test_only_the_new_row_is_reported():
    uni, seen = _uni(), {}
    _check(uni, seen)

    grown = PAGE.replace(
        "</body>", '<a href="/notice/9">2028학년도 외국인 모집요강</a></body>'
    )
    _, fresh, _ = _check(uni, seen, FakeClient(grown))

    assert len(fresh) == 1
    assert "2028" in fresh[0].title


def test_a_dead_site_is_reported_not_raised():
    """One unreachable university must never stop the other 407."""
    uni, seen = _uni(), {}
    _, fresh, err = _check(uni, seen, FakeClient(fail=True))

    assert fresh == [] and err is not None
    assert uni.url not in seen, "a failed fetch must not count as first sight"


def test_a_newly_added_university_does_not_dump_its_board():
    """Adding a CSV row is first sight for that row alone."""
    seen = {"https://old.ac.kr": ["abc"]}
    _, fresh, _ = _check(_uni("https://new.ac.kr"), seen)
    assert fresh == []


def test_remembered_keys_stay_bounded():
    uni = _uni()
    seen = {uni.url: [f"k{n}" for n in range(watch.MAX_REMEMBERED_PER_UNIVERSITY)]}
    _check(uni, seen)
    assert len(seen[uni.url]) <= watch.MAX_REMEMBERED_PER_UNIVERSITY


def test_the_cap_drops_the_oldest_not_the_newest():
    uni = _uni()
    old = [f"k{n}" for n in range(watch.MAX_REMEMBERED_PER_UNIVERSITY)]
    seen = {uni.url: list(old)}
    _, fresh, _ = _check(uni, seen)

    assert fresh, "the page's items are new relative to those placeholder keys"
    assert seen[uni.url][0] == fresh[0].key
    assert old[-1] not in seen[uni.url]


# --- state file ------------------------------------------------------------


def test_missing_state_file_seeds_instead_of_crashing(tmp_path):
    state = watch.load_state(tmp_path / "nope.json")
    assert state["seen"] == {}


def test_corrupt_state_file_seeds_instead_of_crashing(tmp_path):
    """A half-written file must cost one quiet run, not a dead watcher."""
    p = tmp_path / "state.json"
    p.write_text("{ this is not json", encoding="utf-8")
    assert watch.load_state(p)["seen"] == {}


def test_state_round_trips(tmp_path):
    p = tmp_path / "state.json"
    watch.save_state({"version": 1, "seen": {"https://e.ac.kr": ["a"]}}, p)

    back = json.loads(p.read_text(encoding="utf-8"))
    assert back["seen"] == {"https://e.ac.kr": ["a"]}
    assert back["last_run"], "a run must record when it happened"


def test_state_keeps_korean_readable(tmp_path):
    """The owner is meant to be able to open this file."""
    p = tmp_path / "state.json"
    watch.save_state({"version": 1, "seen": {"https://연세.ac.kr": ["a"]}}, p)
    assert "연세" in p.read_text(encoding="utf-8")


# --- the message -----------------------------------------------------------


def test_message_carries_the_university_title_and_link():
    text = watch.format_message(
        [Finding(_uni(), (Candidate("2027 외국인 모집요강", "https://e.ac.kr/1"),))]
    )
    assert "연세대학교" in text
    assert "2027 외국인 모집요강" in text
    assert "https://e.ac.kr/1" in text


def test_message_escapes_html_from_the_page():
    """Titles come off crawled pages; parse_mode=HTML turns a stray '<' into a
    failed delivery for the whole batch."""
    text = watch.format_message(
        [Finding(_uni(), (Candidate("A & B <모집요강>", "https://e.ac.kr/1"),))]
    )
    assert "&amp;" in text and "&lt;" in text


def test_long_batches_are_truncated_and_counted():
    items = tuple(Candidate(f"외국인 모집요강 {n}", f"https://e.ac.kr/{n}") for n in range(40))
    text = watch.format_message([Finding(_uni(), items)])

    assert "40 ta" in text
    assert "va yana" in text
    assert len(text) < 4096, "Telegram rejects anything longer"


def test_no_findings_means_no_message():
    assert watch.format_message([]) == ""


# --- the CSV ---------------------------------------------------------------


def test_real_csv_loads_and_every_row_has_a_usable_url():
    unis = watch.load_universities()
    assert len(unis) > 300
    assert all(u.url.startswith("https://") or u.url.startswith("http://") for u in unis)
    assert all(u.display for u in unis)


def test_rows_without_a_real_url_are_skipped(tmp_path):
    p = tmp_path / "u.csv"
    p.write_text(
        "name_ko,name_en,url\nA,A,not-a-url\nB,B,https://b.ac.kr\n", encoding="utf-8"
    )
    assert [u.url for u in watch.load_universities(p)] == ["https://b.ac.kr"]


# --- menu labels vs. real notices ------------------------------------------


def test_bare_menu_labels_are_not_announcements():
    """Every Korean admission site has these in its sidebar. They match the
    keywords perfectly, never change, and would only ever fire a false alarm
    the day somebody rewords a menu."""
    for label in ("모집요강", "전형계획", "수시 모집요강", "정시 모집요강", "전년도 모집요강"):
        html = f'<a href="/menu">{label}</a>'
        assert watch.extract_candidates(html, "https://e.ac.kr") == [], label


def test_a_year_makes_a_short_title_an_announcement():
    html = '<a href="/x">2027학년도 모집요강</a>'
    assert len(watch.extract_candidates(html, "https://e.ac.kr")) == 1


def test_a_long_title_counts_even_without_a_year():
    """Not every notice names its cycle in the link text."""
    assert watch.looks_specific("외국인 신입생 모집 안내")
    assert not watch.looks_specific("모집요강")


def test_real_board_rows_survive_the_menu_filter():
    """Verbatim rows from live sites (CKU, GTEC) — these are the payload, and a
    filter that silenced them would make the whole watcher pointless."""
    rows = (
        "재외국민 2027학년도 재외국민과 외국인 특별전형 최종 합격자 발표 2026.08.27 더보기",
        "[순수외국인] 2026학년도 후기 5차 순수외국인 모집요강(2026년 9월 입학)",
        "2027학년도 정규과정 신입생 모집요강 2026.07.14",
        "[사전공지] 2028학년도 경기과학기술대학교 입학전형 시행계획 2026.04.28",
    )
    for row in rows:
        html = f'<a href="/b/1">{row}</a>'
        assert len(watch.extract_candidates(html, "https://e.ac.kr")) == 1, row
