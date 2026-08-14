"""propose_worker orchestrates the Naver keyword sweep → proposed_sources.

The live HTTP (NaverSearchAdapter) and DB write (propose_batch) are injected,
so these tests cover the worker's own logic: cross-keyword url dedup, the
Announcement→Candidate mapping, per-keyword error isolation, and count
aggregation from ProposeOutcome.inserted.
"""

from __future__ import annotations

from datetime import datetime, timezone

from uni_db.discovery.models import Announcement
from uni_db.discovery.propose_source import Candidate, ProposeOutcome
from uni_db.workers import propose_worker

_SINCE = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _ann(url: str, title: str = "외국인전형 모집요강") -> Announcement:
    return Announcement(
        external_post_id="x" + url[-4:], title_ko=title, url_ko=url, posted_at=None
    )


class _RecordingPropose:
    """Stand-in for propose_batch: records candidates, marks any url with
    'live' as skipped (already in announcement_sources)."""

    def __init__(self) -> None:
        self.seen: list[Candidate] = []

    async def __call__(self, conn: object, candidates) -> list[ProposeOutcome]:
        cands = list(candidates)
        self.seen.extend(cands)
        return [
            ProposeOutcome(inserted="live" not in c.url_ko, reason="t")
            for c in cands
        ]


async def test_dedups_same_url_across_keywords() -> None:
    async def search(keyword: str) -> list[Announcement]:
        # The same notice surfaces under both keywords searched.
        return [_ann("https://admission.a.ac.kr/n/1")]

    propose = _RecordingPropose()
    run = await propose_worker.discover_sources(
        _conn(), since=_SINCE, keywords=("외국인전형", "모집요강"),
        search=search, propose=propose,
    )
    assert run.keywords_searched == 2
    assert run.candidates_seen == 1            # deduped to one url
    assert len(propose.seen) == 1
    assert run.proposed == 1


async def test_maps_announcement_to_naver_candidate() -> None:
    async def search(keyword: str) -> list[Announcement]:
        return [_ann("https://admission.b.ac.kr/n/2", title="정정공고 일정변경")]

    propose = _RecordingPropose()
    await propose_worker.discover_sources(
        _conn(), since=_SINCE, keywords=("정정공고",),
        search=search, propose=propose,
    )
    c = propose.seen[0]
    assert c.url_ko == "https://admission.b.ac.kr/n/2"
    assert c.proposed_by == "naver_search"
    assert c.candidate_title == "정정공고 일정변경"


async def test_one_keyword_error_does_not_abort_sweep() -> None:
    async def search(keyword: str) -> list[Announcement]:
        if keyword == "boom":
            raise RuntimeError("naver 429 rate limited")
        return [_ann(f"https://admission.c.ac.kr/{keyword}")]

    propose = _RecordingPropose()
    run = await propose_worker.discover_sources(
        _conn(), since=_SINCE, keywords=("boom", "외국인전형"),
        search=search, propose=propose,
    )
    assert run.search_errors == 1
    assert run.candidates_seen == 1            # the surviving keyword still ran
    assert run.proposed == 1


async def test_skipped_count_tracks_uninserted_outcomes() -> None:
    async def search(keyword: str) -> list[Announcement]:
        return [
            _ann("https://admission.d.ac.kr/new"),
            _ann("https://admission.d.ac.kr/live-already"),  # propose marks skipped
        ]

    run = await propose_worker.discover_sources(
        _conn(), since=_SINCE, keywords=("외국인전형",),
        search=search, propose=_RecordingPropose(),
    )
    assert run.candidates_seen == 2
    assert run.proposed == 1
    assert run.skipped == 1


async def test_default_search_requires_http_client() -> None:
    import pytest

    with pytest.raises(RuntimeError, match="http_client"):
        await propose_worker.discover_sources(_conn(), since=_SINCE, keywords=("외국인전형",))


def _conn() -> object:
    """The injected propose fn ignores the connection, so a sentinel is fine."""
    return object()


class TestRegistrableDomain:
    def test_strips_subdomain_and_path(self) -> None:
        assert propose_worker.registrable_domain(
            "https://admission.inha.ac.kr/cms/x?MENU_ID=160"
        ) == "inha.ac.kr"

    def test_www_and_uppercase(self) -> None:
        assert propose_worker.registrable_domain("https://WWW.Korea.AC.KR/a") == "korea.ac.kr"

    def test_bare_host(self) -> None:
        assert propose_worker.registrable_domain("yonsei.ac.kr") == "yonsei.ac.kr"


async def test_targeted_searches_each_domain_and_keyword() -> None:
    calls: list[tuple[str, str]] = []

    async def search_site(domain: str, keyword: str) -> list[Announcement]:
        calls.append((domain, keyword))
        return [_ann(f"https://admission.{domain}/foreign")]

    propose = _RecordingPropose()
    run = await propose_worker.discover_targeted(
        _conn(),
        domains=("inha.ac.kr", "korea.ac.kr"),
        since=_SINCE,
        keywords=("외국인전형", "재외국민"),
        search_site=search_site,
        propose=propose,
    )
    assert run.keywords_searched == 4          # 2 domains x 2 keywords
    assert (("inha.ac.kr", "재외국민") in calls)
    # both universities' foreign pages proposed (deduped per url)
    assert run.candidates_seen == 2
    assert run.proposed == 2


