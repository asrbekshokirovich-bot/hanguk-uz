"""Seed Inha + Kangwon + Jeju + Hanyang institutions, link sources, fix url_ko.

Also: fix the Jeju domain typo (ipsi -> ibsi).
"""

from __future__ import annotations

import asyncio
import json
from uuid import UUID

import asyncpg

from uni_db.config import settings


SEED = [
    {
        "id": "88888888-8888-8888-8888-888888888888",
        "name_ko": "인하대학교",
        "name_en": "Inha University",
        "institution_type": "private",
        "primary_domain": "inha.ac.kr",
        "primary_admissions_url_ko": "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=170",
        "old_url_substring": "admission.inha.ac.kr",
        "new_url": "https://admission.inha.ac.kr/cms/FR_CON/index.do?MENU_ID=170",
    },
    {
        "id": "99999999-9999-9999-9999-999999999999",
        "name_ko": "강원대학교",
        "name_en": "Kangwon National University",
        "institution_type": "national",
        "primary_domain": "kangwon.ac.kr",
        "primary_admissions_url_ko": "https://admission.kangwon.ac.kr/admission/selectBbsNttList.do?bbsNo=373",
        "old_url_substring": "admission.kangwon.ac.kr",
        "new_url": "https://admission.kangwon.ac.kr/admission/selectBbsNttList.do?bbsNo=373",
    },
    {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name_ko": "제주대학교",
        "name_en": "Jeju National University",
        "institution_type": "national",
        "primary_domain": "jejunu.ac.kr",
        "primary_admissions_url_ko": "https://ibsi.jejunu.ac.kr/10000048",
        # Note: existing seed has IPSI (typo). The correct host is IBSI.
        "old_url_substring": "jejunu.ac.kr",
        "new_url": "https://ibsi.jejunu.ac.kr/10000048",
    },
    {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "name_ko": "한양대학교",
        "name_en": "Hanyang University",
        "institution_type": "private",
        "primary_domain": "hanyang.ac.kr",
        "primary_admissions_url_ko": "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK",
        "old_url_substring": "hanyang.ac.kr",
        "new_url": "https://go.hanyang.ac.kr/web/notice/notice_list.do?m_type=JEOEGUK",
    },
]


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)
    for inst in SEED:
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

        src = await c.fetchrow(
            "select id, url_ko from public.announcement_sources "
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
            print(f"    updated: {src['url_ko'][:50]} -> {inst['new_url'][:50]}")
        else:
            new_src_id = UUID(inst["id"][:8] + "-1111-1111-1111-111111111111")
            await c.execute(
                """
                insert into public.announcement_sources
                  (id, institution_id, source_type, url_ko, status,
                   next_poll_at, cron_high_season_minutes, cron_off_season_minutes)
                values
                  ($1, $2, 'university_admission_board', $3, 'live',
                   now(), 360, 1440)
                """,
                new_src_id, inst_id, inst["new_url"],
            )
            print(f"    inserted: {inst['new_url'][:80]}")

    await c.close()


asyncio.run(main())
