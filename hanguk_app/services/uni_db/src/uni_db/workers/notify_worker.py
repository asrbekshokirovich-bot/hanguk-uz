"""Tell the operator, on their phone, the moment a new 모집요강 lands.

The pipeline already finds newly-published guidelines — `find-guidelines`
site-searches all 408 tracked institutions nightly and stores any PDF whose
SHA-256 it has never seen (98 new documents in the last 30 days alone). What it
never did is *say so*. The only signal a human got was the scheduled task's
generic "run finished" push, which reports counters (`ingested=3`) and not
which schools, so the actual news — 연세대 has opened 2027 spring admission —
sat in Postgres until somebody thought to look. That is the gap this closes.

Three properties matter more than features here:

* **Never announce the same document twice.** `guideline_notifications` is the
  ledger; a document is announced only if it has no row there. This is the
  exact failure hitl/watchdog_alerts.py called out in `pipeline_watchdog_log`
  (no "already notified" column, so a naive poller re-alerts every run) — so
  the ledger lands before the poller, not after.
* **Never flood.** 263 documents predate this module and every one of them
  looks "un-notified". `MAX_AGE_HOURS` bounds any single run to genuinely
  recent rows, and `mark_seen()` exists to seed the ledger once at setup.
  Together they make a 263-message burst impossible even if someone runs this
  wrong.
* **Send before marking.** A crash between the two repeats one message on the
  next run; the other order loses the announcement forever. Repetition is the
  cheaper failure.

Delivery is the Telegram Bot API over plain HTTPS — no Supabase edge function
in the path, because this has to keep working from the GitHub Actions runner
and from the scheduled Claude task, neither of which holds a staff JWT (the
constraint that made `send-telegram` unsuitable; see watchdog_alerts.py).

Both the DB connection and the sender are injected, so the selection logic and
the message text unit-test with no database and no network.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Awaitable, Callable, Protocol, Sequence

log = logging.getLogger(__name__)

# Only rows fetched inside this window are ever announced. The nightly sweep
# runs once a day, so 48h covers a missed run without ever reaching back into
# the pre-existing backlog.
MAX_AGE_HOURS = 48

# Telegram rejects messages over 4096 characters, and a wall of 90 schools is
# not a notification anyway. Beyond this the message ends with a "+N more" line.
MAX_ITEMS_PER_MESSAGE = 15


class Connection(Protocol):
    """The slice of asyncpg / db.HttpConnection this worker uses."""

    async def fetch(self, sql: str, *args: Any) -> Sequence[Any]: ...

    async def execute(self, sql: str, *args: Any) -> Any: ...


@dataclass(frozen=True, slots=True)
class NewGuideline:
    """One newly-stored guideline document, as the operator should hear it."""

    document_id: str
    institution_name: str
    institution_name_ko: str | None
    source_url: str | None
    academic_year: int | None
    semester: str | None
    fetched_at: datetime | None

    @property
    def cycle_label(self) -> str:
        """'2027 bahor' / '2027' / '' — what admission cycle this is for."""
        if self.academic_year is None:
            return ""
        term = _TERM_UZ.get((self.semester or "").strip().lower())
        return f"{self.academic_year} {term}" if term else str(self.academic_year)

    @property
    def display_name(self) -> str:
        """Korean name first — it is what the university's own site says, so it
        is what the operator searches for. The romanized name follows."""
        ko = (self.institution_name_ko or "").strip()
        en = (self.institution_name or "").strip()
        if ko and en and ko != en:
            return f"{ko} ({en})"
        return ko or en or "(nomsiz muassasa)"


# Term codes as stored by the extractor → the word the operator reads.
_TERM_UZ = {
    "spring": "bahor",
    "fall": "kuz",
    "autumn": "kuz",
    "전기": "bahor",
    "후기": "kuz",
    "1": "bahor",
    "2": "kuz",
}


@dataclass(frozen=True, slots=True)
class NotifyRun:
    """What one `notify-new` invocation did."""

    found: int  # un-announced documents inside the age window
    sent: int  # documents actually announced (0 when dry-run/mark-only)
    marked: int  # documents written to the ledger
    skipped_no_channel: bool = False  # no bot token / chat id configured


# The injected sender: takes the finished message text, delivers it, raises on
# failure. Kept this narrow so a Slack/email channel is a drop-in later.
SendFn = Callable[[str], Awaitable[None]]


# --- selection -------------------------------------------------------------

_SELECT_SQL = """
SELECT d.id::text        AS document_id,
       i.name_en         AS institution_name,
       i.name_ko         AS institution_name_ko,
       d.source_url_ko   AS source_url,
       d.academic_year   AS academic_year,
       d.semester        AS semester,
       d.fetched_at      AS fetched_at
  FROM public.guideline_documents d
  JOIN public.institutions i
    ON i.id = d.institution_id
  LEFT JOIN public.guideline_notifications n
    ON n.guideline_document_id = d.id
 WHERE n.guideline_document_id IS NULL
   AND d.superseded_by_id IS NULL
   AND d.fetched_at IS NOT NULL
   AND d.fetched_at > now() - make_interval(hours => $1)
 ORDER BY d.fetched_at ASC
 LIMIT $2
"""

# `mark_seen` deliberately ignores the age window: seeding the ledger at setup
# has to cover the whole backlog, which is the entire point of it.
_SELECT_ALL_UNMARKED_SQL = """
SELECT d.id::text AS document_id
  FROM public.guideline_documents d
  LEFT JOIN public.guideline_notifications n
    ON n.guideline_document_id = d.id
 WHERE n.guideline_document_id IS NULL
 LIMIT $1