async def test_targeted_drops_off_domain_hits() -> None:
    async def search_site(domain: str, keyword: str) -> list[Announcement]:
        # Naver returned a hit from a DIFFERENT university — must be dropped so
        # it isn't mis-attributed to the searched school.
        return [
            _ann(f"https://admission.{domain}/foreign"),
            _ann("https://admission.someoneelse.ac.kr/foreign"),
        ]

    propose = _RecordingPropose()
    run = await propose_worker.discover_targeted(
        _conn(), domains=("inha.ac.kr",), since=_SINCE,
        keywords=("외국인전형",), search_site=search_site, propose=propose,
    )
    assert run.candidates_seen == 1
    assert propose.seen[0].url_ko == "https://admission.inha.ac.kr/foreign"


async def test_targeted_one_search_error_does_not_abort() -> None:
    async def search_site(domain: str, keyword: str) -> list[Announcement]:
        if keyword == "재외국민":
            raise RuntimeError("naver 5xx")
        return [_ann(f"https://admission.{domain}/foreign")]

    run = await propose_worker.discover_targeted(
        _conn(), domains=("inha.ac.kr",), since=_SINCE,
        keywords=("외국인전형", "재외국민"), search_site=search_site,
        propose=_RecordingPropose(),
    )
    assert run.search_errors == 1
    assert run.proposed == 1


async def test_targeted_requires_http_client() -> None:
    import pytest

    with pytest.raises(RuntimeError, match="http_client"):
        await propose_worker.discover_targeted(
            _conn(), domains=("inha.ac.kr",), since=_SINCE,
        )


class TestCapPerUniversity:
    def test_keeps_best_n_and_drops_noise(self) -> None:
        titles = [
            "외국인 모집요강 제작업체 선정입찰",   # procurement noise
            "2025 외국인전형 모집요강",            # clean guide
            "재외국민 안내",                       # clean, no 모집요강
            "외국인 특별전형 모집요강",            # clean guide
        ]
        cands = [
            Candidate(url_ko=f"https://x.inha.ac.kr/p{i}",
                      proposed_by="naver_search", candidate_title=t)
            for i, t in enumerate(titles)
        ]
        kept = propose_worker.cap_per_university(cands, 2)
        kept_titles = [c.candidate_title for c in kept]
        assert len(kept) == 2
        assert all("선정입찰" not in t for t in kept_titles)   # noise ranked out
        assert all("모집요강" in t for t in kept_titles)       # real guides win

    def test_independent_per_domain(self) -> None:
        cands = [
            Candidate(url_ko=f"https://x.{d}/p{i}", proposed_by="naver_search",
                      candidate_title="외국인전형 모집요강")
            for d in ("inha.ac.kr", "korea.ac.kr") for i in range(4)
        ]
        kept = propose_worker.cap_per_university(cands, 3)
        assert len(kept) == 6  # 3 per domain, 2 domains


async def test_targeted_caps_results_per_university() -> None:
    async def search_site(domain: str, keyword: str) -> list[Announcement]:
        return [_ann(f"https://admission.{domain}/g{i}", "외국인전형 모집요강")
                for i in range(5)]

    propose = _RecordingPropose()
    run = await propose_worker.discover_targeted(
        _conn(), domains=("inha.ac.kr",), since=_SINCE, keywords=("외국인전형",),
        max_per_university=3, search_site=search_site, propose=propose,
    )
    assert len(propose.seen) == 3   # 5 found, capped to 3
    assert run.proposed == 3


class TestAudienceCap:
    """The per-university cap must not spend a slot on the wrong audience.

    `cap_per_university` keeps only the best N candidates. Before the audience
    term, a 재외국민 (overseas-Korean, i.e. Korean citizen) page and a genuine
    외국인 page tied on every field the key looked at — both carry 모집요강 and
    both carry 전형 — so the shorter URL decided, and a university could be
    represented in the queue solely by a guide its foreign applicants cannot use.
    """

    def _c(self, url: str, title: str) -> Candidate:
        return Candidate(url_ko=url, proposed_by="naver_search", candidate_title=title)

    def test_the_foreign_page_survives_a_cap_of_one(self) -> None:
        citizens = self._c(
            "https://korea.ac.kr/a", "2027학년도 재외국민 특별전형 모집요강"
        )
        foreign = self._c(
            "https://korea.ac.kr/bbbbbbbb", "2027학년도 외국인 특별전형 모집요강"
        )
        # citizens first in input AND with the shorter URL — the old key kept it.
        kept = propose_worker.cap_per_university([citizens, foreign], 1)
        assert [c.candidate_title for c in kept] == [foreign.candidate_title]

    def test_a_combined_page_is_not_demoted(self) -> None:
        combined = self._c(
            "https://x.ac.kr/a", "2027학년도 재외국민과 외국인 특별전형 모집요강"
        )
        other = self._c("https://x.ac.kr/bbbbbbbb", "2027학년도 모집요강 안내")
        kept = propose_worker.cap_per_university([other, combined], 1)
        assert [c.candidate_title for c in kept] == [combined.candidate_title]

    def test_procurement_noise_still_loses_to_everything(self) -> None:
        noise = self._c("https://x.ac.kr/a", "외국인 모집요강 제작업체 선정입찰")
        citizens = self._c("https://x.ac.kr/bbbbbbbb", "2027학년도 재외국민 모집요강")
        kept = propose_worker.cap_per_university([noise, citizens], 1)
        assert [c.candidate_title for c in kept] == [citizens.candidate_title]
