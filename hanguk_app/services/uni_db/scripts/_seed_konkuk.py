"""Seed Konkuk institution + update its announcement_sources.url_ko."""
import asyncio
import json
from uuid import UUID

import asyncpg
from uni_db.config import settings


NEW_URL = "http://enter.konkuk.ac.kr/submenu.do?menuurl=k8b%2fCUaWlntKYwhT%2fh%2bKUA%3d%3d&"
INST = {
    "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "name_ko": "건국대학교",
    "name_en": "Konkuk University",
    "institution_type": "private",
    "primary_domain": "konkuk.ac.kr",
}


async def main():
    c = await asyncpg.connect(settings.supabase_db_url)
    existing = await c.fetchrow(
        "select id from public.institutions where name_ko = $1", INST["name_ko"]
    )
    if existing:
        inst_id = existing["id"]
        print(f"  exists: {INST['name_ko']} ({str(inst_id)[:8]})")
    else:
        inst_id = UUID(INST["id"])
        await c.execute(
            "insert into public.institutions "
            "(id, name_ko, name_en, institution_type, primary_domain, "
            " primary_admissions_url_ko, is_partner, is_visible_on_map, display_names) "
            "values ($1, $2, $3, $4, $5, $6, false, true, $7::jsonb)",
            inst_id, INST["name_ko"], INST["name_en"], INST["institution_type"],
            INST["primary_domain"], NEW_URL,
            json.dumps({"ko": INST["name_ko"], "en": INST["name_en"]}),
        )
        print(f"  inserted: {INST['name_ko']} ({str(inst_id)[:8]})")

    res = await c.execute(
        "update public.announcement_sources "
        "  set institution_id=$1, url_ko=$2, status='live', next_poll_at=now() "
        "where url_ko like '%enter.konkuk.ac.kr%'",
        inst_id, NEW_URL,
    )
    print(f"  source update: {res}")
    await c.close()


asyncio.run(main())
