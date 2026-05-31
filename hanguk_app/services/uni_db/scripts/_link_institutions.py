"""One-off: link announcement_sources to institutions by name match."""
import asyncio

import asyncpg

from uni_db.config import settings

# url_ko substring -> institution name match patterns (Korean or English)
SOURCE_TO_INSTITUTION = {
    "admission.snu.ac.kr":      ["서울대학교", "Seoul National University", "SNU"],
    "oku.korea.ac.kr":          ["고려대학교", "Korea University"],
    "admission.kaist.ac.kr":    ["KAIST", "한국과학기술원"],
    "admission.yonsei.ac.kr":   ["연세대학교", "Yonsei University"],
}


async def main() -> None:
    c = await asyncpg.connect(settings.supabase_db_url)

    # Print all institutions for reference
    insts = await c.fetch(
        "select id, name_ko, name_en from public.institutions order by name_ko limit 200"
    )
    print(f"=== Found {len(insts)} institutions ===")
    for r in insts[:20]:
        print(f"  {str(r['id'])[:8]} | {r['name_ko']} | {r['name_en'] or ''}")
    if len(insts) > 20:
        print(f"  ... ({len(insts) - 20} more)")
    print()

    # Get live sources lacking institution_id
    sources = await c.fetch(
        "select id, url_ko, institution_id from public.announcement_sources "
        "where status = 'live'"
    )
    print(f"=== Live sources ({len(sources)}) ===")
    for s in sources:
        print(f"  {str(s['id'])[:8]} | inst={s['institution_id']} | {s['url_ko']}")
    print()

    # Link each via substring match
    linked = 0
    for url_substr, name_patterns in SOURCE_TO_INSTITUTION.items():
        for src in sources:
            if url_substr not in src["url_ko"]:
                continue
            # Try each name pattern
            inst_row = None
            for name in name_patterns:
                inst_row = await c.fetchrow(
                    "select id, name_ko from public.institutions "
                    "where name_ko ilike $1 or name_en ilike $1 limit 1",
                    f"%{name}%",
                )
                if inst_row:
                    break
            if inst_row and src["institution_id"] != inst_row["id"]:
                await c.execute(
                    "update public.announcement_sources set institution_id = $1 where id = $2",
                    inst_row["id"],
                    src["id"],
                )
                print(f"  LINKED {url_substr} -> {inst_row['name_ko']}")
                linked += 1
            elif inst_row:
                print(f"  SKIP   {url_substr} already linked to {inst_row['name_ko']}")
            else:
                print(f"  NOMATCH {url_substr} -- no institution found for {name_patterns}")

    print(f"\nTotal linked: {linked}")
    await c.close()


asyncio.run(main())