"""

# ON CONFLICT makes a re-run after a partial failure a no-op rather than an
# error, which is what keeps "send, then mark" safe to retry.
_MARK_SQL = """
INSERT INTO public.guideline_notifications (guideline_document_id, channel)
SELECT unnest($1::uuid[]), $2
ON CONFLICT (guideline_document_id) DO NOTHING
"""


async def fetch_unannounced(
    conn: Connection,
    *,
    limit: int = 50,
    max_age_hours: int = MAX_AGE_HOURS,
) -> list[NewGuideline]:
    """Recently-stored guideline documents that have never been announced."""
    rows = await conn.fetch(_SELECT_SQL, max_age_hours, limit)
    return [
        NewGuideline(
            document_id=str(r["document_id"]),
            institution_name=r["institution_name"] or "",
            institution_name_ko=r["institution_name_ko"],
            source_url=r["source_url"],
            academic_year=r["academic_year"],
            semester=r["semester"],
            fetched_at=r["fetched_at"],
        )
        for r in rows
    ]


async def mark_announced(
    conn: Connection, document_ids: Sequence[str], *, channel: str = "telegram"
) -> int:
    """Write the ledger rows that stop these documents being announced again."""
    if not document_ids:
        return 0
    await conn.execute(_MARK_SQL, list(document_ids), channel)
    return len(document_ids)


# --- message ---------------------------------------------------------------


def _escape(text: str) -> str:
    """Telegram HTML parse mode: only these three are special."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def format_message(items: Sequence[NewGuideline]) -> str:
    """The Telegram message body, in Uzbek — the operator's language.

    Korean university names are left as-is (that is what the source site shows)
    and the link is the university's own URL, never a Supabase storage path, so
    the operator can verify the find at the source in one tap.
    """
    if not items:
        return ""

    head = (
        f"🎓 <b>Yangi qabul yo'riqnomasi: {len(items)} ta</b>"
        if len(items) > 1
        else "🎓 <b>Yangi qabul yo'riqnomasi</b>"
    )
    lines = [head, ""]

    for n, item in enumerate(items[:MAX_ITEMS_PER_MESSAGE], start=1):
        lines.append(f"{n}. <b>{_escape(item.display_name)}</b>")
        cycle = item.cycle_label
        if cycle:
            lines.append(f"   📅 {_escape(cycle)} qabuli")
        if item.source_url:
            lines.append(f"   🔗 {_escape(item.source_url)}")
        lines.append("")

    remaining = len(items) - MAX_ITEMS_PER_MESSAGE
    if remaining > 0:
        lines.append(f"…va yana {remaining} ta. Hammasi CRM'da: Uni-DB ko'rib chiqish.")
        lines.append("")

    lines.append("<i>Ma'lumotlar tasdiqlashni kutmoqda — CRM'da tekshiring.</i>")
    return "\n".join(lines).strip()


# --- delivery --------------------------------------------------------------


def make_telegram_sender(
    http: Any, *, bot_token: str, chat_id: str
) -> SendFn:
    """A SendFn that posts to the Telegram Bot API with the given client.

    Link previews are off: a guideline PDF preview is a large useless thumbnail
    that pushes the next item off the screen.
    """

    async def send(text: str) -> None:
        resp = await http.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
        )
        # Telegram answers 200 + {"ok": false} for application-level refusals
        # (bad chat id, bot blocked), so the status code alone is not enough.
        resp.raise_for_status()
        body = resp.json()
        if not body.get("ok"):
            raise RuntimeError(
                f"Telegram refused the message: {body.get('description', body)}"
            )

    return send


# --- orchestration ---------------------------------------------------------


async def notify_new_guidelines(
    conn: Connection,
    send: SendFn | None,
    *,
    limit: int = 50,
    max_age_hours: int = MAX_AGE_HOURS,
    dry_run: bool = False,
) -> NotifyRun:
    """Announce every un-announced recent guideline, then record that we did.

    With `send=None` there is no channel configured: the run reports what it
    would have said and marks nothing, so turning Telegram on later still
    announces those documents rather than silently swallowing them.
    """
    items = await fetch_unannounced(conn, limit=limit, max_age_hours=max_age_hours)
    if not items:
        return NotifyRun(found=0, sent=0, marked=0)

    if send is None:
        log.warning(
            "notify-new: %d new guideline(s) but no Telegram channel configured "
            "(set UNI_DB_TELEGRAM_BOT_TOKEN and UNI_DB_TELEGRAM_CHAT_ID)",
            len(items),
        )
        return NotifyRun(found=len(items), sent=0, marked=0, skipped_no_channel=True)

    if dry_run:
        return NotifyRun(found=len(items), sent=0, marked=0)

    # Send first: a failure here must leave the ledger untouched so the next
    # run retries, rather than marking documents nobody ever heard about.
    await send(format_message(items))
    marked = await mark_announced(conn, [i.document_id for i in items])
    return NotifyRun(found=len(items), sent=len(items), marked=marked)


async def mark_seen(conn: Connection, *, limit: int = 10_000) -> int:
    """Seed the ledger with everything already stored, announcing nothing.

    Run once when switching the notifier on. Without it the first real run
    would treat the whole existing corpus as news — the age window keeps that
    to "recent" rather than "all 263", but the operator still does not want
    yesterday's sweep re-announced as if it were fresh.
    """
    rows = await conn.fetch(_SELECT_ALL_UNMARKED_SQL, limit)
    ids = [str(r["document_id"]) for r in rows]
    return await mark_announced(conn, ids, channel="seed")
