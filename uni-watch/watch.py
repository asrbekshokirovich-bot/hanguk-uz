"""uni-watch — Koreya universitetlari qabul e'lonlarini kuzatuvchi.

Watches every Korean university's admission page and sends one Telegram
message when a new 모집요강 (admission guideline) appears.

This is deliberately the smallest thing that does the job, because the person
who owns it is not a programmer and will have to keep it alive alone:

  * **No database.** What has already been reported lives in `state.json`, a
    plain file this program rewrites and GitHub commits back. A database would
    be one more account, one more password and one more thing that can be
    "paused" — and a text file can be opened and read by its owner, which no
    database row can.
  * **No API keys** beyond the Telegram bot token. No search API, no AI model.
    Every key is a thing that expires, runs out of credit, or silently starts
    returning 401 at 3am — and each one is a bill.
  * **No parsing of PDFs.** The question this answers is "has this university
    posted something new?", which the LINKS on its page already say. Reading
    the PDF is a different, much harder job; keeping it out is what makes this
    one reliable.
  * **One university failing is normal.** Korean university sites go down, move,
    and block robots. Each is fetched independently and a failure is counted and
    skipped — never fatal, or one broken site would silence all 408.

The first time a university is seen, its current links are recorded WITHOUT
notifying. Otherwise switching this on — or adding a row to the CSV — would
dump that board's entire history into the chat as if it were news.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import html as html_mod
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

HERE = Path(__file__).parent
UNIVERSITIES_CSV = HERE / "universities.csv"
STATE_FILE = HERE / "state.json"

# Bumped whenever the key derivation changes. A mismatch makes load_state
# re-seed silently instead of announcing the whole corpus as new.
#   1 → 2: view counters (조회수) stripped before hashing, after the same three
#          SKKU notices were re-announced on almost every run.
STATE_VERSION = 2

# How many university sites to fetch at once. Each one is a different host, so
# this is not hammering anybody; it is what turns a 20-minute sweep into a
# 2-minute one, which is what keeps the hourly schedule inside GitHub's free
# minutes.
CONCURRENCY = 8

REQUEST_TIMEOUT_SEC = 20

# A real, identifiable agent. Korean university sites block the default Python
# one outright, and an operator who blocks this should be able to see who it is.
USER_AGENT = (
    "Mozilla/5.0 (compatible; uni-watch/1.0; admission-guideline watcher)"
)

# Telegram refuses messages over 4096 characters, and a wall of 40 schools is
# not a notification anyway.
MAX_ITEMS_PER_MESSAGE = 15

# Remembering more than this per university is pointless — boards show a page
# or two at a time — and an unbounded file eventually stops being committable.
# It must stay comfortably above one page of links, or an item scrolling back
# into view would read as new.
MAX_REMEMBERED_PER_UNIVERSITY = 80


# --- what counts as an admission announcement ------------------------------
#
# Two tiers, because one keyword list cannot be both quiet and complete.
# A 모집요강 is unambiguous and always reported. Everything else has to look
# like admissions AND like it concerns foreign applicants, which is what this
# system exists to catch — a domestic 수시 notice is noise here.

GUIDELINE_WORDS = ("모집요강", "모집 요강", "입학전형", "전형계획", "전형요강")
FOREIGN_WORDS = ("외국인", "유학생", "재외국민", "국제", "글로벌", "international", "foreign")
ADMISSION_WORDS = ("모집", "입학", "전형", "신입생", "신입학", "편입", "admission")

# Boards put the same words in navigation, footers and login links. These kill
# the obvious false positives before the keyword test ever runs.
IGNORE_PATTERNS = (
    "login", "logout", "로그인", "회원가입", "sitemap", "privacy", "개인정보",
    "javascript:void", "#none", "mailto:",
)

# An announcement almost always names its cycle. This is the strongest single
# signal that a link is a notice rather than a menu label.
YEAR_RE = re.compile(r"20\d{2}")

# …and when it does not, a notice still reads like a sentence while a menu
# label does not. Korean is dense: 12 characters is already several words.
MIN_SPECIFIC_LEN = 12


@dataclass(frozen=True, slots=True)
class University:
    name_ko: str
    name_en: str
    url: str

    @property
    def display(self) -> str:
        ko, en = self.name_ko.strip(), self.name_en.strip()
        if ko and en and ko != en:
            return f"{ko} ({en})"
        return ko or en or self.url


@dataclass(frozen=True, slots=True)
class Candidate:
    """One link on a university page that looks like an admission notice."""

    title: str
    url: str

    @property
    def key(self) -> str:
        """Stable id for "have we already reported this?".

        The URL alone is not enough: plenty of Korean boards open notices with
        JavaScript, so every row shares the page's own URL and keying on it
        would collapse a whole board into one item. Including the title keeps
        those distinct; including the URL keeps two identically-titled notices
        (a yearly repost) distinct.
        """
        raw = f"{self.url}||{_key_text(self.title)}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    @property
    def display_title(self) -> str:
        """The title as a person should read it — counters removed."""
        return _normalize(_strip_counters(self.title))


@dataclass(frozen=True, slots=True)
class Finding:
    university: University
    items: tuple[Candidate, ...]


def _normalize(text: str) -> str:
    """Collapse whitespace so a board reflowing its HTML is not "new"."""
    return re.sub(r"\s+", " ", text or "").strip()


# A view counter inside the link text. Korean boards routinely render a row as
# "공지 2027학년도 … 작성일 : 2026-09-09 조회수 : 5592", and 조회수 is the number of
# times the notice has been VIEWED — it changes whenever anybody opens the
# page, including this watcher. Keying on it made the same three SKKU notices
# look new on almost every run (3 → 5 → 7 → 9 → 10 → 12 remembered keys for a
# board with three items), and every one of those was a false alarm delivered
# to the operator's phone.
_COUNTER_RE = re.compile(
    r"(조회수|조회|추천|좋아요|hits?|views?)\s*[:：]?\s*[\d,]+", re.IGNORECASE
)

# Belt and braces for boards that print a bare counter with no label. A run of
# four or more digits is a counter or an id, never something a reader needs —
# except a year, which is the single most important word in these titles and is
# therefore excluded. Three-digit runs are left alone: "500명 모집" is content.
_LONG_NUMBER_RE = re.compile(r"(?<!\d)(?!20\d{2}(?!\d))\d{4,}(?!\d)")


def _strip_counters(text: str) -> str:
    """Drop view/like counters. They are noise to a reader and poison to a key."""
    return _COUNTER_RE.sub(" ", text or "")


def _key_text(title: str) -> str:
    """The part of a title that identifies the notice rather than its traffic."""
    return _normalize(_LONG_NUMBER_RE.sub("#", _strip_counters(title))).lower()


# --- reading the inputs ----------------------------------------------------


def load_universities(path: Path = UNIVERSITIES_CSV) -> list[University]:
    out: list[University] = []
    with path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            url = (row.get("url") or "").strip()
            if not url.startswith(("http://", "https://")):
                continue
            out.append(
                University(
                    name_ko=(row.get("name_ko") or "").strip(),
                    name_en=(row.get("name_en") or "").strip(),
                    url=url,
                )
            )
    return out


def _empty_state() -> dict:
    return {"version": STATE_VERSION, "seen": {}, "last_run": None}


def load_state(path: Path = STATE_FILE) -> dict:
    """Missing, corrupt, or stale-format state means "seed everything, tell nobody".

    Treating a damaged file as empty is safe in exactly one direction: the
    worst case is one quiet run. Treating it as a crash would leave the watcher
    dead until somebody noticed, which is the failure this whole program is
    meant to prevent.

    The version check matters just as much. Any change to how a key is derived
    makes every stored key meaningless — not wrong in a way that hides notices,
    but wrong in a way that makes all 700 of them look new at once, which would
    fire that entire backlog at the operator's phone in a single message. So a
    key-format change bumps STATE_VERSION, and the run that first sees the new
    version re-seeds in silence exactly as if it had never run before.
    """
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if (
            isinstance(data, dict)
            and isinstance(data.get("seen"), dict)
            and data.get("version") == STATE_VERSION
        ):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return _empty_state()


def save_state(state: dict, path: Path = STATE_FILE) -> None:
    state["last_run"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    path.write_text(
        json.dumps(state, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )


# --- finding the announcements ---------------------------------------------


def looks_specific(title: str) -> bool:
    """Tell an actual announcement from a navigation button.

    Every Korean admission site has a sidebar of bare labels — 모집요강,
    수시 모집요강, 전형계획 — that match the keywords perfectly and are not news.
    They never change, so they would only ever fire a false alarm the day a
    menu is reworded, while crowding out real notices in the remembered list.

    What separates the two is specificity. A real notice carries a year
    ("2027학년도 재외국민과 외국인 특별전형") or is simply a sentence rather than a
    label. A menu item is neither.
    """
    t = title.strip()
    return bool(YEAR_RE.search(t)) or len(t) >= MIN_SPECIFIC_LEN


def is_admission_link(title: str, href: str) -> bool:
    blob = f"{title} {href}".lower()
    if any(p in blob for p in IGNORE_PATTERNS):
        return False
    if not looks_specific(title):
        return False
    if any(w in blob for w in GUIDELINE_WORDS):
        return True
    return any(w in blob for w in FOREIGN_WORDS) and any(
        w in blob for w in ADMISSION_WORDS
    )


def extract_candidates(html: str, page_url: str) -> list[Candidate]:
    """Every link on the page that reads like an admission announcement."""
    soup = BeautifulSoup(html, "html.parser")
    seen_keys: set[str] = set()
    out: list[Candidate] = []

    for a in soup.find_all("a"):
        title = _normalize(a.get_text(" ", strip=True))
        href = (a.get("href") or "").strip()
        # A link with no words cannot be judged, and one that is a bare number
        # is a pagination control.
        if not title or len(title) < 4 or title.isdigit():
            continue
        if not is_admission_link(title, href):
            continue

        if href and not href.lower().startswith(("javascript:", "#", "mailto:")):
            url = urljoin(page_url, href)
        else:
            # JavaScript-driven board: the page itself is the only address we
            # can give, and `key` keeps the rows apart by title.
            url = page_url

        c = Candidate(title=a.get_text(" ", strip=True), url=url)
        if c.key in seen_keys:
            continue
        seen_keys.add(c.key)
        out.append(c)

    return out


async def fetch_page(client: httpx.AsyncClient, url: str) -> str:
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.text


async def check_university(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    uni: University,
    state_seen: dict[str, list[str]],
) -> tuple[University, list[Candidate], str | None]:
    """Returns (university, genuinely-new items, error message or None)."""
    async with sem:
        try:
            html = await fetch_page(client, uni.url)
        except Exception as exc:  # noqa: BLE001 — one site must never stop the sweep
            return uni, [], f"{type(exc).__name__}: {str(exc)[:120]}"

    candidates = extract_candidates(html, uni.url)
    known = state_seen.get(uni.url)

    if known is None:
        # First sight of this university: remember, announce nothing.
        state_seen[uni.url] = [c.key for c in candidates][
            :MAX_REMEMBERED_PER_UNIVERSITY
        ]
        return uni, [], None

    known_set = set(known)
    fresh = [c for c in candidates if c.key not in known_set]

    if fresh:
        # Newest first, bounded — the cap only ever drops the oldest keys.
        state_seen[uni.url] = ([c.key for c in fresh] + known)[
            :MAX_REMEMBERED_PER_UNIVERSITY
        ]

    return uni, fresh, None


# --- telling the operator --------------------------------------------------


def _esc(text: str) -> str:
    return html_mod.escape(text or "", quote=False)


def format_message(findings: list[Finding]) -> str:
    """The Telegram message, in Uzbek. Korean titles are left untouched — that
    is what the university's own page says, so that is what is searchable."""
    if not findings:
        return ""

    total = sum(len(f.items) for f in findings)
    lines = [
        f"🎓 <b>Yangi qabul e'loni: {total} ta</b>"
        if total > 1
        else "🎓 <b>Yangi qabul e'loni</b>",
        "",
    ]

    shown = 0
    for f in findings:
        if shown >= MAX_ITEMS_PER_MESSAGE:
            break
        lines.append(f"🏛 <b>{_esc(f.university.display)}</b>")
        for item in f.items:
            if shown >= MAX_ITEMS_PER_MESSAGE:
                break
            lines.append(f"   • {_esc(item.display_title[:160])}")
            lines.append(f"     {_esc(item.url)}")
            shown += 1
        lines.append("")

    if total > shown:
        lines.append(f"…va yana {total - shown} ta e'lon.")

    return "\n".join(lines).strip()


