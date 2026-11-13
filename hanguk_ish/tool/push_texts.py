#!/usr/bin/env python3
"""Hanguk Ish → supabase/functions/ish-push/texts.json (P56).

What a push says is what A12 (worker) and 알림 (사장님) say: the strings come
from the apps' own ARB files, and the Seoul district names (the evening
digest's «near …») from lib/data/catalog/places.dart and
lib/features/worker/feed/feed_area.dart (seoulPlace). Run after changing
either (supabase/functions/ish-push/texts_test.ts fails until then):

    python3 hanguk_ish/tool/push_texts.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
L10N = ROOT / "hanguk_ish/lib/l10n"
PLACES = ROOT / "hanguk_ish/lib/data/catalog/places.dart"
FEED_AREA = ROOT / "hanguk_ish/lib/features/worker/feed/feed_area.dart"
OUT = ROOT / "supabase/functions/ish-push/texts.json"

LANGS = ["uz", "ru", "en", "ko"]
KEYS = [
    # A12 (worker app): the titles; the line under each is the business.
    "notifReminderTitle", "notifConfirmedTitle", "notifRejectedTitle", "notifTimeChangedTitle",
    "notifCancelledTitle", "notifPaidTitle", "notifMessageTitle", "notifNewShiftTitle", "notifOfferTitle",
    "notifNearbyTitle",
    # 알림 (사장님 app): title and line.
    "bizNotifNewApplicant", "bizNotifNewApplicantText", "bizNotifAutoConfirmed", "bizNotifAutoConfirmedText",
    "bizNotifCancelled", "bizNotifCancelledText", "bizNotifNoShow", "bizNotifNoShowText",
    "bizNotifMessage", "bizNotifMessageText",
]
PLACE = re.compile(
    r"Place\('([^']*)',\s*uz:\s*'([^']*)',\s*ru:\s*'([^']*)',\s*en:\s*'([^']*)',\s*ko:\s*'([^']*)'\)")


def texts() -> dict:
    strings = {}
    for lang in LANGS:
        arb = json.loads((L10N / f"app_{lang}.arb").read_text(encoding="utf-8"))
        strings[lang] = {k: arb[k] for k in KEYS}
    source = PLACES.read_text(encoding="utf-8")
    feed = FEED_AREA.read_text(encoding="utf-8")
    seoul = PLACE.search(next(line for line in feed.splitlines() if line.startswith("const seoulPlace")))
    districts_src = source[source.index("const seoulDistricts"):]
    districts_src = districts_src[:districts_src.index("];")]
    districts = {m.group(1): dict(zip(LANGS, m.groups()[1:])) for m in PLACE.finditer(districts_src)}
    return {
        "strings": strings,
        "seoul": dict(zip(LANGS, seoul.groups()[1:])),
        "districts": districts,
    }


if __name__ == "__main__":
    OUT.write_text(json.dumps(texts(), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
