"""Seed CBNU + JBNU + SKKU institutions, link sources, fix url_ko.

Idempotent: re-runs only update url_ko or create missing institutions.
"""

from __future__ import annotations

import asyncio
import json
from uuid import UUID

import asyncpg

from uni_db.config import settings


SEED = [
    {
        "id": "55555555-5555-5555-5555-555555555555",
        "name_ko": "충북대학교",
        "name_en": "Chungbuk National University",
        "institution_type": "national",
        "primary_domain": "cbnu.ac.kr",
        "primary_admissions_url_ko": "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do",
        "old_url_substring": "ipsi.chungbuk.ac.kr",
        "new_url": "https://ipsi.chungbuk.ac.kr/kor/bbs/BBSMSTR_000000000017/lst.do",
    },
    {
        "id": "66666666-6666-6666-6666-666666666666",
        "name_ko": "전북대학교",
        "name_en": "Jeonbuk National University",
        "institution_type": "national",
        "primary_domain": "jbnu.ac.kr",
        "primary_admissions_url_ko": "https://enter.jbnu.ac.kr/submenu.do?menuurl=rOjsbGuR5i0fqsax24xcPQ%3D%3D&",
        "old_url_substring": "enter.jbnu.ac.kr",
        "new_url": "https://enter.jbnu.ac.kr/submenu.do?menuurl=rOjsbGuR5i0fqsax24xcPQ%3D%3D&",
    },
    {
        "id": "77777777-7777-7777-7777-777777777777",
        "name_ko": "성균관대학교",
        "name_en": "Sungkyunkwan University",
        "institution_type": "private",
        "primary_domain": "skku.edu",
        "primary_admissions_url_ko": "https://admission.skku.edu/admission/html/abroad/notice.html",
        "old_url_substring": "admission.skku.edu",
        "new_url": "https://admission.skku.edu/admission/html/abroad/notice.html",
    },
]


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)

    for inst in SEED:
        # Upsert institution
        existing = await c.fetchrow(
            "select id from public.institutions where name_ko = $1",
            inst["name_ko"],
        )
        if existing:
            inst_id = existing["id"]
            print(f"  exists: {inst['name_ko']} ({str(inst_id)[:8]})")
        else:
            inst_id = UUID(inst["id"])
            await c.execute(
                """
                insert into public.institutions
                  (id, name_ko, name_en, institution_type, primary_domain,
                   primary_admissions_url_ko, is_partner, is_visible_on_map,
                   display_names)
                values
                  ($1, $2, $3, $4, $5, $6, false, true, $7::jsonb)
                """,
                inst_id, inst["name_ko"], inst["name_en"],
                inst["institution_type"], inst["primary_domain"],
                inst["primary_admissions_url_ko"],
                json.dumps({"ko": inst["name_ko"], "en": inst["name_en"]}),
            )
            print(f"  inserted: {inst['name_ko']} ({str(inst_id)[:8]})")

        # Link & rename announcement_sources rows
        src = await c.fetchrow(
            "select id, url_ko, status from public.announcement_sources "
            "where url_ko like $1 limit 1",
            f"%{inst['old_url_substring']}%",
        )
        if src:
            await c.execute(
                "update public.announcement_sources "
                "  set institution_id = $1, url_ko = $2, status = 'live', "
                "      next_poll_at = now() "
                "where id = $3",
                inst_id, inst["new_url"], src["id"],
            )
            print(f"    source updated: {src['url_ko'][:60]} -> {inst['new_url'][:60]}")
        else:
            # No existing row — insert one
            src_id = UUID("88888888-0000-0000-0000-" + str(abs(hash(inst["new_url"])))[:12].rjust(12, "0"))
            await c.execute(
                """
                insert into public.announcement_sources
                  (id, institution_id, source_type, url_ko, status,
                   next_poll_at, cron_high_season_minutes, cron_off_season_minutes)
                values
                  ($1, $2, 'university_admission_board', $3, 'live',
                   now(), 360, 1440)
                """,
                src_id, inst_id, inst["new_url"],
            )
            print(f"    source inserted: {inst['new_url'][:80]}")

    await c.close()


asyncio.run(main())
