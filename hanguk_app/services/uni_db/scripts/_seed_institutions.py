"""Seed institutions table for the live sources and link them up."""
import asyncio
from uuid import uuid4

import asyncpg

from uni_db.config import settings


# UUIDs match supabase/migrations/20260510112339_uni_db_seed_top3_demo_data.sql
INSTITUTIONS = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "name_ko": "서울대학교",
        "name_en": "Seoul National University",
        "institution_type": "national",
        "primary_domain": "snu.ac.kr",
        "primary_admissions_url_ko": "https://admission.snu.ac.kr/international/notice",
        "url_kos": ["admission.snu.ac.kr"],
    },
    {
        "id": "44444444-4444-4444-4444-444444444444",
        "name_ko": "고려대학교",
        "name_en": "Korea University",
        "institution_type": "private",
        "primary_domain": "korea.ac.kr",
        "primary_admissions_url_ko": "https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=700",
        "url_kos": ["oku.korea.ac.kr"],
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "name_ko": "한국과학기술원",
        "name_en": "KAIST",
        "institution_type": "national_special",
        "primary_domain": "kaist.ac.kr",
        "primary_admissions_url_ko": "https://admission.kaist.ac.kr/intl-undergraduate/notice",
        "url_kos": ["admission.kaist.ac.kr"],
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "name_ko": "연세대학교",
        "name_en": "Yonsei University",
        "institution_type": "private",
        "primary_domain": "yonsei.ac.kr",
        "primary_admissions_url_ko": "https://admission.yonsei.ac.kr/",
        "url_kos": ["admission.yonsei.ac.kr"],
    },
]


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)

    cols = await c.fetch(
        "select column_name, is_nullable, data_type from information_schema.columns "
        "where table_name='institutions' order by ordinal_position"
    )
    print("institutions columns:")
    col_names = []
    for r in cols:
        print(f"  {r['column_name']} ({r['data_type']}, nullable={r['is_nullable']})")
        col_names.append(r['column_name'])
    print()

    # Use whichever columns exist
    have = set(col_names)

    for inst in INSTITUTIONS:
        # Check existence by name_ko
        existing = await c.fetchrow(
            "select id from public.institutions where name_ko = $1", inst["name_ko"]
        )
        if existing:
            inst_id = existing["id"]
            print(f"  exists: {inst['name_ko']} ({str(inst_id)[:8]})")
        else:
            from uuid import UUID as _UUID
            import json as _json
            inst_id = _UUID(inst["id"])
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
                inst["institution_type"],
                inst["primary_domain"], inst["primary_admissions_url_ko"],
                _json.dumps({
                    "ko": inst["name_ko"],
                    "en": inst["name_en"],
                }),
            )
            print(f"  inserted: {inst['name_ko']} ({str(inst_id)[:8]})")

        # Link matching announcement_sources
        for url_substr in inst["url_kos"]:
            updated = await c.execute(
                "update public.announcement_sources "
                "   set institution_id = $1 "
                " where url_ko like $2 "
                "   and (institution_id is null or institution_id <> $1)",
                inst_id, f"%{url_substr}%",
            )
            print(f"    -> linked sources matching '{url_substr}': {updated}")

    # Backfill: also link any existing guideline_documents whose source matches
    print("\nBackfilling guideline_documents.institution_id from source...")
    res = await c.execute(
        "update public.guideline_documents gd "
        "set institution_id = s.institution_id "
        "from public.announcement_sources s "
        "where gd.source_url_ko = s.url_ko and gd.institution_id is null and s.institution_id is not null"
    )
    print(f"  {res}")

    await c.close()


asyncio.run(main())