async def send_telegram(text: str, *, token: str, chat_id: str) -> None:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SEC) as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
        )
    # Telegram explains itself in the body on every failure — a wrong chat id
    # gives "chat not found", a wrong token "Unauthorized". Reading that BEFORE
    # the status code is what turns an opaque "Client error 400" into the
    # actual fix, which matters when the person reading the log is the owner
    # and not a programmer. `ok` is false on every failure, so this covers the
    # 200-with-ok:false case too.
    try:
        body = resp.json()
    except ValueError:
        body = {}
    if not body.get("ok"):
        reason = body.get("description") or f"HTTP {resp.status_code}"
        raise RuntimeError(f"Telegram xabarni qabul qilmadi: {reason}")


# --- the run ---------------------------------------------------------------


async def send_test_message() -> int:
    """Prove the Telegram half works, on its own, in one click.

    Without this there is no way for the owner to tell a working setup from a
    broken one. The first real run deliberately announces nothing (it is
    recording the boards), and later runs say nothing when there is no news —
    so "no message arrived" is the correct behaviour in both the healthy case
    and the case where the token is wrong. Somebody who is not a programmer
    cannot be asked to tell those apart by reading a log.
    """
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

    if not token or not chat_id:
        missing = " va ".join(
            n for n, v in (("TELEGRAM_BOT_TOKEN", token), ("TELEGRAM_CHAT_ID", chat_id))
            if not v
        )
        print(
            f"XATO: {missing} qo'yilmagan.\n"
            "GitHub → Settings → Secrets and variables → Actions bo'limiga qo'shing.",
            file=sys.stderr,
        )
        return 1

    await send_telegram(
        "✅ <b>uni-watch ulandi</b>\n\n"
        "Telegram sozlamasi to'g'ri. Endi har soatda universitet saytlari "
        "tekshiriladi va yangi qabul e'loni chiqsa shu yerga xabar keladi.\n\n"
        "<i>Bu sinov xabari — e'lon emas.</i>",
        token=token,
        chat_id=chat_id,
    )
    print("Sinov xabari yuborildi. Telegram'ni tekshiring.")
    return 0


async def run(*, limit: int | None, dry_run: bool, test_message: bool = False) -> int:
    if test_message:
        return await send_test_message()

    universities = load_universities()
    if limit:
        universities = universities[:limit]
    if not universities:
        print("universities.csv bo'sh — tekshiradigan narsa yo'q.", file=sys.stderr)
        return 1

    state = load_state()
    seen: dict[str, list[str]] = state["seen"]
    first_run = not seen

    print(f"{len(universities)} ta universitet tekshirilmoqda…")
    if first_run:
        print("Birinchi ishga tushish: hammasi eslab qolinadi, xabar yuborilmaydi.")

    sem = asyncio.Semaphore(CONCURRENCY)
    # Honour SSL_CERT_FILE when it is set. On GitHub Actions it is not, and the
    # normal certificate store is used. Behind a company proxy — or any network
    # that re-signs TLS — it is the difference between working and every single
    # university failing to verify. Certificates are still verified either way;
    # this only says which authority to trust.
    ca_bundle = os.environ.get("SSL_CERT_FILE", "").strip()
    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        timeout=REQUEST_TIMEOUT_SEC,
        verify=ca_bundle if ca_bundle and Path(ca_bundle).is_file() else True,
    ) as client:
        results = await asyncio.gather(
            *(check_university(client, sem, u, seen) for u in universities)
        )

    findings = [Finding(u, tuple(items)) for u, items, _ in results if items]
    errors = [(u, err) for u, _, err in results if err]
    total_new = sum(len(f.items) for f in findings)

    print(
        f"Tekshirildi: {len(universities)}, "
        f"yangi e'lon: {total_new}, "
        f"ochilmadi: {len(errors)}"
    )
    for uni, err in errors[:10]:
        print(f"  ochilmadi: {uni.display} — {err}", file=sys.stderr)
    if len(errors) > 10:
        print(f"  …va yana {len(errors) - 10} ta", file=sys.stderr)

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    message = format_message(findings)

    if not findings:
        save_state(state)
        return 0

    if dry_run or not (token and chat_id):
        if not (token and chat_id):
            print(
                "DIQQAT: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID qo'yilmagan — "
                "xabar yuborilmadi.",
                file=sys.stderr,
            )
        print("\n--- yuboriladigan xabar ---\n" + message)
        # Nothing was delivered, so nothing may be remembered: the next run
        # with a working channel has to report these same items.
        return 0

    await send_telegram(message, token=token, chat_id=chat_id)
    # Saved only after delivery succeeded. A crash here repeats one message on
    # the next run; the other order would lose the announcement for good.
    save_state(state)
    print("Telegram'ga yuborildi.")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="uni-watch",
        description="Koreya universitetlari qabul e'lonlarini kuzatadi",
    )
    p.add_argument("--limit", type=int, default=None,
                   help="Faqat birinchi N ta universitetni tekshirish (sinov uchun)")
    p.add_argument("--dry-run", action="store_true",
                   help="Xabarni ekranga chiqarish, Telegram'ga yubormaslik")
    p.add_argument("--test-message", action="store_true",
                   help="Telegram sozlamasini tekshirish: sinov xabari yuboradi "
                        "va to'xtaydi. Saytlar tekshirilmaydi.")
    args = p.parse_args(argv)
    return asyncio.run(run(limit=args.limit, dry_run=args.dry_run,
                           test_message=args.test_message))


if __name__ == "__main__":
    raise SystemExit(main())
